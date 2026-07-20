import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Paperclip } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge, Button, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import { PriorityBadge } from './priority-badge';
import { StateBadge } from './state-badge';
import type { Quotation } from '@/types/quotation';

const MODAL_SHORT: Record<string, string> = {
  MARITIMO: 'Maritimo',
  AEREO: 'Aereo',
};

export const columns: ColumnDef<Quotation>[] = [
  {
    id: 'expander',
    header: () => null,
    cell: () => null, // Rendered by InboxTable directly
    enableSorting: false,
    size: 30,
  },
  {
    accessorKey: 'reference',
    header: 'Referencia',
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{row.original.reference}</span>
        <StateBadge state={row.original.state} className="mt-1 w-fit" />
      </div>
    ),
    enableSorting: false,
  },
  {
    id: 'client',
    header: 'Cliente',
    cell: ({ row }) => {
      const client = row.original.client;
      if (!client) {
        return <span className="text-xs text-muted-foreground italic">--</span>;
      }
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{client.name}</span>
            {client.is_vip && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              >
                VIP
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{client.email}</span>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: 'route',
    header: 'Rota',
    cell: ({ row }) => {
      const { origin, porto_destino, aeroporto_destino, modal } = row.original;
      const destination = porto_destino?.join(', ') || aeroporto_destino?.join(', ');
      if (!origin && !destination) {
        return <span className="text-xs text-muted-foreground italic">--</span>;
      }
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">
            {origin || '?'} → {destination || '?'}
          </span>
          {modal && (
            <span className="text-xs text-muted-foreground">
              {MODAL_SHORT[modal] ?? modal}
            </span>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'priority_score',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="flex items-center gap-1 -ml-3"
      >
        Prioridade
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.original.priority_score;
      return (
        <div className="flex items-center gap-2">
          <PriorityBadge score={score} />
          {score !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {score}
            </span>
          )}
        </div>
      );
    },
    sortDescFirst: true,
  },
  {
    accessorKey: 'completeness_score',
    header: 'Completude',
    cell: ({ row }) => {
      const score = row.original.completeness_score ?? 0;
      const colorClass =
        score >= 80
          ? '[&>div]:bg-green-500'
          : score >= 50
            ? '[&>div]:bg-yellow-500'
            : '[&>div]:bg-red-500';

      const textColor =
        score >= 80
          ? 'text-green-600 dark:text-green-400'
          : score >= 50
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-red-600 dark:text-red-400';

      return (
        <div className="flex items-center gap-2 min-w-[100px]">
          <Progress value={score} className={cn('h-1.5 flex-1', colorClass)} />
          <span className={cn('text-xs font-medium tabular-nums', textColor)}>
            {score}%
          </span>
        </div>
      );
    },
    enableSorting: true,
    sortDescFirst: true,
  },
  {
    id: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const q = row.original;
      const tags: { label: string; className: string }[] = [];

      if (q.client?.is_vip) {
        tags.push({
          label: 'VIP',
          className:
            'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
        });
      }
      if ((q.priority_score ?? 0) >= 80) {
        tags.push({
          label: 'URGENTE',
          className:
            'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400',
        });
      }

      if (tags.length === 0) return null;

      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag.label}
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0 h-4 font-semibold', tag.className)}
            >
              {tag.label}
            </Badge>
          ))}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: 'analyst',
    header: 'Analista',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.analyst_name ?? '--'}
      </span>
    ),
    enableSorting: false,
  },
  {
    id: 'age',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="flex items-center gap-1 -ml-3"
      >
        Idade
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    ),
    accessorFn: (row) => new Date(row.created_at).getTime(),
    cell: ({ row }) => {
      const age = formatDistanceToNow(new Date(row.original.created_at), {
        locale: ptBR,
        addSuffix: false,
      });
      return <span className="text-xs text-muted-foreground whitespace-nowrap">{age}</span>;
    },
    sortDescFirst: true,
  },
  {
    id: 'attachments',
    header: () => <Paperclip className="h-4 w-4" />,
    cell: ({ row }) => {
      const count = Object.keys(row.original.attachments_s3_keys || {}).length;
      if (count === 0) return null;
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          <span className="text-xs">{count}</span>
        </div>
      );
    },
    enableSorting: false,
    size: 50,
  },
];
