import { LogEntry } from '@/types/log';
import { format } from 'date-fns';
import {
  ArrowUpDown,
  CalendarDaysIcon,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Pen,
  User,
} from 'lucide-react';
import { CustomColumnDef } from '@/types/table';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

const StatusBadge = ({ status }: { status: 'SUCCESS' | 'ERROR' }) => {
  const colorMap = {
    SUCCESS: 'bg-green-100 text-green-800',
    ERROR: 'bg-red-100 text-red-800',
  };

  return <Badge className={colorMap[status]}>{status}</Badge>;
};

const ActionTypeBadge = ({ type }: { type: string }) => {
  const typeMap: Record<string, { bg: string; text: string; label: string }> = {
    // User Management
    USER_CREATED: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Usuário Criado',
    },
    USER_DELETED: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Usuário Removido',
    },
    USER_ROLE_CHANGED: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      label: 'Papel Alterado',
    },
    USER_PASSWORD_RESET: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'Senha Resetada',
    },
    PRE_REGISTER_ADDED: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-800',
      label: 'Pré-registro Adicionado',
    },
    PRE_REGISTER_REMOVED: {
      bg: 'bg-rose-100',
      text: 'text-rose-800',
      label: 'Pré-registro Removido',
    },

    // Authentication
    USER_LOGIN: {
      bg: 'bg-slate-100',
      text: 'text-slate-800',
      label: 'Login',
    },
    USER_LOGOUT: {
      bg: 'bg-slate-100',
      text: 'text-slate-800',
      label: 'Logout',
    },

    // Extraction Lifecycle
    EXTRACTION_CREATED: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Extração Criada',
    },
    EXTRACTION_UPDATED: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'Extração Atualizada',
    },
    EXTRACTION_APPROVED: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      label: 'Extração Aprovada',
    },
    EXTRACTION_REJECTED: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Extração Rejeitada',
    },
    EXTRACTION_DELETED: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Extração Removida',
    },

    // Extraction Details
    FIELD_UPDATED: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'Campo Atualizado',
    },
    COMMENT_ADDED: {
      bg: 'bg-pink-100',
      text: 'text-pink-800',
      label: 'Comentário Adicionado',
    },
    DOCUMENT_UPLOADED: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Documento Enviado',
    },
    DOCUMENT_DELETED: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Documento Removido',
    },

    // Integrations
    AIRTABLE_SYNC_SUCCESS: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      label: 'Sincronizado Airtable',
    },
    AIRTABLE_SYNC_FAILED: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Falha Sync Airtable',
    },

    // System
    SETTINGS_UPDATED: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      label: 'Configurações Atualizadas',
    },
  };

  const config = typeMap[type] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: type,
  };

  return (
    <Badge className={`${config.bg} ${config.text}`}>{config.label}</Badge>
  );
};

const ActionTypeFilter = ({ column }: { column: any }) => {
  return (
    <Select
      value={column.getFilterValue()}
      onValueChange={(value) =>
        column.setFilterValue(value === 'All' ? undefined : value)
      }
    >
      <SelectTrigger className="w-full text-sm">
        <SelectValue placeholder="Tipo de Ação" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="All">Todos</SelectItem>

        {/* User Management */}
        <SelectItem value="USER_CREATED">Usuário Criado</SelectItem>
        <SelectItem value="USER_DELETED">Usuário Removido</SelectItem>
        <SelectItem value="USER_ROLE_CHANGED">Papel Alterado</SelectItem>
        <SelectItem value="USER_PASSWORD_RESET">Senha Resetada</SelectItem>
        <SelectItem value="PRE_REGISTER_ADDED">
          Pré-registro Adicionado
        </SelectItem>
        <SelectItem value="PRE_REGISTER_REMOVED">
          Pré-registro Removido
        </SelectItem>

        {/* Extraction Events */}
        <SelectItem value="EXTRACTION_CREATED">Extração Criada</SelectItem>
        <SelectItem value="EXTRACTION_APPROVED">Extração Aprovada</SelectItem>
        <SelectItem value="EXTRACTION_REJECTED">Extração Rejeitada</SelectItem>
        <SelectItem value="FIELD_UPDATED">Campo Atualizado</SelectItem>
        <SelectItem value="COMMENT_ADDED">Comentário Adicionado</SelectItem>

        {/* Integrations */}
        <SelectItem value="AIRTABLE_SYNC_SUCCESS">
          Sync Airtable Sucesso
        </SelectItem>
        <SelectItem value="AIRTABLE_SYNC_FAILED">
          Sync Airtable Falha
        </SelectItem>

        <SelectItem value="SETTINGS_UPDATED">
          Configurações Atualizadas
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

const StatusFilter = ({ column }: { column: any }) => {
  return (
    <Select
      value={column.getFilterValue()}
      onValueChange={(value) =>
        column.setFilterValue(value === 'All' ? undefined : value)
      }
    >
      <SelectTrigger className="w-full text-sm">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="All">Todos</SelectItem>
        <SelectItem value="SUCCESS">Sucesso</SelectItem>
        <SelectItem value="ERROR">Erro</SelectItem>
      </SelectContent>
    </Select>
  );
};

export const columns: CustomColumnDef<LogEntry>[] = [
  {
    id: 'expander',
    header: () => null,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        onClick={() => row.toggleExpanded()}
        className="p-0 h-6 w-6"
      >
        {row.getIsExpanded() ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>
    ),
    enableSorting: false,
    size: 30,
  },
  {
    accessorKey: 'timestamp',
    header: ({ column }: { column: any }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="flex items-center"
      >
        Data/Hora
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }: { row: any }) => {
      const timestamp = row.getValue('timestamp') as string;
      return format(new Date(timestamp), 'dd/MM/yyyy HH:mm:ss');
    },
    meta: {
      mobileHeader: <CalendarDaysIcon />,
    },
    sortingFn: 'datetime',
    sortDescFirst: true,
  },
  {
    accessorKey: 'actionType',
    header: ActionTypeFilter,
    cell: ({ row }) => {
      const type = row.getValue('actionType') as string;
      return <ActionTypeBadge type={type} />;
    },
    filterFn: (row, id, filterValue) => {
      if (!filterValue || filterValue === 'All') return true;
      const value = row.getValue(id);
      return value === filterValue;
    },
    meta: {
      mobileHeader: <Pen />,
      filterComponent: ActionTypeFilter,
    },
  },
  {
    accessorKey: 'userName',
    header: 'Usuário',
    cell: ({ row }: { row: any }) => (
      <div className="flex flex-col">
        <span className="font-medium text-sm">{row.original.userName}</span>
        <span className="text-xs text-muted-foreground">
          {row.original.userEmail}
        </span>
      </div>
    ),
    meta: {
      mobileHeader: <User />,
    },
  },
  {
    accessorKey: 'message',
    header: 'Descrição',
    cell: ({ row }: { row: any }) => (
      <span className="text-sm line-clamp-2">{row.original.message}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: StatusFilter,
    cell: ({ row }: { row: any }) => {
      const status = row.getValue('status') as 'SUCCESS' | 'ERROR';
      return <StatusBadge status={status} />;
    },
    filterFn: (row, id, filterValue) => {
      if (!filterValue || filterValue === 'All') return true;
      const value = row.getValue(id);
      return value === filterValue;
    },
    meta: {
      mobileHeader: <CheckCircle />,
      filterComponent: StatusFilter,
    },
  },
];
