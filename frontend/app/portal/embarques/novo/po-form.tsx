'use client';

// Telas 4, 5 e 6 — conferir os dados, o alerta de PO duplicado e a variação
// manual.
//
// UMA TELA SÓ para os três casos, porque são o MESMO formulário: a Tela 6 é a
// Tela 4 sem leitura, e a Tela 5 é a Tela 4 com o diálogo aberto. Três
// componentes separados divergiriam no primeiro campo novo.
//
// O QUE PRECISA EXISTIR NO BACKEND na versão real, e não existe aqui: o PO como
// REGISTRO SELECIONÁVEL (hoje ele é digitado dentro do `client_reference` da
// cotação), os SKUs, e o dedup sobre o registro do PO. Tudo isso é migration
// nova — ver o cabeçalho de `_shared/demo/shipment-po-review.ts`.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Plus, Send, Trash2, Undo2 } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/portal-formatters';

import { SectionHeading } from '../../_shared/page-header';
import {
  PO_CONFIDENCE_THRESHOLD,
  PO_FIELD_LABELS,
  findDuplicatePo,
  type DuplicateCandidate,
  type PoItem,
  type PoShipmentData,
  type ShipmentPoReview,
} from '../../_shared/demo/shipment-po-review';
import type { PoDocumentPreview } from '../../_shared/demo/shipment-po-read';
import { PO_REVIEW_SLA_LABEL } from '../../_shared/demo/shipment-po-labels';

const MODALS = [
  { value: 'MARITIMO', label: 'Marítimo' },
  { value: 'AEREO', label: 'Aéreo' },
  { value: 'RODOVIARIO', label: 'Rodoviário' },
];

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'];

/** Um id estável para uma linha nova, sem depender do índice. */
let itemSeq = 0;
const newItem = (): PoItem => ({
  id: `po-item-new-${(itemSeq += 1)}`,
  partNumber: '',
  description: '',
  currency: 'USD',
  quantity: null,
  unitValue: null,
  netWeightKg: null,
  totalValue: null,
  grossWeightKg: null,
});

function AmberHint({ confidence }: { confidence: number | undefined }) {
  if (confidence == null || confidence >= PO_CONFIDENCE_THRESHOLD) return null;
  return (
    <span className="portal-small ml-1.5 rounded bg-portal-warning/20 px-1.5 py-0.5 font-medium text-portal-warning-ink">
      {Math.round(confidence * 100)}%
    </span>
  );
}

/** O PO anexado, ao lado do formulário. Renderização fictícia, sem PDF real. */
function AttachedPo({
  attachmentName,
  preview,
}: {
  attachmentName: string | null;
  preview: PoDocumentPreview | null;
}) {
  if (!attachmentName) {
    return (
      <section className="portal-card-muted p-5">
        <h2 className="portal-h3">Sem PO anexado</h2>
        <p className="portal-small mt-1 text-portal-neutral">
          Você está preenchendo manualmente. O PO pode ser anexado depois, no
          detalhe do embarque.
        </p>
      </section>
    );
  }
  return (
    <section className="portal-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="portal-h3">PO anexado</h2>
        <span className="portal-small truncate text-portal-neutral">
          {attachmentName}
        </span>
      </div>
      {preview && (
        <div className="portal-card-muted mt-3 space-y-1.5 p-3">
          <p className="portal-small font-semibold uppercase tracking-wide text-foreground">
            {preview.title}
          </p>
          {preview.exporter && (
            <p className="portal-small text-portal-neutral">
              {preview.exporter}
              {preview.incoterm ? ` · Incoterm ${preview.incoterm}` : ''}
            </p>
          )}
          {preview.lines.map((line) => (
            <p
              key={line.text}
              className={cn(
                'portal-small',
                line.lowConfidence
                  ? 'rounded bg-portal-warning/20 px-1.5 py-1 text-portal-warning-ink'
                  : 'text-portal-neutral',
              )}
            >
              {line.text}
            </p>
          ))}
          <p className="portal-small pt-1 text-portal-neutral">
            {preview.footer}
          </p>
        </div>
      )}
      <p className="portal-small mt-3 text-portal-neutral">
        Campos em âmbar têm leitura com baixa confiança. Confira antes de
        enviar.
      </p>
    </section>
  );
}

