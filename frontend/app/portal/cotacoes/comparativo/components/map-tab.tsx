'use client';

// Aba "Mapa": o comparativo lado a lado, uma coluna por proposta, como o cliente
// já recebe hoje. Primeira coluna fixa (rótulos) e rolagem horizontal do
// CONTÊINER da tabela, nunca da página, a partir de 5 propostas ou no celular.

import { useState, type ReactNode } from 'react';
import { Check, Download, FileSpreadsheet, FileText, Mail, X } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  FREQUENCY_LABELS,
  MISSING,
  ROUTE_LABELS,
  estimatedArrival,
  formatArrival,
  formatMoney,
  formatMultiCurrency,
  formatShortDate,
  isExpired,
  orMissing,
  proposalTotals,
  type ComparisonProposal,
  type ComparisonQuotation,
  type FactualBadges,
  type ProposalDocument,
  type SortKey,
} from '../lib/comparison-model';
import { BadgeLegend, ProposalBadge } from './proposal-badges';

interface MapTabProps {
  quotation: ComparisonQuotation;
  sorted: ComparisonProposal[];
  labels: Record<string, string>;
  badges: FactualBadges;
  today: string;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  /** Só quando o analista aprovou. */
  recommendedId: string | null;
  chosenId: string | null;
  onApprove: (id: string) => void;
}

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'preco', label: 'Menor preço' },
  { id: 'prazo', label: 'Menor prazo' },
];

function previewToast(what: string) {
  toast.info(`Prévia: ${what} não está disponível nesta demonstração.`);
}

function DocIcon({ kind }: { kind: ProposalDocument['kind'] }) {
  if (kind === 'xlsx') return <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />;
  if (kind === 'eml') return <Mail className="h-4 w-4 shrink-0" aria-hidden />;
  return <FileText className="h-4 w-4 shrink-0" aria-hidden />;
}

export function FileChip({ doc }: { doc: ProposalDocument }) {
  return (
    <button
      type="button"
      onClick={() => previewToast(`o download de ${doc.name}`)}
      className="portal-small inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-left text-brand-indigo hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={doc.name}
    >
      <DocIcon kind={doc.kind} />
      <span className="truncate">{doc.name}</span>
    </button>
  );
}

