'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  CLIENT_KIND_LABELS,
  INVITE_STATUS_LABELS,
  WAVE_NUMBERS,
  type ClientKind,
  type CompanyFilter,
  type InviteStatus,
  type WaveNumber,
} from '../../../_shared/demo/access-model';

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Estado do convite. Caminho principal em tons de progresso; os dois laterais
// em cor de alerta, porque pedem ação de quem administra.
const STATUS_CLASS: Record<InviteStatus, string> = {
  nao_convidado: 'bg-muted text-portal-neutral',
  convite_enviado: 'bg-portal-info/10 text-portal-info',
  cadastrado: 'bg-brand-indigo-100 text-brand-indigo',
  ativo: 'bg-portal-success/10 text-portal-success-ink',
  expirado: 'bg-portal-warning/10 text-portal-warning-ink',
  bloqueado: 'bg-portal-danger/10 text-portal-danger-ink',
};

export function InviteStatusBadge({ status }: { status: InviteStatus }) {
  return (
    <span
      className={cn(
        'portal-small inline-flex rounded-full px-2 py-0.5 font-medium',
        STATUS_CLASS[status],
      )}
    >
      {INVITE_STATUS_LABELS[status]}
    </span>
  );
}

export function KindBadge({ kind }: { kind: ClientKind }) {
  return (
    <span
      className={cn(
        'portal-small inline-flex rounded-full border px-2 py-0.5',
        kind === 'saas'
          ? 'border-brand-indigo/40 text-brand-indigo'
          : 'border-border text-portal-neutral',
      )}
    >
      {CLIENT_KIND_LABELS[kind]}
    </span>
  );
}

export function DemoSeal() {
  return (
    <span className="portal-small inline-flex rounded-full border border-dashed border-portal-neutral px-2 py-0.5 text-portal-neutral">
      Demonstração / interna
    </span>
  );
}

const ALL = '__all__';

export function CompanyFilterBar({
  value,
  onChange,
}: {
  value: CompanyFilter;
  onChange: (next: CompanyFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1">
        <Label
          htmlFor="filtro-onda"
          className="portal-small text-portal-neutral"
        >
          Onda
        </Label>
        <Select
          value={value.wave === null ? ALL : String(value.wave)}
          onValueChange={(v) =>
            onChange({
              ...value,
              wave:
                v === ALL
                  ? null
                  : v === 'none'
                    ? 'none'
                    : (Number(v) as WaveNumber),
            })
          }
        >
          <SelectTrigger id="filtro-onda" className="h-11 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {WAVE_NUMBERS.map((wave) => (
              <SelectItem key={wave} value={String(wave)}>
                Onda {wave}
              </SelectItem>
            ))}
            <SelectItem value="none">Sem onda</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label
          htmlFor="filtro-status"
          className="portal-small text-portal-neutral"
        >
          Status do convite
        </Label>
        <Select
          value={value.status ?? ALL}
          onValueChange={(v) =>
            onChange({
              ...value,
              status: v === ALL ? null : (v as InviteStatus),
            })
          }
        >
          <SelectTrigger id="filtro-status" className="h-11 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {(Object.keys(INVITE_STATUS_LABELS) as InviteStatus[]).map(
              (status) => (
                <SelectItem key={status} value={status}>
                  {INVITE_STATUS_LABELS[status]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label
          htmlFor="filtro-demo"
          className="portal-small text-portal-neutral"
        >
          Demonstração
        </Label>
        <Select
          value={value.demo ?? ALL}
          onValueChange={(v) =>
            onChange({
              ...value,
              demo: v === ALL ? null : (v as 'only' | 'hide'),
            })
          }
        >
          <SelectTrigger id="filtro-demo" className="h-11 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as contas</SelectItem>
            <SelectItem value="only">Só demonstração</SelectItem>
            <SelectItem value="hide">Sem demonstração</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
