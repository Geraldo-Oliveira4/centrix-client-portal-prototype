'use client';

// Comparativo de propostas (06/10/2026) — a proposta comercial como o cliente a
// recebe hoje, com a Recomendação IA (com nota, só depois da aprovação do
// analista) e o Histórico do agente (fatos, sem nota).
//
// FIXTURE, SEM API: duas cotações fictícias (`lib/fixtures.ts`). Aprovar, baixar
// PDF e baixar arquivos são simulados e não gravam nada. Estado na URL:
// `?cotacao=COT-DEMO-xxxx&aba=mapa|recomendacao|historico&ordem=preco|prazo`.

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Download, Info } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import {
  COMPARISON_TABS,
  MISSING,
  factualBadges,
  formatLongDate,
  formatMoney,
  formatShortDate,
  parseSortKey,
  parseTab,
  proposalLabels,
  proposalTotals,
  sortProposals,
  type ComparisonTab,
  type SortKey,
} from './lib/comparison-model';
import { comparisonFixtures, findComparison } from './lib/fixtures';
import { recommendationView } from './lib/recommendation-engine';
import { useAnalystApproval } from './lib/use-analyst-approval';
import { AgentHistoryTab } from './components/agent-history-tab';
import { ApproveProposalDialog } from './components/approve-proposal-dialog';
import { MapTab } from './components/map-tab';
import { RecommendationTab } from './components/recommendation-tab';

function localToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

function RequestSummary({
  rows,
  linkValidUntil,
}: {
  rows: [string, string][];
  linkValidUntil: string;
}) {
  return (
    <aside className="portal-card-muted space-y-4 p-6" aria-labelledby="resumo-title">
      <h2 id="resumo-title" className="portal-h3">Resumo da solicitação</h2>
      <dl className="portal-body space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2 lg:grid-cols-1 lg:gap-0">
            <dt className="portal-small text-portal-neutral">{k}</dt>
            <dd className="break-words font-medium">{v || MISSING}</dd>
          </div>
        ))}
      </dl>
      <p className="portal-small flex items-start gap-2 rounded-lg border border-border bg-card p-2 text-portal-neutral">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        Link válido até {formatShortDate(linkValidUntil)}. Depois disso, peça um novo à equipe Freitas.
      </p>
    </aside>
  );
}