export function PoForm({
  review,
  preview,
  candidates,
  onSaveDraft,
  onSubmit,
}: {
  review: ShipmentPoReview;
  /**
   * A renderização fictícia do documento, ao lado do formulário.
   *
   * Vem da leitura e NÃO é guardada no overlay: é um adereço de tela, e
   * gravá-la faria o `localStorage` carregar o documento inteiro por embarque.
   * Um rascunho retomado depois mostra o anexo pelo nome, sem a pré-visualização
   * — que é o que o cliente já viu e conferiu.
   */
  preview: PoDocumentPreview | null;
  /** Embarques que já existem, para o dedup (RQ-5). */
  candidates: DuplicateCandidate[];
  onSaveDraft: (data: PoShipmentData) => void;
  onSubmit: (data: PoShipmentData) => void;
}) {
  const [data, setData] = useState<PoShipmentData>(review.data);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateAccepted, setDuplicateAccepted] = useState(false);

  const po = data.poNumbers[0] ?? '';
  const duplicate = useMemo(
    () => findDuplicatePo(po, candidates),
    [po, candidates],
  );
  // O alerta só some quando o cliente resolve: trocar o PO ou confirmar.
  const blockedByDuplicate = !!duplicate && !duplicateAccepted;

  const patch = (next: Partial<PoShipmentData>) =>
    setData((current) => ({ ...current, ...next }));

  const setPo = (value: string) => {
    setDuplicateAccepted(false);
    patch({ poNumbers: value ? [value] : [] });
  };

  const patchItem = (id: string, next: Partial<PoItem>) =>
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...next } : item,
      ),
    }));

  const num = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  // O mínimo para enviar: PO, REF e ao menos um item (o "dado mínimo" do
  // RQ-10), mais o que o backend exige hoje (estilo, modal e, se marítimo,
  // tipo de carga).
  const missing: string[] = [];
  if (!po.trim()) missing.push('poNumbers');
  if (!data.clientRef.trim()) missing.push('clientRef');
  if (data.items.length === 0) missing.push('items');
  if (!data.despacho) missing.push('despacho');
  if (!data.modal) missing.push('modal');
  if (data.modal === 'MARITIMO' && !data.tipoEmbarque) {
    missing.push('tipoEmbarque');
  }

  const fieldClass = (field: string) =>
    cn(
      review.fieldsToFix.includes(field) && 'border-portal-warning',
      (review.confidence[field] ?? 1) < PO_CONFIDENCE_THRESHOLD &&
        'border-portal-warning bg-portal-warning/10',
    );

  const returned = review.stage === 'returned';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-6">
        {returned && review.returnReason && (
          <div
            role="status"
            className="flex gap-2.5 rounded-lg border border-portal-warning/40 bg-portal-warning/10 px-4 py-3"
          >
            <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-portal-warning-ink" />
            <div className="min-w-0">
              <p className="portal-body font-medium text-portal-warning-ink">
                A Freitas devolveu este embarque para ajuste
              </p>
              <p className="portal-small text-portal-warning-ink">
                {review.returnReason}
              </p>
              {review.fieldsToFix.length > 0 && (
                <p className="portal-small mt-1 text-portal-warning-ink">
                  Campos a corrigir:{' '}
                  {review.fieldsToFix
                    .map((field) => PO_FIELD_LABELS[field] ?? field)
                    .join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        <section className="portal-card p-5">
          <SectionHeading title="Dados do embarque" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="po-number" className="portal-small">
                Nº do PO *
              </Label>
              {/* PO SELECIONÁVEL (RQ-10): uma lista dos POs que o cliente já
                  tem, mais a opção de criar um novo. Não é texto livre — é o
                  que permite o dedup rodar sobre um registro. No backend real
                  isso é uma tabela; aqui a lista sai dos embarques existentes. */}
              <Input
                id="po-number"
                list="po-known"
                value={po}
                onChange={(event) => setPo(event.target.value)}
                placeholder="PO-2026-0000"
                className={cn(
                  fieldClass('poNumbers'),
                  duplicate && 'border-portal-danger',
                )}
              />
              <datalist id="po-known">
                {Array.from(
                  new Set(candidates.flatMap((c) => c.poNumbers)),
                ).map((known) => (
                  <option key={known} value={known} />
                ))}
              </datalist>
              {duplicate ? (
                <button
                  type="button"
                  onClick={() => setDuplicateOpen(true)}
                  className="portal-small flex items-start gap-1.5 text-left font-medium text-portal-danger"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Já existe o embarque {duplicate.reference} (
                    {duplicate.stateLabel}) com este PO.
                  </span>
                </button>
              ) : po.trim() ? (
                <p className="portal-small text-portal-success">
                  Nenhum embarque encontrado com este PO.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="po-ref" className="portal-small">
                REF do cliente *
              </Label>
              <Input
                id="po-ref"
                value={data.clientRef}
                onChange={(event) => patch({ clientRef: event.target.value })}
                className={fieldClass('clientRef')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="po-exporter" className="portal-small">
                Exportador
                <AmberHint confidence={review.confidence.exporter} />
              </Label>
              <Input
                id="po-exporter"
                value={data.exporter}
                onChange={(event) => patch({ exporter: event.target.value })}
                className={fieldClass('exporter')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="po-despacho" className="portal-small">
                Estilo do processo *
              </Label>
              <Select
                value={data.despacho || undefined}
                onValueChange={(value) =>
                  patch({ despacho: value as PoShipmentData['despacho'] })
                }
              >
                <SelectTrigger id="po-despacho" className={fieldClass('despacho')}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRETO">Direto</SelectItem>
                  <SelectItem value="CONSOLIDADO">Consolidado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="po-modal" className="portal-small">
                Modal *
              </Label>
              <Select
                value={data.modal || undefined}
                onValueChange={(value) =>
                  patch({
                    modal: value as PoShipmentData['modal'],
                    // Tipo de carga só existe no marítimo; trocar de modal
                    // limpa o campo em vez de deixá-lo pendurado.
                    tipoEmbarque: value === 'MARITIMO' ? data.tipoEmbarque : '',
                  })
                }
              >
                <SelectTrigger id="po-modal" className={fieldClass('modal')}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MODALS.map((modal) => (
                    <SelectItem key={modal.value} value={modal.value}>
                      {modal.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {data.modal === 'MARITIMO' && (
              <div className="space-y-1.5">
                <Label htmlFor="po-tipo" className="portal-small">
                  Tipo de carga *
                </Label>
                <Select
                  value={data.tipoEmbarque || undefined}
                  onValueChange={(value) =>
                    patch({
                      tipoEmbarque: value as PoShipmentData['tipoEmbarque'],
                    })
                  }
                >
                  <SelectTrigger
                    id="po-tipo"
                    className={fieldClass('tipoEmbarque')}
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FCL">FCL</SelectItem>
                    <SelectItem value="LCL">LCL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="po-incoterm" className="portal-small">
                Incoterm
                <AmberHint confidence={review.confidence.incoterm} />
              </Label>
              <Select
                value={data.incoterm || undefined}
                onValueChange={(value) => patch({ incoterm: value })}
              >
                <SelectTrigger
                  id="po-incoterm"
                  className={fieldClass('incoterm')}
                >
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="po-innova" className="portal-small">
                Nº Innova
              </Label>
              <Input
                id="po-innova"
                value={data.innovaNumber}
                onChange={(event) =>
                  patch({ innovaNumber: event.target.value })
                }
                placeholder="Opcional"
              />
            </div>
          </div>
        </section>

        <section className="portal-card p-5">
          <SectionHeading
            title="Itens do PO"
            hint="só mostramos a confiança da leitura quando ela é baixa"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => patch({ items: [...data.items, newItem()] })}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar item
              </Button>
            }
          />
          {data.items.length === 0 ? (
            <p className="portal-small mt-4 text-portal-neutral">
              Nenhum item ainda. Use “Adicionar item” para incluir os SKUs do
              PO.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="portal-small text-left text-portal-neutral">
                    <th className="pb-2 pr-3 font-normal">SKU / Part number</th>
                    <th className="pb-2 pr-3 font-normal">Descrição</th>
                    <th className="pb-2 pr-3 font-normal">Moeda</th>
                    <th className="pb-2 pr-3 font-normal">
                      Qtd.
                      <AmberHint confidence={review.confidence.quantity} />
                    </th>
                    <th className="pb-2 pr-3 font-normal">Valor unit.</th>
                    <th className="pb-2 pr-3 font-normal">Peso líq.</th>
                    <th className="pb-2 pr-3 font-normal">Valor total</th>
                    <th className="pb-2 pr-3 font-normal">
                      Peso bruto
                      <AmberHint confidence={review.confidence.grossWeightKg} />
                    </th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-t border-border/60">
                      <td className="py-2 pr-3">
                        <Input
                          aria-label="SKU / Part number"
                          value={item.partNumber}
                          onChange={(e) =>
                            patchItem(item.id, { partNumber: e.target.value })
                          }
                          className="h-9 min-w-24"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label="Descrição"
                          value={item.description}
                          onChange={(e) =>
                            patchItem(item.id, { description: e.target.value })
                          }
                          className="h-9 min-w-40"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label="Moeda"
                          value={item.currency}
                          onChange={(e) =>
                            patchItem(item.id, { currency: e.target.value })
                          }
                          className="h-9 w-20"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label="Quantidade"
                          inputMode="numeric"
                          value={item.quantity ?? ''}
                          onChange={(e) =>
                            patchItem(item.id, { quantity: num(e.target.value) })
                          }
                          className={cn(
                            'h-9 w-24',
                            (review.confidence.quantity ?? 1) <
                              PO_CONFIDENCE_THRESHOLD &&
                              'border-portal-warning bg-portal-warning/10',
                          )}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label="Valor unitário"
                          inputMode="decimal"
                          value={item.unitValue ?? ''}
                          onChange={(e) =>
                            patchItem(item.id, {
                              unitValue: num(e.target.value),
                            })
                          }
                          className="h-9 w-24"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label="Peso líquido"
                          inputMode="decimal"
                          value={item.netWeightKg ?? ''}
                          onChange={(e) =>
                            patchItem(item.id, {
                              netWeightKg: num(e.target.value),
                            })
                          }
                          className="h-9 w-24"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label="Valor total"
                          inputMode="decimal"
                          value={item.totalValue ?? ''}
                          onChange={(e) =>
                            patchItem(item.id, {
                              totalValue: num(e.target.value),
                            })
                          }
                          className="h-9 w-28"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label="Peso bruto"
                          inputMode="decimal"
                          value={item.grossWeightKg ?? ''}
                          onChange={(e) =>
                            patchItem(item.id, {
                              grossWeightKg: num(e.target.value),
                            })
                          }
                          className={cn(
                            'h-9 w-24',
                            (review.confidence.grossWeightKg ?? 1) <
                              PO_CONFIDENCE_THRESHOLD &&
                              'border-portal-warning bg-portal-warning/10',
                          )}
                        />
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${item.partNumber || 'item'}`}
                          onClick={() =>
                            patch({
                              items: data.items.filter((i) => i.id !== item.id),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="portal-card p-5">
          <SectionHeading title="Observações" />
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="po-observation" className="portal-small">
                Observação para a Freitas
              </Label>
              <Textarea
                id="po-observation"
                value={data.observation}
                onChange={(event) => patch({ observation: event.target.value })}
                placeholder="Ex.: carga com prazo crítico"
                className={fieldClass('observation')}
                rows={2}
              />
            </div>
            <label className="portal-body flex items-center gap-2.5 sm:self-end sm:pb-2">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                checked={data.urgent}
                onChange={(event) => patch({ urgent: event.target.checked })}
              />
              Carga urgente
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {missing.length > 0 && (
            <p className="portal-small mr-auto text-portal-neutral">
              Falta preencher:{' '}
              {missing.map((f) => PO_FIELD_LABELS[f] ?? f).join(', ')}.
            </p>
          )}
          <Button variant="outline" onClick={() => onSaveDraft(data)}>
            Salvar rascunho
          </Button>
          <Button
            disabled={missing.length > 0 || blockedByDuplicate}
            onClick={() => onSubmit(data)}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {returned ? 'Corrigir e reenviar' : 'Enviar à Freitas'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <AttachedPo
          attachmentName={review.attachmentName}
          preview={review.attachmentName ? preview : null}
        />

        <section className="portal-card p-5">
          <h2 className="portal-h3">O que acontece depois</h2>
          <ol className="mt-3 space-y-3">
            {[
              {
                title: 'Você envia',
                body: 'O embarque nasce como “Em análise”.',
              },
              {
                title: 'A Freitas revisa',
                body: `Valida os dados ou devolve com o motivo. Prazo: ${PO_REVIEW_SLA_LABEL}.`,
              },
              {
                title: 'Embarque ativo',
                body: 'Você acompanha em Meus Embarques.',
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="portal-small mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-portal-neutral"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="portal-body block font-medium text-foreground">
                    {step.title}
                  </span>
                  <span className="portal-small block text-portal-neutral">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Tela 5 — PO duplicado. Não bloqueia, mas exige confirmação. */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Já existe um embarque para este PO</DialogTitle>
            <DialogDescription>
              O {po} já está no {duplicate?.reference}. Cada PO costuma ter um
              só embarque. Confirme antes de criar outro.
            </DialogDescription>
          </DialogHeader>

          {duplicate && (
            <div className="portal-card-muted flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="portal-body font-medium text-foreground">
                  {duplicate.reference} · {duplicate.route}
                </p>
                <p className="portal-small text-portal-neutral">
                  Criado em {formatShortDate(duplicate.createdAt)}
                </p>
              </div>
              <span className="portal-small rounded bg-muted px-1.5 py-0.5 text-portal-neutral">
                {duplicate.stateLabel}
              </span>
            </div>
          )}

          <label className="portal-body flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              checked={duplicateAccepted}
              onChange={(event) => setDuplicateAccepted(event.target.checked)}
            />
            Confirmo que este PO precisa de um novo embarque
          </label>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={!duplicateAccepted}
              onClick={() => setDuplicateOpen(false)}
            >
              Criar mesmo assim
            </Button>
            {duplicate && (
              <Button asChild>
                <Link href={`/portal/embarques/${duplicate.id}`}>
                  Ver o {duplicate.reference}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
