'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { fetchProposalFlags, resolveAuditFlag } from '@/hooks/use-proposals';
import type { AuditFlag, QuotationProposal } from '@/types/quotation';
import { formatCurrencyCode } from '@/lib/portal-formatters';

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  CRITICAL: {
    label: 'Critico',
    className:
      'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  },
  HIGH: {
    label: 'Alto',
    className:
      'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
  },
  MEDIUM: {
    label: 'Medio',
    className:
      'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
  },
  LOW: {
    label: 'Baixo',
    className:
      'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  SEGURO: 'Seguro',
  ROTA_DESTINO: 'Rota / Destino',
  COTACAO_INCOMPLETA: 'Cotacao Incompleta',
  PARTICULARIDADES_IGNORADAS: 'Particularidades Ignoradas',
  DNA_COMPLIANCE: 'Conformidade DNA',
};

interface ProposalFlagsDialogProps {
  quotationId: string;
  proposal: QuotationProposal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProposalFlagsDialog({
  quotationId,
  proposal,
  open,
  onOpenChange,
}: ProposalFlagsDialogProps) {
  const [flags, setFlags] = useState<AuditFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [justifications, setJustifications] = useState<Record<string, string>>({});

  const loadFlags = useCallback(async () => {
    setLoading(true);
    const result = await fetchProposalFlags(quotationId, proposal.id);
    setFlags(result);
    setLoading(false);
  }, [quotationId, proposal.id]);

  useEffect(() => {
    if (open) {
      loadFlags();
    }
  }, [open, loadFlags]);

  const handleResolve = async (flagId: string, justification?: string) => {
    setResolvingId(flagId);
    const resolved = await resolveAuditFlag(quotationId, proposal.id, flagId, justification);
    if (resolved) {
      setFlags((prev) =>
        prev.map((f) => (f.id === flagId ? resolved : f)),
      );
    }
    setResolvingId(null);
  };

  const handleJustificationChange = (flagId: string, value: string) => {
    setJustifications((prev) => ({ ...prev, [flagId]: value }));
  };

  const unresolvedFlags = flags.filter((f) => !f.resolved);
  const resolvedFlags = flags.filter((f) => f.resolved);

  const grouped = unresolvedFlags.reduce<Record<string, AuditFlag[]>>((acc, flag) => {
    const cat = flag.rule_category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(flag);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Flags de Auditoria
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between text-sm border-b pb-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold">
              {proposal.agent?.name ?? `Agente ${proposal.agent_id.slice(0, 8)}`}
            </span>
            {proposal.carrier && (
              <span className="text-muted-foreground">{proposal.carrier}</span>
            )}
          </div>
          <span className="font-bold tabular-nums">
            {formatCurrencyCode(proposal.total_value, proposal.freight_currency)}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando flags...
          </div>
        ) : flags.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma flag de auditoria para esta proposta.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([category, categoryFlags]) => (
              <div key={category} className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                {categoryFlags.map((flag) => (
                  <FlagRow
                    key={flag.id}
                    flag={flag}
                    resolving={resolvingId === flag.id}
                    justification={justifications[flag.id] ?? ''}
                    onJustificationChange={(value) => handleJustificationChange(flag.id, value)}
                    onResolve={(justification) => handleResolve(flag.id, justification)}
                  />
                ))}
              </div>
            ))}

            {resolvedFlags.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Resolvidas ({resolvedFlags.length})
                </p>
                {resolvedFlags.map((flag) => (
                  <FlagRow
                    key={flag.id}
                    flag={flag}
                    resolving={false}
                    justification={flag.justification ?? ''}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FlagRowProps {
  flag: AuditFlag;
  resolving: boolean;
  justification?: string;
  onJustificationChange?: (value: string) => void;
  onResolve?: (justification?: string) => void;
}

function FlagRow({
  flag,
  resolving,
  justification = '',
  onJustificationChange,
  onResolve,
}: FlagRowProps) {
  const config = SEVERITY_CONFIG[flag.severity] ?? SEVERITY_CONFIG.LOW;
  const isResolved = flag.resolved;
  const requiresJustification = flag.severity === 'MEDIUM' && !isResolved;
  const canResolve = !requiresJustification || justification.trim().length > 0;

  return (
    <div
      className={cn(
        'rounded border px-3 py-2.5 text-sm flex flex-col gap-2',
        isResolved ? 'opacity-60 bg-muted/30 border-muted' : config.className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 text-[10px] font-bold',
              !isResolved && config.className,
            )}
          >
            {config.label}
          </Badge>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-xs">{flag.rule_name}</span>
            <span className="text-xs">{flag.description}</span>
          </div>
        </div>
        <div className="shrink-0">
          {isResolved ? (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Resolvida
            </span>
          ) : onResolve ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onResolve(requiresJustification ? justification : undefined)}
              disabled={resolving || !canResolve}
            >
              {resolving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Resolver
            </Button>
          ) : null}
        </div>
      </div>

      {requiresJustification && onJustificationChange && (
        <div className="flex flex-col gap-1">
          <Textarea
            placeholder="Justificativa obrigatoria..."
            value={justification}
            onChange={(e) => onJustificationChange(e.target.value)}
            className="min-h-[60px] text-xs bg-white/50"
          />
          <span className="text-[10px] text-muted-foreground">
            Justificativa obrigatoria para flags de severidade MEDIA
          </span>
        </div>
      )}

      {isResolved && flag.justification && (
        <div className="text-xs text-muted-foreground border-t border-dashed pt-1.5 mt-1">
          <span className="font-medium">Justificativa:</span> {flag.justification}
        </div>
      )}

      {isResolved && flag.resolved_at && (
        <span className="text-[10px] text-muted-foreground">
          Resolvida em {new Date(flag.resolved_at).toLocaleString('pt-BR')}
        </span>
      )}
    </div>
  );
}
