'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
} from '@/components/ui';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { useShipmentInstruction } from '@/hooks/use-shipment-instruction';
import portal_api from '@/lib/portal-api';
import { formatRoute, formatDate } from '@/lib/portal-formatters';
import type { PortalQuotation } from '@/types/portal';
import type { PortalShipment } from '@/types/portal-shipment';
import { openingStage } from '../lib/approved-model';
import s from './history.module.css';

type Opening = { requestedAt: string; readyDate: string; note: string };
const siApi = { api: portal_api, basePath: '/portal/quotations' };

export function ApprovedTab({
  quotations,
  clientId,
}: {
  quotations: PortalQuotation[];
  clientId?: string;
}) {
  const shipments = useMyShipments();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('pending');
  const [requests, setRequests] = useState<Record<string, Opening>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<PortalQuotation | null>(null);
  const [readyDate, setReadyDate] = useState('');
  const [note, setNote] = useState('');
  const key = clientId ? `centrix-opening-requests-v1:${clientId}` : null;
  useEffect(() => {
    setLoaded(false);
    if (!key) return;
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      if (!value || Array.isArray(value) || typeof value !== 'object')
        throw new Error();
      setRequests(value);
      setError('');
      setLoaded(true);
    } catch {
      setError('Não foi possível consultar os pedidos salvos neste navegador.');
    }
  }, [key]);
  const matches = (q: PortalQuotation) =>
    shipments.shipments.filter((s) => s.quotation_id === q.id);
  const text = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  const rows = quotations
    .filter((q) =>
      text(
        [
          q.exporter_name,
          q.product,
          q.reference,
          q.client_reference,
          formatRoute(q),
        ].join(' '),
      ).includes(text(query.trim())),
    )
    .filter(
      (q) =>
        scope === 'all' ||
        shipments.isLoading ||
        shipments.isError ||
        (scope === 'linked' ? matches(q).length > 0 : matches(q).length === 0),
    );
  const prepare = (q: PortalQuotation) => {
    setSelected(q);
    setReadyDate(requests[q.id]?.readyDate || q.data_prontidao || '');
    setNote(requests[q.id]?.note || '');
  };
  const save = () => {
    if (
      !key ||
      !selected ||
      !loaded ||
      shipments.isError ||
      shipments.isLoading ||
      matches(selected).length ||
      selected.guard_rail_active
    )
      return;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      if (!stored || Array.isArray(stored) || typeof stored !== 'object')
        throw new Error();
      const next = {
        ...stored,
        [selected.id]: stored[selected.id] || {
          requestedAt: new Date().toISOString(),
          readyDate,
          note: note.trim(),
        },
      };
      localStorage.setItem(key, JSON.stringify(next));
      setRequests(next);
      setSelected(null);
      setError('');
    } catch {
      setError(
        'Não foi possível salvar o pedido. Os dados continuam no formulário.',
      );
    }
  };
  return (
    <section className="space-y-5" aria-label="Cotações aprovadas">
      <p className="portal-body text-portal-neutral">
        Sua escolha já foi feita. Prepare a abertura do embarque e acompanhe o
        próximo passo.
      </p>
      <div className={s.filters}>
        <Input
          className="max-w-lg bg-background"
          aria-label="Buscar aprovadas"
          placeholder="Fornecedor, PO, cotação, carga ou rota…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className={s.filter}>
          Embarque
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="pending">Sem embarque vinculado</option>
            <option value="linked">Com embarque vinculado</option>
            <option value="all">Todas as aprovadas</option>
          </select>
        </label>
      </div>
      <p className="portal-small text-portal-neutral">
        Pedidos de abertura nesta prévia são salvos no navegador, sem envio à
        equipe. Cotações fechadas também permanecem no Histórico.
      </p>
      {error && (
        <p role="alert" className="text-portal-warning-ink">
          {error}
        </p>
      )}
      {shipments.isError && (
        <p role="alert">
          Não foi possível consultar os embarques.{' '}
          <Button variant="ghost" onClick={() => void shipments.mutate()}>
            Tentar novamente
          </Button>
        </p>
      )}
      <p className="portal-small text-portal-neutral">
        {shipments.isLoading
          ? 'Consultando vínculos de embarque…'
          : `${rows.length} cotações neste recorte`}
      </p>
      {!rows.length ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-portal-neutral">
          Nenhuma cotação neste recorte. Consulte todas as aprovadas ou ajuste a
          busca.
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Solicitação</th>
                <th>Rota e necessidade</th>
                <th>Próximo passo</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <ApprovedRow
                  key={q.id}
                  q={q}
                  linked={matches(q)}
                  unavailable={
                    shipments.isLoading || shipments.isError || !loaded
                  }
                  opening={requests[q.id]}
                  onPrepare={() => prepare(q)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected && requests[selected.id]
                ? 'Pedido de abertura registrado'
                : 'Solicitar abertura de embarque'}
            </DialogTitle>
            <DialogDescription>
              {selected && requests[selected.id]
                ? 'Pedido salvo neste navegador. O envio à equipe ainda não foi realizado.'
                : 'Confira esta carga antes de registrar o pedido de demonstração. Nenhum embarque será criado automaticamente.'}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {selected?.reference} · {selected?.client_reference}
            <br />
            {selected?.product}
            <br />
            {selected && formatRoute(selected)}
          </p>
          <label className="space-y-2 text-sm">
            Prontidão da carga
            <Input
              type="date"
              readOnly={!!selected && !!requests[selected.id]}
              value={readyDate}
              onChange={(e) => setReadyDate(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            Orientações para a abertura
            <Textarea
              value={note}
              readOnly={!!selected && !!requests[selected.id]}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Informe o que a equipe precisa considerar."
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Voltar
            </Button>
            {(!selected || !requests[selected.id]) && (
              <Button onClick={save}>Registrar pedido · simulação</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ApprovedRow({
  q,
  linked,
  unavailable,
  opening,
  onPrepare,
}: {
  q: PortalQuotation;
  linked: PortalShipment[];
  unavailable: boolean;
  opening?: Opening;
  onPrepare: () => void;
}) {
  const instruction = useShipmentInstruction(
    q.created_via_portal && !linked.length ? q.id : null,
    siApi,
  );
  const unknown = unavailable || instruction.isLoading || instruction.isError;
  const stage = openingStage(
    !!linked.length,
    !!q.guard_rail_active,
    instruction.si?.status === 'ENVIADA',
    !!opening,
  );
  const detail = `/portal/cotacao/${q.id}?retorno=${encodeURIComponent('/portal/cotacoes?tab=aprovadas')}`;
  return (
    <tr>
      <td data-label="Solicitação">
        <strong className="font-medium">
          {q.exporter_name || q.product || q.reference}
        </strong>
        <small>
          {[q.client_reference, q.reference].filter(Boolean).join(' · ')}
        </small>
        <small>
          {q.state === 'FECHADA'
            ? 'Cotação fechada'
            : 'Proposta aprovada pelo cliente'}
        </small>
      </td>
      <td data-label="Rota e necessidade">
        {formatRoute(q)}
        <small>
          Chegada necessária:{' '}
          {q.data_limite_necessidade
            ? formatDate(q.data_limite_necessidade)
            : 'não informada'}
        </small>
      </td>
      <td data-label="Próximo passo">
        {unknown
          ? 'Situação de abertura não confirmada'
          : stage === 'linked'
            ? 'Embarque vinculado'
            : stage === 'review'
              ? 'Aguardando liberação da Freitas'
              : stage === 'sent'
                ? 'Instrução enviada · aguardando vínculo'
                : stage === 'local'
                  ? 'Pedido registrado · simulação'
                  : 'Solicitar abertura do embarque'}
        {stage === 'local' && !unknown && (
          <small>
            {formatDate(opening!.requestedAt)} · salvo neste navegador
          </small>
        )}
      </td>
      <td className={s.actions}>
        <Link href={detail}>Ver cotação</Link>
        {!unknown &&
          stage === 'linked' &&
          linked.map((shipment) => (
            <Link key={shipment.id} href={`/portal/embarques/${shipment.id}`}>
              Ver embarque {shipment.referencia}
            </Link>
          ))}
        {!unknown && stage === 'ready' && (
          <Button variant="outline" size="sm" onClick={onPrepare}>
            Solicitar abertura
          </Button>
        )}
        {!unknown && stage === 'local' && (
          <Button variant="ghost" size="sm" onClick={onPrepare}>
            Ver pedido · simulação
          </Button>
        )}
      </td>
    </tr>
  );
}
