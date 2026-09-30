'use client';

// A seção "Cotação V2" do painel — a Freitas, simulada.
//
// ELA É A ÚNICA FREITAS QUE EXISTE NESTE PROTÓTIPO. Não há tela interna, não há
// Kanban de analista e não há fila: há estes botões, que movem o overlay de uma
// etapa para a outra, exatamente como a pessoa do outro lado moveria o cartão.
//
// UMA AÇÃO POR ETAPA, e só a válida. O painel não oferece "Liberar propostas"
// numa cotação que ainda está na revisão de entrada: quem apresenta clica no
// que faz sentido agora, e a lista de ações é a própria explicação do fluxo.
//
// Devolver é sempre manual e sempre exige motivo (RQ-5). A autorresposta nunca
// devolve — ver `use-v2-auto-advance.ts`.
//
// VOCABULÁRIO (Orsi, 29/09/2026). O Inbox NÃO é uma fila nova: é a visão que o
// analista usa para a revisão de entrada, a mesma fila de "Para Cotar". Cada
// linha diz em que coluna do Kanban interno a cotação estaria, para quem assiste
// ligar o estado do cliente à fila da Freitas.
//
// HARDBLOCKS (mesma data). A lista do Orsi trava "Aprovar e disparar RFQ" na
// entrada e "Liberar N propostas" na saída, com o motivo escrito. As flags
// Crítico/Alto das propostas NÃO entram na regra.

