'use client';

import { useState } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { filterLog } from '../../../_shared/demo/access-model';
import { useAccessState } from '../../../_shared/demo/use-access';
import { formatDateTime } from './shared';

const ALL = '__all__';

export function LogTab() {
  const state = useAccessState();
  const [companyId, setCompanyId] = useState<string>(ALL);
  const entries = filterLog(state.log, companyId === ALL ? null : companyId);
  const options = [
    ...state.companies.map((c) => ({ id: c.id, name: c.name })),
    ...(state.log.some((e) => e.companyId === '*')
      ? [{ id: '*', name: 'Padrão global' }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Label
          htmlFor="log-empresa"
          className="portal-small text-portal-neutral"
        >
          Empresa
        </Label>
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger id="log-empresa" className="h-11 w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {entries.length ? (
        <ol className="portal-card divide-y divide-border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="grid gap-1 p-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
            >
              <time
                className="portal-small text-portal-neutral"
                dateTime={entry.at}
              >
                {formatDateTime(entry.at)}
              </time>
              <div className="min-w-0 space-y-0.5">
                <p className="portal-body">
                  <span className="font-medium">{entry.companyName}</span> ·{' '}
                  {entry.what}
                </p>
                <p className="portal-small break-words text-portal-neutral">
                  {entry.from} → {entry.to} · {entry.actor}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="portal-body rounded-lg border border-dashed border-border p-6 text-portal-neutral">
          Nenhuma alteração registrada
          {companyId === ALL ? '' : ' para esta empresa'}. Convites, ondas,
          módulos, tipo de cliente e “ver como” aparecem aqui, o mais recente
          primeiro.
        </p>
      )}
    </div>
  );
}
