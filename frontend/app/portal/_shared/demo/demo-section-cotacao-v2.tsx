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

import { useMemo, useState } from 'react';
import { Send, Undo2 } from 'lucide-react';

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
  onClose,
}: {
  quotationId: string;
  reference: string;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState(RETURN_REASONS[0]);
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
                {RETURN_REASONS.map((item) => (
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
                        Bloqueada · dado incompleto
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
  onReturn,
  onRelease,
}: {
  quotationId: string;
  review: QuotationReview;
  quotation: PortalQuotation | undefined;
  onReturn: () => void;
  onRelease: () => void;
}) {
  const reference = quotation?.reference ?? quotationId.slice(0, 8);

  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="portal-body font-medium text-foreground">{reference}</p>
        <p className="portal-small text-portal-neutral">
          {V2_STAGE_LABELS[review.stage]} · {V2_STAGE_DESCRIPTIONS[review.stage]}
        </p>
      </div>

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
          <Button size="sm" onClick={onRelease}>
            <Send className="mr-1.5 h-4 w-4" />
            Liberar propostas
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
      </div>
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
        (byId.get(a)?.reference ?? a).localeCompare(byId.get(b)?.reference ?? b),
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
      label:
        proposal.agent?.name ??
        `Proposta ${index + 1}`,
      // "Bloqueada" aqui é ilustrativo: sem valor, a proposta não tem o que
      // comparar, e é o caso mais legível de bloqueio rígido para a demo.
      blocked: !(Number.isFinite(proposal.total_brl) && proposal.total_brl > 0),
    }));
  };

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="portal-small text-portal-neutral">
          Nenhuma cotação na jornada V2. Envie uma em “Nova cotação”, ou carregue
          os cenários abaixo.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([quotationId, review]) => (
            <QuotationRow
              key={quotationId}
              quotationId={quotationId}
              review={review}
              quotation={byId.get(quotationId)}
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
        Os cenários distribuem as seis etapas por cotações que já existem. Nada é
        criado nem apagado no servidor.
      </p>

      {returning && (
        <ReturnDialog
          quotationId={returning}
          reference={byId.get(returning)?.reference ?? returning}
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