function Observations({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  const decoded = orMissing(text);
  if (decoded === MISSING) return <>{MISSING}</>;
  const long = decoded.length > 90;
  return (
    <div className="space-y-1">
      <p className={cn('whitespace-pre-line', !open && long && 'line-clamp-3')}>{decoded}</p>
      {long ? (
        <button
          type="button"
          className="portal-small font-medium text-brand-indigo underline underline-offset-2"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Ver menos' : 'Ver mais'}
        </button>
      ) : null}
    </div>
  );
}

interface Row {
  label: string;
  note?: string;
  emphasis?: boolean;
  render: (p: ComparisonProposal) => ReactNode;
}

export function MapTab({
  quotation,
  sorted,
  labels,
  badges,
  today,
  sortKey,
  onSortChange,
  recommendedId,
  chosenId,
  onApprove,
}: MapTabProps) {
  const { request } = quotation;
  const totals = Object.fromEntries(
    sorted.map((p) => [p.id, proposalTotals(p, request.ptax)]),
  );
  const ptaxNote = `aprox. à taxa PTAX de ${formatShortDate(request.ptaxDate)} (USD ${request.ptax.USD.toLocaleString('pt-BR')} · EUR ${request.ptax.EUR.toLocaleString('pt-BR')})`;

  const rows: Row[] = [
    { label: 'Tipo de embarque', render: (p) => orMissing(p.shipmentType) },
    { label: 'Incoterm', render: (p) => orMissing(p.incoterm) },
    { label: 'Local de embarque', render: (p) => orMissing(p.portOfLoading) },
    { label: 'Local de desembarque', render: (p) => orMissing(p.portOfDischarge) },
    { label: 'Rota', render: (p) => (p.route ? ROUTE_LABELS[p.route] : MISSING) },
    {
      label: 'Transbordo/Conexão',
      note: 'Informativo, não define o porto de desembarque.',
      render: (p) => orMissing(p.transshipment),
    },
    { label: 'Frequência', render: (p) => (p.frequency ? FREQUENCY_LABELS[p.frequency] : MISSING) },
    {
      label: 'Free time',
      render: (p) => (p.freeTimeDays == null ? MISSING : `${p.freeTimeDays} dias`),
    },
    {
      label: 'Transit time (dias)',
      note: 'Entre portos.',
      render: (p) => orMissing(p.transitDays),
    },
    {
      label: 'Chegada estimada',
      render: (p) => formatArrival(estimatedArrival(p, today)),
    },
    { label: 'Armador/CIA', render: (p) => orMissing(p.carrier) },
    {
      label: 'Validade',
      render: (p) =>
        p.validUntil == null ? (
          MISSING
        ) : (
          <span className={cn(isExpired(p, today) && 'text-portal-danger-ink')}>
            {formatShortDate(p.validUntil)}
            {isExpired(p, today) ? ' · vencida' : ''}
          </span>
        ),
    },
    {
      label: 'Seguro incluso',
      render: (p) =>
        p.insuranceIncluded ? (
          <span className="inline-flex items-center gap-1 text-portal-success-ink">
            <Check className="h-4 w-4" aria-hidden /> Sim
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-portal-neutral">
            <X className="h-4 w-4" aria-hidden /> Não
          </span>
        ),
    },
    { label: 'Taxas de origem', render: (p) => formatMultiCurrency(totals[p.id].origin) },
    { label: 'Frete internacional', render: (p) => formatMultiCurrency(totals[p.id].freight) },
    { label: 'Taxas de destino', render: (p) => formatMultiCurrency(totals[p.id].destination) },
    {
      label: 'TOTAL ALL IN',
      note: 'Por moeda, seguro incluído quando contabilizado.',
      emphasis: true,
      render: (p) => formatMultiCurrency(totals[p.id].allIn),
    },
    {
      label: 'TOTAL EM BRL',
      note: ptaxNote,
      emphasis: true,
      render: (p) => {
        const brl = totals[p.id].brl;
        return brl == null ? MISSING : formatMoney('BRL', brl);
      },
    },
    { label: 'Observações', render: (p) => <Observations text={p.observations} /> },
    {
      label: 'Documentos',
      render: (p) =>
        p.documents.length ? (
          <div className="flex flex-col items-start gap-1">
            {p.documents.map((d) => (
              <FileChip key={d.name} doc={d} />
            ))}
          </div>
        ) : (
          MISSING
        ),
    },
  ];

  const columnClass = (p: ComparisonProposal) =>
    cn(
      'min-w-[13rem] max-w-[16rem] border-b border-l border-border px-4 py-2 align-top',
      p.id === chosenId && 'bg-portal-success/5',
      isExpired(p, today) && 'text-portal-neutral',
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2" role="group" aria-label="Ordenar colunas">
          <span className="portal-small text-portal-neutral">Ordenar por</span>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={sortKey === o.id}
                onClick={() => onSortChange(o.id)}
                className={cn(
                  'portal-small rounded-md px-3 py-1.5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  sortKey === o.id
                    ? 'bg-brand-indigo-100 text-brand-indigo'
                    : 'text-portal-neutral hover:text-brand-indigo',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <BadgeLegend />
      </div>

      {sorted.length > 3 ? (
        <p className="portal-small text-portal-neutral">
          {sorted.length} propostas. Role a tabela para os lados para ver todas; a primeira coluna fica fixa.
        </p>
      ) : null}
      <div className="portal-card overflow-hidden p-0">
        <div className="overflow-x-auto" tabIndex={0} aria-label="Tabela comparativa, role para os lados">
          <table className="portal-body w-full border-separate border-spacing-0">
            <caption className="sr-only">
              Comparativo das {sorted.length} propostas da cotação {request.reference}, ordenado por{' '}
              {sortKey === 'preco' ? 'menor preço' : 'menor prazo'}.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 min-w-[8rem] sm:min-w-[10rem] border-b border-border bg-card px-4 py-3 text-left align-bottom"
                >
                  <span className="portal-small font-medium text-portal-neutral">Proposta</span>
                </th>
                {sorted.map((p) => (
                  <th key={p.id} scope="col" className={cn(columnClass(p), 'py-3 text-left font-normal')}>
                    <div className="space-y-2">
                      <div className="portal-h3">{labels[p.id]}</div>
                      <div className="flex flex-wrap gap-1">
                        {p.id === chosenId ? <ProposalBadge kind="escolhida" /> : null}
                        {p.id === recommendedId ? <ProposalBadge kind="recomendada" /> : null}
                        {badges.cheapest.has(p.id) ? <ProposalBadge kind="menorPreco" /> : null}
                        {badges.fastest.has(p.id) ? <ProposalBadge kind="menorPrazo" /> : null}
                        {isExpired(p, today) ? (
                          <span className="portal-small text-portal-danger-ink">Proposta vencida</span>
                        ) : null}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={cn(row.emphasis && 'bg-muted/40')}>
                  <th
                    scope="row"
                    className={cn(
                      'sticky left-0 z-10 max-w-[9rem] border-b border-border px-4 py-2 text-left align-top font-medium sm:max-w-none',
                      row.emphasis ? 'bg-muted text-brand-indigo' : 'bg-card',
                    )}
                  >
                    <span className="block">{row.label}</span>
                    {row.note ? (
                      <span className="portal-small block font-normal text-portal-neutral">{row.note}</span>
                    ) : null}
                  </th>
                  {sorted.map((p) => (
                    <td key={p.id} className={cn(columnClass(p), row.emphasis && 'font-semibold text-brand-indigo')}>
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-left align-top font-medium">
                  <span className="sr-only">Ação</span>
                </th>
                {sorted.map((p) => {
                  const expired = isExpired(p, today);
                  const decided = chosenId != null;
                  return (
                    <td key={p.id} className={cn(columnClass(p), 'border-b-0 py-3')}>
                      {p.id === chosenId ? (
                        <span className="portal-small inline-flex items-center gap-1 font-medium text-portal-success-ink">
                          <Check className="h-4 w-4" aria-hidden /> Proposta aprovada
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="w-full"
                          variant={decided || expired ? 'outline' : 'default'}
                          disabled={decided || expired}
                          onClick={() => onApprove(p.id)}
                          aria-label={`Aprovar esta proposta: ${labels[p.id]}`}
                        >
                          Aprovar esta proposta
                        </Button>
                      )}
                      {expired && p.id !== chosenId ? (
                        <p className="portal-small mt-1 text-portal-neutral">Vencida, não pode ser aprovada.</p>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="portal-card-muted space-y-2 p-6" aria-labelledby="chegada-title">
          <h3 id="chegada-title" className="portal-h3">Chegada estimada</h3>
          <ul className="space-y-1">
            {sorted.map((p) => (
              <li key={p.id} className="flex flex-col sm:flex-row sm:justify-between sm:gap-4">
                <span className="font-medium">{labels[p.id]}</span>
                <span className="text-portal-neutral sm:text-right">{formatArrival(estimatedArrival(p, today))}</span>
              </li>
            ))}
          </ul>
          <p className="portal-small text-portal-neutral">
            Próxima saída informada pelo agente mais o transit time entre portos. Sem data de saída, conta só o trânsito.
          </p>
        </section>

        <section className="portal-card-muted space-y-2 p-6" aria-labelledby="docs-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="docs-title" className="portal-h3">Documentos da cotação</h3>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => previewToast('o download de todos os arquivos')}>
              <Download className="h-4 w-4" aria-hidden /> Baixar todos
              <span className="portal-small rounded-full bg-brand-indigo-100 px-1.5 text-brand-indigo">Prévia</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {request.quotationDocuments.map((d) => (
              <FileChip key={d.name} doc={d} />
            ))}
          </div>
        </section>

        <section className="portal-card-muted space-y-2 p-6" aria-labelledby="agentes-title">
          <h3 id="agentes-title" className="portal-h3">Cotação dos agentes</h3>
          <ul className="space-y-2">
            {quotation.proposals.map((p) => (
              <li key={p.id} className="space-y-1">
                <span className="font-medium">{labels[p.id]}</span>
                <div className="flex flex-wrap gap-2">
                  {p.documents.length ? (
                    p.documents.map((d) => <FileChip key={d.name} doc={d} />)
                  ) : (
                    <span className="portal-small text-portal-neutral">Nenhum arquivo enviado.</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="portal-card-muted space-y-2 p-6" aria-labelledby="termos-title">
          <h3 id="termos-title" className="portal-h3">Termos e responsabilidades</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>A Freitas atua como intermediária entre você e os agentes de carga que cotaram.</li>
            <li>A decisão final e a responsabilidade pela contratação são do contratante.</li>
            <li>
              Em embarques LCL, a armazenagem em terminal secundário no destino pode alterar o custo total.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