export default function ComparisonScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [today] = useState(localToday);

  const reference = params.get('cotacao');
  const tab = parseTab(params.get('aba'));
  const sortKey = parseSortKey(params.get('ordem'));
  const quotation = useMemo(() => findComparison(reference, today), [reference, today]);
  const { request } = quotation;
  const analystApproved = useAnalystApproval();

  // Aprovação simulada, por cotação, só nesta sessão da tela.
  const [approvals, setApprovals] = useState<Record<string, string>>({});
  const [justApproved, setJustApproved] = useState<string | null>(null);
  const [dialogFor, setDialogFor] = useState<string | null>(null);
  const chosenId = approvals[request.reference] ?? quotation.chosenProposalId;

  const labels = useMemo(() => proposalLabels(quotation.proposals), [quotation]);
  const sorted = useMemo(
    () => sortProposals(quotation.proposals, request.ptax, sortKey, today),
    [quotation, request.ptax, sortKey, today],
  );
  const badges = useMemo(
    () => factualBadges(quotation.proposals, request.ptax, today),
    [quotation, request.ptax, today],
  );
  const view = useMemo(
    () => recommendationView(quotation, today, analystApproved, labels),
    [quotation, today, analystApproved, labels],
  );
  const recommendedId = view.state === 'disponivel' ? view.recommended.proposal.id : null;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const selectQuotation = (ref: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('cotacao', ref);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    setJustApproved(null);
  };

  const dialogProposal = quotation.proposals.find((p) => p.id === dialogFor) ?? null;
  const dialogTotal = dialogProposal ? proposalTotals(dialogProposal, request.ptax).brl : null;
  const chosenLabel = chosenId ? labels[chosenId] : null;

  const summaryRows: [string, string][] = [
    ['Referência', request.reference],
    ['Nº do pedido', request.orderNumber],
    ['Cliente', request.clientName],
    ['Serviço', request.service],
    ['Modal', request.modal],
    ['Tipo de embarque', request.shipmentType],
    ['Origem', request.origin],
    ['Destino', request.destination],
    ['Incoterm', request.incoterm],
    ['Produto', request.product],
    ['Volumes', request.volumes],
    ['Peso', request.weight],
    ['Exportador', request.exporter],
    ['País de procedência', request.countryOfOrigin],
    ['Seguro', request.insuranceRequired ? 'Exigido nesta cotação' : 'Não exigido'],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="portal-h1">Proposta comercial · {request.reference}</h1>
          <p className="portal-body text-portal-neutral">
            Olá, {request.contactFirstName}. Estas são as {quotation.proposals.length} propostas que recebemos para a
            sua solicitação. Compare e aprove a que fizer mais sentido para você.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => toast.info('Prévia: o PDF do comparativo ainda não é gerado nesta demonstração.')}
        >
          <Download className="h-5 w-5" aria-hidden />
          Baixar comparativo em PDF
          <span className="portal-small rounded-full bg-brand-indigo-100 px-1.5 text-brand-indigo">Prévia</span>
        </Button>
      </div>

      <div className="portal-small flex flex-wrap items-center gap-2 text-portal-neutral" role="group" aria-label="Cotação de exemplo">
        <span>Exemplos:</span>
        {comparisonFixtures(today).map((q) => (
          <button
            key={q.request.reference}
            type="button"
            aria-pressed={q.request.reference === request.reference}
            onClick={() => selectQuotation(q.request.reference)}
            className={cn(
              'rounded-full border px-2 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              q.request.reference === request.reference
                ? 'border-brand-indigo-800/40 bg-brand-indigo-100 font-medium text-brand-indigo'
                : 'border-border hover:bg-accent',
            )}
          >
            {q.request.reference} · {q.request.origin.split(',')[0]} → {q.request.destination.split(',')[0]}
          </button>
        ))}
      </div>

      {justApproved === request.reference ? (
        <div
          role="status"
          className="flex flex-wrap items-start gap-2 rounded-lg border border-portal-success/40 bg-portal-success/10 p-4 text-portal-success-ink"
        >
          <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden />
          <p className="portal-body flex-1 font-medium">
            Proposta aprovada com sucesso! Nossa equipe foi notificada e entrará em contato.
          </p>
          <span className="portal-small rounded-full bg-card px-2 py-0.5 text-portal-neutral">
            Prévia · simulado, nada foi enviado
          </span>
        </div>
      ) : chosenLabel ? (
        <div role="status" className="portal-body flex items-start gap-2 rounded-lg border border-border bg-card p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-portal-success-ink" aria-hidden />
          Você aprovou a proposta de {chosenLabel}. Nossa equipe está cuidando do próximo passo.
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <RequestSummary rows={summaryRows} linkValidUntil={request.linkValidUntil} />

        <Tabs value={tab} onValueChange={(v) => setParam('aba', v as ComparisonTab)} className="min-w-0 space-y-6">
          <TabsList aria-label="Seções da proposta" className="overflow-x-auto">
            {COMPARISON_TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="mapa">
            <MapTab
              quotation={quotation}
              sorted={sorted}
              labels={labels}
              badges={badges}
              today={today}
              sortKey={sortKey}
              onSortChange={(k: SortKey) => setParam('ordem', k)}
              recommendedId={recommendedId}
              chosenId={chosenId}
              onApprove={setDialogFor}
            />
          </TabsContent>
          <TabsContent value="recomendacao">
            <RecommendationTab view={view} labels={labels} />
          </TabsContent>
          <TabsContent value="historico">
            <AgentHistoryTab key={request.reference} proposals={quotation.proposals} />
          </TabsContent>
        </Tabs>
      </div>

      {dialogProposal ? (
        <ApproveProposalDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogFor(null);
          }}
          proposalLabel={labels[dialogProposal.id]}
          totalBrl={dialogTotal == null ? MISSING : formatMoney('BRL', dialogTotal)}
          transit={dialogProposal.transitDays == null ? MISSING : `${dialogProposal.transitDays} dias`}
          validity={dialogProposal.validUntil ? formatLongDate(dialogProposal.validUntil) : MISSING}
          onConfirm={() => {
            setApprovals((cur) => ({ ...cur, [request.reference]: dialogProposal.id }));
            setJustApproved(request.reference);
          }}
        />
      ) : null}
    </div>
  );
}
