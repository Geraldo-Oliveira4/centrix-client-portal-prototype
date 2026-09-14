'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Button } from '@/components/ui';
import { formatBRL, formatDate, formatRoute } from '@/lib/portal-formatters';
import type { PortalQuotation } from '@/types/portal';
import { useMyQuotation } from '@/hooks/use-portal-quotations';
import {
  closingDate,
  filterHistory,
  finalProposal,
  historyFilter,
  outcomes,
} from '../lib/history-model';
import s from './history.module.css';

function FinalCondition({ quotation: q }: { quotation: PortalQuotation }) {
  const known = finalProposal(q);
  // The list's best_proposal is cheapest, not necessarily the winner.
  const { quotation, isLoading, isError } = useMyQuotation(
    q.state === 'FECHADA' && !known ? q.id : null,
  );
  const final = known || (quotation ? finalProposal(quotation) : null);
  if (q.state !== 'FECHADA')
    return <span className="text-portal-neutral">Não houve contratação</span>;
  if (isLoading)
    return <span className="text-portal-neutral">Consultando fechamento…</span>;
  if (isError)
    return (
      <span className="text-portal-neutral">
        Não foi possível consultar a condição
      </span>
    );
  if (!final)
    return <span className="text-portal-neutral">Condição não registrada</span>;
  return (
    <>
      <span className="font-medium">
        {Number.isFinite(final.total_brl) && final.total_brl > 0
          ? formatBRL(final.total_brl)
          : 'Valor não registrado'}
      </span>
      <small>
        {final.agent?.name || 'Agente não informado'} · condição de fechamento
      </small>
    </>
  );
}

export function HistoryTab({ quotations }: { quotations: PortalQuotation[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get('busca') || '';
  const result = historyFilter(new URLSearchParams(params.toString()));
  const period = params.get('periodo') || 'all';
  const rows = filterHistory(quotations, query, result, period);
  const returnHref = `/portal/cotacoes?${params}`;
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('tab', 'historico');
    next.set('resultado', result);
    next.set(key, value);
    router.replace(`/portal/cotacoes?${next}`, { scroll: false });
  };
  const clear = () =>
    router.replace('/portal/cotacoes?tab=historico', { scroll: false });
  return (
    <section className="space-y-5" aria-label="Histórico de cotações">
      <p className="portal-body text-portal-neutral">
        Consulte como terminou cada negociação ou reaproveite os dados para uma
        nova remessa.
      </p>
      <div className={s.filters}>
        <Input
          aria-label="Buscar no histórico"
          placeholder="Fornecedor, PO, cotação, carga ou rota…"
          value={query}
          onChange={(e) => change('busca', e.target.value)}
          className="max-w-lg bg-background"
        />
        <label className={s.filter}>
          Resultado
          <select
            value={result}
            onChange={(e) => change('resultado', e.target.value)}
          >
            {Object.entries(outcomes)
              .filter(([value]) => value !== 'negadas' || result === 'negadas')
              .map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label className={s.filter}>
          Período
          <select
            value={period}
            onChange={(e) => change('periodo', e.target.value)}
          >
            <option value="all">Qualquer data</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Últimos 12 meses</option>
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 portal-small text-portal-neutral">
        <span>
          {rows.length}{' '}
          {rows.length === 1 ? 'cotação encerrada' : 'cotações encerradas'}
          {rows.length !== quotations.length && ` de ${quotations.length}`}
        </span>
        {(query || result !== 'all' || period !== 'all') && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Limpar filtros
          </Button>
        )}
      </div>
      {!rows.length ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-portal-neutral">
          {quotations.length
            ? 'Nenhuma cotação corresponde à busca ou aos filtros.'
            : 'Suas cotações encerradas aparecerão aqui.'}
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Solicitação</th>
                <th>Rota</th>
                <th>Resultado</th>
                <th>Condição final</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const date = closingDate(q);
                const detailHref = `/portal/cotacao/${q.id}?retorno=${encodeURIComponent(returnHref)}`;
                const repeatHref = `/portal/cotacoes/repetir/${q.id}?retorno=${encodeURIComponent(returnHref)}`;
                return (
                  <tr key={q.id}>
                    <td data-label="Solicitação">
                      <Link
                        className="font-medium hover:underline"
                        href={detailHref}
                      >
                        {q.exporter_name || q.product || q.reference}
                      </Link>
                      {q.exporter_name && q.product && (
                        <small>{q.product}</small>
                      )}
                      <small>
                        {[q.client_reference, q.reference]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                      {!q.exporter_name && (
                        <small>Fornecedor não informado</small>
                      )}
                    </td>
                    <td data-label="Rota">
                      {formatRoute(q)}
                      <small>
                        {[q.modal, q.incoterm].filter(Boolean).join(' · ')}
                      </small>
                    </td>
                    <td data-label="Resultado">
                      <span
                        className={
                          q.state === 'FECHADA'
                            ? 'text-portal-success'
                            : 'text-portal-neutral'
                        }
                      >
                        {q.state === 'FECHADA'
                          ? 'Fechada'
                          : q.state === 'DECLINADA'
                            ? 'Propostas recusadas'
                            : 'Cancelada'}
                      </span>
                      <small>
                        {date.label} {formatDate(date.value)}
                      </small>
                    </td>
                    <td data-label="Condição final">
                      <FinalCondition quotation={q} />
                    </td>
                    <td className={s.actions}>
                      <Link href={detailHref}>Ver cotação</Link>
                      <Link href={repeatHref}>Cotar novamente</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
