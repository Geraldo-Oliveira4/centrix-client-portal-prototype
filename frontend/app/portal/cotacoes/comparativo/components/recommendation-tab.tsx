'use client';

// Aba "Recomendação IA". A ÚNICA superfície do portal com nota de IA, e ela
// compara PROPOSTAS desta cotação — nunca agentes (ver o Histórico do agente).
//
// Antes da aprovação do analista a aba não mostra nada além do estado: nem
// nota, nem ranking, nem a dica de qual é. `recommendationView` devolve um
// objeto sem o resultado nesse caso, então não há o que vazar daqui.

import { Clock3, Info, Sparkles } from 'lucide-react';

import {
  COST_EQUIVALENCE_PCT,
  CRITERIA,
  CRITERION_WEIGHTS,
  FREE_TIME_EQUIVALENCE_DAYS,
  RECOMMENDATION_PRICE_WINDOW_PCT,
  TRANSIT_EQUIVALENCE_DAYS,
  VALIDITY_EQUIVALENCE_BUSINESS_DAYS,
  type RecommendationView,
  type ScoredProposal,
} from '../lib/recommendation-engine';
import {
  MISSING,
  formatMoney,
  formatShortDate,
} from '../lib/comparison-model';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function brl(s: ScoredProposal) {
  return s.totalBrl == null ? MISSING : formatMoney('BRL', s.totalBrl);
}

function CriterionBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const v = Math.round(value);
  return (
    <div className="space-y-1">
      <div className="portal-small flex justify-between gap-2">
        <span className="font-medium text-foreground">
          {label} <span className="font-normal text-portal-neutral">· peso {weight}%</span>
        </span>
        <span className="tabular-nums text-brand-indigo">{v}/100</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-brand-indigo-100"
        role="meter"
        aria-label={`${label}: ${v} de 100`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
      >
        <div className="h-full rounded-full bg-brand-indigo" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function OthersList({
  view,
  labels,
  recommendedId,
}: {
  view: Extract<RecommendationView, { state: 'disponivel' | 'sem_recomendacao' }>;
  labels: Record<string, string>;
  recommendedId: string | null;
}) {
  const others = view.result.ranked.filter((s) => s.proposal.id !== recommendedId);
  if (!others.length) return null;
  return (
    <section className="portal-card space-y-4 p-6" aria-labelledby="outras-title">
      <h3 id="outras-title" className="portal-h3">
        {recommendedId ? 'As outras propostas, por nota' : 'Propostas recebidas'}
      </h3>
      <ol className="divide-y divide-border">
        {others.map((s) => (
          <li key={s.proposal.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <div className="min-w-0">
              <span className="font-medium">{labels[s.proposal.id]}</span>
              <span className="portal-small block text-portal-neutral">
                {s.eligible
                  ? [
                      brl(s),
                      s.proposal.route === 'transbordo' ? 'com transbordo' : null,
                      !s.inPriceWindow && s.aboveCheapestPct != null
                        ? `${pct(s.aboveCheapestPct)} acima da mais barata, fora da janela de ${pct(RECOMMENDATION_PRICE_WINDOW_PCT)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : s.reasons.join(' · ')}
              </span>
            </div>
            {s.eligible ? (
              <span className="portal-h3 tabular-nums">{s.score}/100</span>
            ) : (
              <span className="portal-small rounded-full border border-border px-2 py-0.5 text-portal-neutral">
                Não elegível
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function HowWeCalculate() {
  return (
    <section className="portal-card-muted space-y-4 p-6" aria-labelledby="como-title">
      <h3 id="como-title" className="portal-h3">Como calculamos</h3>
      <div className="overflow-x-auto">
        <table className="portal-body w-full text-left">
          <caption className="sr-only">Critérios e pesos da nota</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-4 font-medium">Critério</th>
              <th scope="col" className="py-2 pr-4 font-medium">Peso</th>
              <th scope="col" className="py-2 font-medium">Como pontua</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 pr-4 font-medium">{c.label}</th>
                <td className="py-2 pr-4 tabular-nums">{CRITERION_WEIGHTS[c.id]}%</td>
                <td className="py-2 text-portal-neutral">{c.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="portal-small list-disc space-y-1 pl-5 text-portal-neutral">
        <li>
          Custo, transit time, free time e validade são relativos às propostas desta cotação: a melhor do grupo vale
          100 e a pior vale 0.
        </li>
        <li>
          Contam como equivalentes à melhor: custo até {pct(COST_EQUIVALENCE_PCT)} acima do menor total; até{' '}
          {TRANSIT_EQUIVALENCE_DAYS} dia a mais de transit time; até {FREE_TIME_EQUIVALENCE_DAYS} dias a menos de free
          time; até {VALIDITY_EQUIVALENCE_BUSINESS_DAYS} dias úteis a menos de validade.
        </li>
        <li>Free time não informado conta como 0 dia. Critério que nenhuma proposta informou vale 100 para todas.</li>
        <li>
          Não podem ser recomendadas: proposta vencida, proposta sem o seguro exigido nesta cotação e proposta com
          pendência de auditoria alta ou crítica.
        </li>
      </ul>
    </section>
  );
}

export function RecommendationTab({
  view,
  labels,
}: {
  view: RecommendationView;
  labels: Record<string, string>;
}) {
  if (view.state === 'em_revisao') {
    return (
      <div className="portal-card flex items-start gap-4 p-6" role="status">
        <Clock3 className="h-6 w-6 shrink-0 text-portal-neutral" aria-hidden />
        <p className="portal-body">
          Recomendação em revisão pela equipe Freitas. Você será avisado quando estiver disponível.
        </p>
      </div>
    );
  }

  if (view.state === 'sem_recomendacao') {
    return (
      <div className="space-y-4">
        <div className="portal-card flex items-start gap-4 p-6" role="status">
          <Info className="h-6 w-6 shrink-0 text-portal-neutral" aria-hidden />
          <p className="portal-body">
            Nenhuma proposta desta cotação pode ser recomendada. Os motivos estão abaixo.
          </p>
        </div>
        <OthersList view={view} labels={labels} recommendedId={null} />
        <HowWeCalculate />
      </div>
    );
  }

  const rec = view.recommended;
  const p = rec.proposal;
  return (
    <div className="space-y-4">
      <section className="portal-card space-y-6 p-6" aria-labelledby="recomendada-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="portal-small inline-flex items-center gap-1 rounded-full border border-portal-info/30 bg-portal-info/10 px-2 py-0.5 text-portal-info">
              <Sparkles className="h-4 w-4" aria-hidden /> Recomendada · aprovada pela equipe Freitas
            </span>
            <h3 id="recomendada-title" className="portal-h2">{labels[p.id]}</h3>
          </div>
          <div className="text-right">
            <div className="portal-h1 tabular-nums text-brand-indigo">
              {rec.score}
              <span className="portal-h3 text-portal-neutral">/100</span>
            </div>
            <span className="portal-small text-portal-neutral">nota geral</span>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="portal-small text-portal-neutral">Valor total</dt>
            <dd className="portal-h3">{brl(rec)}</dd>
          </div>
          <div>
            <dt className="portal-small text-portal-neutral">Transit time</dt>
            <dd className="portal-h3">{p.transitDays == null ? MISSING : `${p.transitDays} dias`}</dd>
          </div>
          <div>
            <dt className="portal-small text-portal-neutral">Validade</dt>
            <dd className="portal-h3">{p.validUntil ? formatShortDate(p.validUntil) : MISSING}</dd>
          </div>
        </dl>

        <p className="portal-body">{view.justification}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          {CRITERIA.map((c) => (
            <CriterionBar key={c.id} label={c.label} value={rec.criteria[c.id]} weight={CRITERION_WEIGHTS[c.id]} />
          ))}
        </div>

        <p className="portal-small flex items-start gap-2 rounded-lg bg-brand-indigo-100 p-4 text-brand-indigo">
          <Info className="h-4 w-4 shrink-0" aria-hidden />
          A recomendada pode não ser a maior nota: a escolha considera ofertas até 10% acima da mais barata elegível e
          prioriza rota direta.
        </p>
      </section>

      <OthersList view={view} labels={labels} recommendedId={p.id} />
      <HowWeCalculate />
    </div>
  );
}