import { useMemo, useState } from 'react';
import { Clock3, Mail, Send, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import type { PortalQuotation } from '@/types/portal';

import {
  V2_STAGE_DESCRIPTIONS,
  V2_STAGE_LABELS,
  isResubmission,
  lastSubmission,
  submissionRound,
  type V2Stage,
  approveEntry,
  quotesArrived,
  releaseProposals,
  resetToDraft,
  returnToClient,
  submitToFreitas,
  type QuotationReview,
} from './quotation-review';
import {
  clearQuotationReviewStore,
  updateQuotationReview,
  useQuotationReviewStore,
  writeQuotationReviewStore,
} from './use-quotation-review';
import { usePortalModuleReleased } from './use-feature-flags';
import { buildDemoScenarios } from './quotation-v2-scenarios';
import { effectiveProposals } from './quotation-demo-proposals';
import { quotationHardblocks, type Hardblock } from './quotation-hardblocks';
import {
  ChangedFieldsList,
  REVIEW_SLA_LABEL,
  ResubmittedChip,
} from './quotation-v2-labels';
import { reviewDueAt } from './review-sla';

/**
 * Onde a cotação estaria no Kanban interno da Freitas (spec, Figura 1). O Inbox
 * é a visão da revisão de entrada sobre a coluna Para Cotar, não uma coluna.
 */
const INTERNAL_QUEUE: Record<V2Stage, string> = {
  draft: 'Fora da fila · rascunho do cliente',
  entry_review: 'Inbox · revisão de entrada (Para Cotar)',
  returned: 'Fora da fila · devolvida ao cliente',
  awaiting_quotes: 'Cotando',
  exit_review: 'Para Análise · revisão de saída',
  released: 'Enviada ao Cliente',
  approved: 'Aprovada pelo Cliente',
  cancelled: 'Cancelada pelo cliente',
};

function time(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** O quadro "por que este botão está travado", com a lista do Orsi. */
function BlockedNote({
  title,
  blocks,
  hint,
}: {
  title: string;
  blocks: Hardblock[];
  hint: string;
}) {
  return (
    <div className="rounded-md border border-portal-warning/40 bg-portal-warning/10 px-3 py-2">
      <p className="portal-small font-medium text-portal-warning-ink">
        {title} ·{' '}
        {blocks.length === 1 ? 'falta 1 item' : `faltam ${blocks.length} itens`}
      </p>
      <p className="portal-small text-foreground/80">
        {blocks.map((block) => block.label).join(', ')}.
      </p>
      <p className="portal-small mt-1 text-portal-neutral">{hint}</p>
    </div>
  );
}

/**
 * Motivos prontos de devolução.
 *
 * FICTÍCIOS e ilustrativos, como todo dado deste repositório. São os três
 * exemplos que a própria spec dá para bloqueio na revisão de entrada, mais o
 * campo livre — que é o que faz a demonstração conseguir responder a uma
 * pergunta da plateia sem sair do fluxo.
 */
const RETURN_REASONS = [
  'Peso divergente da invoice',
  'NCM incompatível com a descrição',
  'Falta packing list',
];

const FREE_REASON = '__livre__';

/** Quotations by id, from the same SWR key the portal already uses. */
function useQuotationsById(): Map<string, PortalQuotation> {
  const { data } = useMyQuotations();
  return useMemo(() => {
    const map = new Map<string, PortalQuotation>();
    for (const rows of Object.values(data?.buckets ?? {})) {
      for (const q of rows) map.set(q.id, q);
    }
    return map;
  }, [data]);
}

function now(): string {
  return new Date().toISOString();
}

function ReturnDialog({
  quotationId,
  reference,
  suggested,
  onClose,
}: {
  quotationId: string;
  reference: string;
  /** "Faltam dados obrigatórios: ..." quando a lista do Orsi bloqueia. */
  suggested: string | null;
  onClose: () => void;
}) {
  const reasons = suggested ? [suggested, ...RETURN_REASONS] : RETURN_REASONS;
  const [choice, setChoice] = useState(reasons[0]);
  const [free, setFree] = useState('');
  const reason = choice === FREE_REASON ? free.trim() : choice;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver {reference} ao cliente</DialogTitle>
          <DialogDescription>
            O motivo aparece no cartão e na tela de correção. Ele é obrigatório:
            uma devolução sem motivo não diz ao cliente o que corrigir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="demo-return-reason" className="portal-small">
              Motivo
            </Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger id="demo-return-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
                <SelectItem value={FREE_REASON}>Outro motivo…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {choice === FREE_REASON && (
            <div className="space-y-1.5">
              <Label htmlFor="demo-return-free" className="portal-small">
                Escreva o motivo
              </Label>
              <Input
                id="demo-return-free"
                value={free}
                onChange={(event) => setFree(event.target.value)}
                placeholder="O que o cliente precisa corrigir"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!reason}
            onClick={() => {
              updateQuotationReview(quotationId, (review) =>
                returnToClient(review, reason, now()),
              );
              onClose();
            }}
          >
            Devolver ao cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReleaseDialog({
  quotationId,
  reference,
  proposals,
  onClose,
}: {
  quotationId: string;
  reference: string;
  proposals: { id: string; label: string; blocked: boolean }[];
  onClose: () => void;
}) {
  // Por padrão, as NÃO bloqueadas. É o que a revisão de saída faz na maior
  // parte das vezes, e quem apresenta ainda pode desmarcar.
  const [selected, setSelected] = useState<string[]>(() =>
    proposals.filter((p) => !p.blocked).map((p) => p.id),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar propostas de {reference}</DialogTitle>
          <DialogDescription>
            Só as marcadas chegam ao cliente. As demais ficam invisíveis para
            ele — no produto integrado essa regra vale na API, não só na tela.
          </DialogDescription>
        </DialogHeader>

        {proposals.length === 0 ? (
          <p className="portal-small text-portal-neutral">
            Esta cotação não tem proposta no payload, então não há o que
            liberar. Use uma cotação com propostas recebidas.
          </p>
        ) : (
          <ul className="space-y-2">
            {proposals.map((proposal) => (
              <li key={proposal.id}>
                <label className="portal-body flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                    checked={selected.includes(proposal.id)}
                    onChange={(event) =>
                      setSelected((prev) =>
                        event.target.checked
                          ? [...prev, proposal.id]
                          : prev.filter((id) => id !== proposal.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    {proposal.label}
                    {proposal.blocked && (
                      <span className="portal-small block text-portal-warning-ink">
                        Bloqueada · sem valor. A correção é pedida ao agente por
                        e-mail.
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              updateQuotationReview(quotationId, (review) =>
                releaseProposals(review, selected, now()),
              );
              onClose();
            }}
          >
            Liberar {selected.length}{' '}
            {selected.length === 1 ? 'proposta' : 'propostas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotationRow({
  quotationId,
  review,
  quotation,
  blocks,
  releasable,
  onReturn,
  onRelease,
}: {
  quotationId: string;
  review: QuotationReview;
  quotation: PortalQuotation | undefined;
  /** A lista do Orsi sobre esta cotação; `null` enquanto o payload carrega. */
  blocks: Hardblock[] | null;
  /** Propostas com valor, as que a revisão de saída pode liberar. */
  releasable: number;
  onReturn: () => void;
  onRelease: () => void;
}) {
  const reference = quotation?.reference ?? quotationId.slice(0, 8);
  const blocked = blocks == null || blocks.length > 0;
  const due =
    review.stage === 'entry_review' || review.stage === 'exit_review'
      ? reviewDueAt(review.stageEnteredAt)
      : null;
  const overdue = due != null && due.getTime() < Date.now();
  const round = submissionRound(review);

  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="portal-body font-medium text-foreground">{reference}</p>
          {isResubmission(review) && <ResubmittedChip />}
        </div>
        <p className="portal-small text-portal-neutral">
          {V2_STAGE_LABELS[review.stage]} ·{' '}
          {V2_STAGE_DESCRIPTIONS[review.stage]}
        </p>
        <p className="portal-small text-portal-neutral">
          {INTERNAL_QUEUE[review.stage]}
          {round > 1 && ` · ${round}ª rodada`}
        </p>
        {due && (
          <p
            className={
              overdue
                ? 'portal-small inline-flex items-center gap-1 font-medium text-portal-danger'
                : 'portal-small inline-flex items-center gap-1 text-portal-neutral'
            }
          >
            <Clock3 className="h-4 w-4 shrink-0" />
            {overdue ? 'Prazo vencido às ' : 'Prazo da revisão: até '}
            {time(due)}
          </p>
        )}
        {isResubmission(review) && (
          <div className="pt-1">
            <p className="portal-small font-medium text-foreground">
              O que mudou nesta rodada
            </p>
            <ChangedFieldsList
              changes={lastSubmission(review)?.changes}
              max={8}
            />
          </div>
        )}
      </div>

      {review.stage === 'entry_review' && blocks && blocks.length > 0 && (
        <BlockedNote
          title="RFQ bloqueado"
          blocks={blocks}
          hint="Devolva ao cliente pedindo esses itens. O motivo já vem sugerido."
        />
      )}
      {review.stage === 'exit_review' && blocks && blocks.length > 0 && (
        <BlockedNote
          title="Liberação bloqueada"
          blocks={blocks}
          hint="A cotação deixou de atender à lista de bloqueios: nenhuma proposta pode ser liberada até esses itens estarem preenchidos. As flags Crítico e Alto não entram nesta regra."
        />
      )}

      <div className="flex flex-wrap gap-2">
        {review.stage === 'draft' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateQuotationReview(quotationId, (entry) =>
                submitToFreitas(entry, now()),
              )
            }
          >
            Enviar (como o cliente)
          </Button>
        )}

        {review.stage === 'entry_review' && (
          <>
            <Button
              size="sm"
              disabled={blocked}
              onClick={() =>
                updateQuotationReview(quotationId, (entry) =>
                  approveEntry(entry, now()),
                )
              }
            >
              Aprovar e disparar RFQ
            </Button>
            <Button size="sm" variant="outline" onClick={onReturn}>
              <Undo2 className="mr-1.5 h-4 w-4" />
              Devolver ao cliente
            </Button>
          </>
        )}

        {review.stage === 'awaiting_quotes' && (
          <Button
            size="sm"
            onClick={() =>
              updateQuotationReview(quotationId, (entry) =>
                quotesArrived(entry, now()),
              )
            }
          >
            Propostas chegaram
          </Button>
        )}

        {review.stage === 'exit_review' && (
          <Button
            size="sm"
            disabled={blocked || releasable === 0}
            onClick={onRelease}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {releasable === 0
              ? 'Nada a liberar'
              : `Liberar ${releasable} ${releasable === 1 ? 'proposta' : 'propostas'}`}
          </Button>
        )}

        {review.stage === 'returned' && (
          <p className="portal-small text-portal-neutral">
            A bola está com o cliente: ele corrige e reenvia.
          </p>
        )}

        {review.stage === 'released' && (
          <p className="portal-small text-portal-neutral">
            A bola está com o cliente: ele compara e escolhe.
          </p>
        )}

        {review.stage === 'approved' && (
          <p className="portal-small text-portal-neutral">
            A instrução de fechamento chegou ao analista. O embarque já foi
            criado.
          </p>
        )}

        {review.stage === 'cancelled' && (
          <p className="portal-small text-portal-neutral">
            Justificativa do cliente: “
            {[...review.history]
              .reverse()
              .find((event) => event.kind === 'cancelled')?.reason ?? '—'}
            ”
          </p>
        )}

        {/* Cancelada tambem no BACKEND: voltar ao rascunho poria no funil uma
            cotacao que o servidor ja encerrou. */}
        {review.stage !== 'cancelled' && (
          <Button
            size="sm"
            variant="ghost"
            className="text-portal-neutral"
            onClick={() =>
              updateQuotationReview(quotationId, (entry) =>
                resetToDraft(entry, now()),
              )
            }
          >
            Voltar ao rascunho
          </Button>
        )}
      </div>

      {/* PEDIR CORRECAO AO AGENTE e sempre por e-mail (Orsi, 29/09/2026). E
          texto, nao botao: nao ha tela do cliente nem fila de agente neste
          prototipo, e um botao prometeria um envio que nao acontece. */}
      {review.stage === 'exit_review' && (
        <p className="portal-small flex items-start gap-1.5 text-portal-neutral">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Proposta com problema? A correção é pedida ao agente por e-mail,
            fora do portal. A proposta corrigida volta a esta revisão; o cliente
            não vê nada até a liberação.
          </span>
        </p>
      )}
      {review.stage === 'exit_review' && releasable === 0 && (
        <p className="portal-small text-portal-neutral">
          Nenhuma proposta tem valor para comparar. Liberar zero propostas não é
          possível: peça a correção aos agentes por e-mail.
        </p>
      )}
    </li>
  );
}

export function CotacaoV2Section() {
  const released = usePortalModuleReleased('cotacaoV2');
  const store = useQuotationReviewStore();
  const byId = useQuotationsById();
  const { data } = useMyQuotations();
  const [returning, setReturning] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      Object.entries(store).sort(([a], [b]) =>
        (byId.get(a)?.reference ?? a).localeCompare(
          byId.get(b)?.reference ?? b,
        ),
      ),
    [store, byId],
  );

  if (!released) {
    return (
      <p className="portal-small text-portal-neutral">
        Ligue o módulo “Cotação V2” acima para usar estes controles.
      </p>
    );
  }

  // `effectiveProposals` devolve as propostas de demonstração quando a cotação
  // não tem nenhuma no payload — sem isso, uma cotação recém-aberta pelo portal
  // chega aqui com a lista vazia e a revisão de saída não tem o que liberar.
  const proposalsOf = (quotationId: string) => {
    const quotation = byId.get(quotationId);
    if (!quotation) return [];
    return effectiveProposals(quotation).map((proposal, index) => ({
      id: proposal.id,
      label: proposal.agent?.name ?? `Proposta ${index + 1}`,
      // "Bloqueada" aqui é ilustrativo: sem valor, a proposta não tem o que
      // comparar, e é o caso mais legível de bloqueio rígido para a demo.
      blocked: !(Number.isFinite(proposal.total_brl) && proposal.total_brl > 0),
    }));
  };

  // A lista do Orsi sobre o que o cliente ENVIOU (snapshot do overlay) ou,
  // sem ele, sobre o payload. `null` enquanto a cotação não carregou.
  const blocksOf = (quotationId: string): Hardblock[] | null => {
    const quotation = byId.get(quotationId);
    if (!quotation) return null;
    return quotationHardblocks(store[quotationId]?.submittedForm, quotation)
      .blocks;
  };

  return (
    <div className="space-y-4">
      <p className="portal-small text-portal-neutral">
        O Inbox não é uma fila nova: é a visão da revisão de entrada sobre a
        coluna Para Cotar. Prazo de cada revisão: {REVIEW_SLA_LABEL}.
      </p>
      {entries.length === 0 ? (
        <p className="portal-small text-portal-neutral">
          Nenhuma cotação na jornada V2. Envie uma em “Nova cotação”, ou
          carregue os cenários abaixo.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([quotationId, review]) => (
            <QuotationRow
              key={quotationId}
              quotationId={quotationId}
              review={review}
              quotation={byId.get(quotationId)}
              blocks={blocksOf(quotationId)}
              releasable={
                proposalsOf(quotationId).filter((p) => !p.blocked).length
              }
              onReturn={() => setReturning(quotationId)}
              onRelease={() => setReleasing(quotationId)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => writeQuotationReviewStore(buildDemoScenarios(data))}
        >
          Carregar cenários de demonstração
        </Button>
        {entries.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-portal-neutral"
            onClick={() => clearQuotationReviewStore()}
          >
            Limpar a jornada V2
          </Button>
        )}
      </div>
      <p className="portal-small text-portal-neutral">
        Os cenários distribuem as seis etapas por cotações que já existem. Nada
        é criado nem apagado no servidor.
      </p>

      {returning && (
        <ReturnDialog
          quotationId={returning}
          reference={byId.get(returning)?.reference ?? returning}
          suggested={(() => {
            const blocks = blocksOf(returning);
            return blocks && blocks.length > 0
              ? `Faltam dados obrigatórios: ${blocks.map((b) => b.label).join(', ')}`
              : null;
          })()}
          onClose={() => setReturning(null)}
        />
      )}
      {releasing && (
        <ReleaseDialog
          quotationId={releasing}
          reference={byId.get(releasing)?.reference ?? releasing}
          proposals={proposalsOf(releasing)}
          onClose={() => setReleasing(null)}
        />
      )}
    </div>
  );
}
