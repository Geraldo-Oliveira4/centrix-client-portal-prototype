'use client';

import { useEffect, useRef, useState } from 'react';
import { EmptyState, LoadingState, SectionHeader } from '@arboria-tech/arboria-ui';
import {
  AlertTriangle,
  Award,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  History,
  LayoutList,
  Link,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ShieldOff,
  Table2,
  Trash2,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAuth } from '@arboria-tech/arboria-ui';
import { fetchProposalAttachments, notifyLosers, notifyWinner, selectWinner, useProposals, useRecommendation } from '@/hooks/use-proposals';
import { useClientLinks } from '@/hooks/use-client-links';
import { useQuotationLogs } from '@/hooks/use-quotations';
import { parseEmailList } from '@/utils/email-helpers';
import type { NonWinnerAgent } from '@/hooks/use-proposals';
import type { Quotation, QuotationProposal } from '@/types/quotation';
import { categorizeFee } from '@/utils/fee-categories';
import { formatDateDisplay, formatPesoByUnit, formatVolumesCount, summarizeVolumes } from '@/utils/quotation-fields';
import { formatCurrencyCode, formatMultiCurrency } from '@/lib/portal-formatters';
import { AddNoteModal } from './add-note-modal';
import { InvalidateProposalModal } from './invalidate-proposal-modal';
import { ProposalFlagsDialog } from './proposal-flags-dialog';
import { ProposalModal } from './proposal-modal';
import { ProposalVersionHistoryDialog } from './proposal-version-history-dialog';
import { ProposalsCompareTable } from './proposals-compare-table';
import { RequestReviewModal } from './request-review-modal';

async function triggerFileDownload(url: string, filename: string): Promise<void> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

const SEVERITY_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  CRITICAL: { label: 'Critico', className: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' },
  HIGH: { label: 'Alto', className: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' },
  MEDIUM: { label: 'Medio', className: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' },
  LOW: { label: 'Baixo', className: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' },
};

interface ProposalsSectionProps {
  quotationId: string;
  quotation?: Quotation;
}

type ViewMode = 'list' | 'compare';

export function ProposalsSection({ quotationId, quotation }: ProposalsSectionProps) {
  const { proposals, isLoading, mutate } = useProposals(quotationId);
  const { logs } = useQuotationLogs(quotationId);
  const { links } = useClientLinks(quotationId);
  const { recommendation } = useRecommendation(quotationId);
  const [refreshing, setRefreshing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [flagsProposal, setFlagsProposal] = useState<QuotationProposal | null>(null);
  const [reviewProposal, setReviewProposal] = useState<QuotationProposal | null>(null);
  const [editingProposal, setEditingProposal] = useState<QuotationProposal | null>(null);
  const [duplicatingProposal, setDuplicatingProposal] = useState<QuotationProposal | null>(null);
  const [noteProposalId, setNoteProposalId] = useState<string | undefined>(undefined);
  const [noteOpen, setNoteOpen] = useState(false);
  const [versionsProposal, setVersionsProposal] = useState<QuotationProposal | null>(null);
  const [invalidatingProposal, setInvalidatingProposal] = useState<QuotationProposal | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    quotation?.state === 'PARA_ANALISE' ? 'compare' : 'list',
  );
  const [notifyLosersAgents, setNotifyLosersAgents] = useState<NonWinnerAgent[]>([]);
  const [notifyLosersOpen, setNotifyLosersOpen] = useState(false);
  const [pendingNotification, setPendingNotification] = useState<{ proposalId: string; loserAgents: NonWinnerAgent[] } | null>(null);

  const handleAddNote = (proposalId?: string) => {
    setNoteProposalId(proposalId);
    setNoteOpen(true);
  };

  const handleWinnerSelected = (nonWinnerAgents: NonWinnerAgent[], winningProposalId: string) => {
    setPendingNotification({ proposalId: winningProposalId, loserAgents: nonWinnerAgents });
  };

  const handleWinnerNotifyDone = () => {
    const loserAgents = pendingNotification?.loserAgents ?? [];
    setPendingNotification(null);
    if (loserAgents.length > 0) {
      setNotifyLosersAgents(loserAgents);
      setNotifyLosersOpen(true);
    }
  };

  useEffect(() => {
    if (pendingNotification || quotation?.state !== 'APROVADA_PELO_CLIENTE' || !proposals) return;
    // Guard rail (ARB-2449): while the client's selection is still under review,
    // do not prompt to notify the winner — the analyst must approve (release) the
    // selection on the kanban first, which clears guard_rail_active.
    if (quotation.guard_rail_active) return;
    const winner = proposals.find((p) => p.is_winner);
    if (!winner) return;
    const alreadyNotified = logs.some(
      (log) => log.action === 'winner_notified' && log.details?.proposal_id === winner.id,
    );
    if (alreadyNotified) return;
    const nonWinnerAgents: NonWinnerAgent[] = proposals
      .filter((p) => p.id !== winner.id)
      .map((p) => ({ id: p.agent_id, name: p.agent?.name ?? `Agente ${p.agent_id.slice(0, 8)}` }));
    handleWinnerSelected(nonWinnerAgents, winner.id);
    // Client-approval flow (public link) marks the winner server-side without
    // ever calling handleWinnerSelected, so this effect is the only trigger
    // for the "Notificar Vendedor" modal on that path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotation?.state, proposals, logs]);

  const hasProposals = !!proposals && proposals.length > 0;
  const activeLink = links?.find((l) => !l.is_expired);
  const earliestLinkAt = links && links.length > 0
    ? links.reduce((min, l) => l.created_at < min ? l.created_at : min, links[0].created_at)
    : null;

  const handleCopyClientLink = () => {
    if (!activeLink) return;
    navigator.clipboard.writeText(activeLink.url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionHeader>Propostas ({proposals?.length ?? 0})</SectionHeader>
        <div className="flex items-center gap-2">
          {hasProposals && (
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                onClick={() => setViewMode('compare')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-xs border-l transition-colors',
                  viewMode === 'compare'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Table2 className="h-3.5 w-3.5" />
                Comparar
              </button>
            </div>
          )}
          {viewMode === 'compare' && activeLink && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleCopyClientLink}
              title="Copiar link do comparativo para enviar ao cliente"
            >
              {linkCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Link className="h-3.5 w-3.5" />}
              {linkCopied ? 'Copiado' : 'Copiar link'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              setRefreshing(true);
              await mutate();
              setRefreshing(false);
            }}
            disabled={refreshing}
            title="Atualizar propostas"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Registrar Proposta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Carregando propostas..." />
      ) : !hasProposals ? (
        <EmptyState message="Nenhuma proposta recebida ainda." />
      ) : viewMode === 'compare' ? (
        <ProposalsCompareTable
          quotationId={quotationId}
          proposals={proposals}
          quotation={quotation}
          onViewFlags={(p) => setFlagsProposal(p)}
          recommendation={recommendation}
          onWinnerSelected={handleWinnerSelected}
          earliestLinkAt={earliestLinkAt}
        />
      ) : (
        proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            quotationId={quotationId}
            proposal={proposal}
            earliestLinkAt={earliestLinkAt}
            onViewFlags={() => setFlagsProposal(proposal)}
            onRequestReview={() => setReviewProposal(proposal)}
            onAddNote={() => handleAddNote(proposal.id)}
            onEdit={() => setEditingProposal(proposal)}
            onDuplicate={() => setDuplicatingProposal(proposal)}
            onWinnerSelected={handleWinnerSelected}
            onViewVersions={() => setVersionsProposal(proposal)}
            onInvalidate={() => setInvalidatingProposal(proposal)}
          />
        ))
      )}

      <ProposalModal
        quotationId={quotationId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      <ProposalModal
        quotationId={quotationId}
        open={!!editingProposal}
        onOpenChange={(open) => { if (!open) setEditingProposal(null); }}
        proposal={editingProposal ?? undefined}
        mode="edit"
      />

      <ProposalModal
        quotationId={quotationId}
        open={!!duplicatingProposal}
        onOpenChange={(open) => { if (!open) setDuplicatingProposal(null); }}
        proposal={duplicatingProposal ?? undefined}
        mode="duplicate"
      />

      {flagsProposal && (
        <ProposalFlagsDialog
          quotationId={quotationId}
          proposal={flagsProposal}
          open={!!flagsProposal}
          onOpenChange={(open) => { if (!open) setFlagsProposal(null); }}
        />
      )}

      {reviewProposal && (
        <RequestReviewModal
          quotationId={quotationId}
          proposalId={reviewProposal.id}
          agentName={reviewProposal.agent?.name ?? `Agente ${reviewProposal.agent_id.slice(0, 8)}`}
          open={!!reviewProposal}
          onOpenChange={(open) => { if (!open) setReviewProposal(null); }}
        />
      )}

      <AddNoteModal
        quotationId={quotationId}
        proposalId={noteProposalId}
        open={noteOpen}
        onOpenChange={setNoteOpen}
      />

      {versionsProposal && (
        <ProposalVersionHistoryDialog
          quotationId={quotationId}
          proposal={versionsProposal}
          open={!!versionsProposal}
          onOpenChange={(open) => { if (!open) setVersionsProposal(null); }}
        />
      )}

      {invalidatingProposal && (
        <InvalidateProposalModal
          quotationId={quotationId}
          proposalId={invalidatingProposal.id}
          agentName={invalidatingProposal.agent?.name ?? `Agente ${invalidatingProposal.agent_id.slice(0, 8)}`}
          open={!!invalidatingProposal}
          onOpenChange={(open) => { if (!open) setInvalidatingProposal(null); }}
        />
      )}

      {pendingNotification && proposals && (
        <NotifyWinnerModal
          quotationId={quotationId}
          proposalId={pendingNotification.proposalId}
          proposal={proposals.find((p) => p.id === pendingNotification.proposalId) ?? proposals[0]}
          quotation={quotation}
          open={!!pendingNotification}
          onOpenChange={(open) => { if (!open) handleWinnerNotifyDone(); }}
          onDone={handleWinnerNotifyDone}
        />
      )}

      <NotifyLosersModal
        quotationId={quotationId}
        agents={notifyLosersAgents}
        open={notifyLosersOpen}
        onOpenChange={setNotifyLosersOpen}
      />
    </div>
  );
}

interface ProposalCardProps {
  quotationId: string;
  proposal: QuotationProposal;
  earliestLinkAt: string | null;
  onViewFlags: () => void;
  onRequestReview: () => void;
  onAddNote: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onWinnerSelected: (nonWinnerAgents: NonWinnerAgent[], winningProposalId: string) => void;
  onViewVersions: () => void;
  onInvalidate: () => void;
}

function ProposalCard({ quotationId, proposal, earliestLinkAt, onViewFlags, onRequestReview, onAddNote, onEdit, onDuplicate, onWinnerSelected, onViewVersions, onInvalidate }: ProposalCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const hasPdf = Object.keys(proposal.attachments_s3_keys || {}).length > 0;

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const result = await fetchProposalAttachments(quotationId, proposal.id);
      if (!result || result.items.length === 0) return;
      const item = result.items[0];
      await triggerFileDownload(item.download_url, item.filename);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm(`Aprovar a proposta de "${proposal.agent?.name ?? 'este agente'}"?`)) return;
    setApproving(true);
    const result = await selectWinner(quotationId, proposal.id);
    setApproving(false);
    if (result.success) {
      onWinnerSelected(result.non_winner_agents, proposal.id);
    }
  };
  const updatedAfterSent =
    earliestLinkAt != null && new Date(proposal.received_at) > new Date(earliestLinkAt);

  const summary = proposal.audit_flags_summary;
  const criticalCount = summary?.critical ?? 0;
  const highCount = summary?.high ?? 0;
  const totalFlags = summary?.total ?? 0;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 flex flex-col gap-3',
        proposal.is_winner && 'border-green-400 bg-green-50/30 dark:bg-green-950/10',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">
            {proposal.agent?.name ?? `Agente ${proposal.agent_id.slice(0, 8)}`}
          </span>
          {(proposal.version ?? 1) > 1 && (
            <Badge variant="outline" className="text-xs font-mono">
              V{proposal.version}
            </Badge>
          )}
          {proposal.is_winner && (
            <Badge className="bg-green-600 text-white text-xs flex items-center gap-1">
              <Award className="w-3 h-3" />
              Vencedora
            </Badge>
          )}
          {proposal.has_previous_versions && (
            <button
              onClick={onViewVersions}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Ver historico de versoes"
            >
              <History className="w-3.5 h-3.5" />
              Versoes
            </button>
          )}
          {proposal.review_status === 'PENDING' && (
            <Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800">
              <Clock className="w-3 h-3" />
              Em Revisao
            </Badge>
          )}
          {updatedAfterSent && (
            <Badge variant="outline" className="text-xs flex items-center gap-1 text-blue-700 border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800">
              <RefreshCw className="w-3 h-3" />
              Atualizada apos envio
            </Badge>
          )}
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {criticalCount} Critico{criticalCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right shrink-0">
            <p className="text-base font-bold tabular-nums">
              {formatCurrencyCode(proposal.total_value, proposal.freight_currency)}
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          {!proposal.is_winner && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
              disabled={approving}
              onClick={handleApprove}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {approving ? 'Aprovando...' : 'Aprovar'}
            </Button>
          )}
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDropdownOpen(false);
                  setTimeout(onEdit, 100);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDropdownOpen(false);
                  setTimeout(onDuplicate, 100);
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDropdownOpen(false);
                  setTimeout(onRequestReview, 100);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Solicitar Revisao
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDropdownOpen(false);
                  setTimeout(onAddNote, 100);
                }}
              >
                <FileText className="h-3.5 w-3.5 mr-2" />
                Adicionar Nota
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDropdownOpen(false);
                  setTimeout(onInvalidate, 100);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Excluir Proposta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <MetricField label="Frete" value={formatCurrencyCode(proposal.freight_value, proposal.freight_currency)} />
        <MetricField label="Transit Time" value={`${proposal.transit_time} dias`} />
        <MetricField label="Incoterm" value={proposal.incoterm} />
        <MetricField
          label="Seguro"
          value={
            <span className={cn('flex items-center gap-1', proposal.insurance_included ? 'text-green-600' : 'text-muted-foreground')}>
              {proposal.insurance_included ? (
                <><Shield className="w-3.5 h-3.5" /> Incluido</>
              ) : (
                <><ShieldOff className="w-3.5 h-3.5" /> Nao incluido</>
              )}
            </span>
          }
        />
        {proposal.carrier && <MetricField label="Armador / Cia" value={proposal.carrier} />}
        {proposal.validity && (
          <MetricField
            label="Validade"
            value={formatDateDisplay(proposal.validity)}
          />
        )}
        {proposal.validade_status === 'expirada' && (
          <Badge variant="outline" className="text-xs flex items-center gap-1 text-red-600 border-red-300 bg-red-50 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Proposta vencida
          </Badge>
        )}
      </div>

      {/* Portal PDF attachment */}
      {hasPdf && (
        <div className="border-t pt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">PDF da proposta do agente</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={downloadingPdf}
            onClick={handleDownloadPdf}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            {downloadingPdf ? 'Baixando...' : 'Baixar PDF'}
          </Button>
        </div>
      )}

      {/* Taxes breakdown */}
      {proposal.taxes_breakdown && Object.keys(proposal.taxes_breakdown).length > 0 && (
        <div className="border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Composicao de Custos
          </p>
          <TaxesBreakdownGrouped
            taxes={proposal.taxes_breakdown}
            taxesCurrencyBreakdown={proposal.taxes_currency_breakdown}
            freightValue={proposal.freight_value}
            freightCurrency={proposal.freight_currency}
          />
        </div>
      )}

      {/* Observations from agent */}
      {proposal.observations && (
        <div className="border-t pt-2">
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-1">
              Observacoes do Agente
            </p>
            <p className="text-sm whitespace-pre-wrap text-amber-900 dark:text-amber-300">{proposal.observations}</p>
          </div>
        </div>
      )}

      {/* Audit flags summary */}
      {totalFlags > 0 && (
        <div className="border-t pt-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Flags de Auditoria ({totalFlags})
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-primary"
              onClick={onViewFlags}
            >
              Ver {totalFlags} flag{totalFlags > 1 ? 's' : ''}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {criticalCount > 0 && (
              <span className={cn('rounded border px-2 py-1', SEVERITY_CONFIG.CRITICAL.className)}>
                {criticalCount} Critico{criticalCount > 1 ? 's' : ''}
              </span>
            )}
            {highCount > 0 && (
              <span className={cn('rounded border px-2 py-1', SEVERITY_CONFIG.HIGH.className)}>
                {highCount} Alto{highCount > 1 ? 's' : ''}
              </span>
            )}
            {(summary?.resolved ?? 0) > 0 && (
              <span className="rounded border px-2 py-1 text-green-600 bg-green-50 border-green-200">
                {summary?.resolved} Resolvido{(summary?.resolved ?? 0) > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NotifyWinnerModalProps {
  quotationId: string;
  proposalId: string;
  proposal: QuotationProposal;
  quotation?: Quotation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

function buildClosingTemplate(quotation?: Quotation): string {
  const yesNo = (v: boolean | null | undefined) =>
    v === true ? 'Sim' : v === false ? 'Não' : '';

  const seguro = yesNo(quotation?.insurance_required);
  const ptax = quotation?.ptax_negociada ?? '';
  const localColeta = quotation?.origin ?? '';
  const destino =
    quotation?.porto_destino?.join(', ') ||
    quotation?.aeroporto_destino?.join(', ') ||
    '';
  const incoterm = quotation?.incoterm ?? '';
  const empilhavel = yesNo(quotation?.stackability);
  const tombavel = yesNo(quotation?.carga_tombavel);

  let valorCarga = '';
  if (quotation?.declared_value) {
    const curr = quotation.declared_value_currency ?? 'USD';
    valorCarga = `${curr} ${quotation.declared_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  const volumes = quotation?.volumes ?? [];
  const { totalQty, pesoByUnit, totalM3 } = summarizeVolumes(volumes);

  const qtdVolumes = formatVolumesCount(totalQty) ?? '';
  const pesoTotal = formatPesoByUnit(pesoByUnit, '');

  let dimStr = '';
  if (volumes.length === 1) {
    const v = volumes[0];
    const unit = v.dimensao_unidade ?? 'CM';
    if (v.comprimento || v.largura || v.altura) {
      dimStr = `${v.comprimento ?? '?'} x ${v.largura ?? '?'} x ${v.altura ?? '?'} ${unit}`;
      if (v.volume_m3) {
        dimStr += ` / ${v.volume_m3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³`;
      }
    }
  } else if (totalM3 > 0) {
    dimStr = `${totalM3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³`;
  }

  return `Olá,

Fecharemos esse processo com vocês, considerando a cotação em anexo/abaixo como correta, atualizada e contendo todos os custos inerentes ao serviço de agenciamento, caso não esteja, favor informar.

Sempre que houver qualquer alteração de valor e condições (ex transit time, frequência, armador, free time, etc) no decorrer do processo, comunicar previamente o cliente com detalhes do motivo.

Gentileza enviar próximas saídas desta rota.

Ref do exportador:

REF para follows:

Incluir seguro?  ${seguro}

PTAX solicitado:  ${ptax}

LOG TORRE DE CONTROLE - Follow: Todos os emails aqui copiados

LOG COTAÇÃO - Follow: Manter apenas os seguintes emails em cópia:

Local de coleta: ${localColeta}

Destino: ${destino}

Incoterm:  ${incoterm}

Empilhável? ${empilhavel}

Tombável? ${tombavel}

Valor da carga: ${valorCarga}

Quantidade volumes: ${qtdVolumes}

Dimensões/CBM:  ${dimStr}

Peso bruto total: ${pesoTotal}

Contato do Exportador:

CNEE/NOTIFY:

Pedimos em nome do cliente, que em toda e qualquer etapa da cadeia de exportação e importação operacionalizada por terceiros seja formalizado para que se comprometam em tomar os devidos cuidados para manter a integridade dos produtos transportados a fim de evitar ao máximo avarias e danos à mercadoria.

A Freitas Inteligência Aduaneira atua nas cotações prévias e liberações antecipadas exclusivamente como intermediária e facilitadora dessas operações. Portanto, não está contratando o serviço, tampouco se coloca na condição de solidária em relação ao pagamento do frete e outras taxas pertinentes, que foram estabelecidas diretamente entre o prestador do serviço e o tomador. Todos os processos relacionados a garantias, bem como responsabilidades financeiras e legais, devem ser tratados exclusivamente entre o tomador e o prestador do serviço. Em caso de atraso ou falta de pagamento, cabe ao agente de carga entrar em contato direto com o tomador para os devidos acerto.`;
}

interface WinnerConfirmation {
  agentName: string;
  toEmails: string[];  // from server
  sentAt: string;      // from server (ISO)
  ccEmails: string[];  // client-side: what the analyst typed
}

function NotifyWinnerModal({ quotationId, proposalId, proposal, quotation, open, onOpenChange, onDone }: NotifyWinnerModalProps) {
  const { session } = useAuth();
  const [message, setMessage] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [attachPdf, setAttachPdf] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState<WinnerConfirmation | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setMessage(buildClosingTemplate(quotation));
      setCcInput(session?.user?.email ?? '');
      setAttachPdf(false);
      setConfirmation(null);
    }
    wasOpenRef.current = open;
  }, [open, quotation, session]);

  const hasProposalPdf = Boolean(
    proposal.attachments_s3_keys && Object.keys(proposal.attachments_s3_keys).some((k) => k.toLowerCase().endsWith('.pdf')),
  );

  const handleSend = async () => {
    setSending(true);
    const ccEmails = parseEmailList(ccInput);
    const result = await notifyWinner(
      quotationId,
      proposalId,
      message || undefined,
      ccEmails.length > 0 ? ccEmails : undefined,
      attachPdf || undefined,
    );
    setSending(false);
    if (result) {
      setConfirmation({ agentName: result.agentName, toEmails: result.toEmails, sentAt: result.sentAt, ccEmails });
      onDone();
    }
  };

  if (confirmation) {
    const sentAt = new Date(confirmation.sentAt).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="dialog-content-md">
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold">E-mail de fechamento enviado</p>
              <p className="text-xs text-muted-foreground">{sentAt}</p>
            </div>
            <div className="w-full rounded-md border bg-muted/30 text-left text-sm divide-y">
              <div className="flex gap-3 px-4 py-2.5">
                <span className="text-muted-foreground w-20 shrink-0">Agente</span>
                <span className="font-medium">{confirmation.agentName}</span>
              </div>
              <div className="flex gap-3 px-4 py-2.5">
                <span className="text-muted-foreground w-20 shrink-0">Para</span>
                <span className="break-all">{confirmation.toEmails.join(', ') || '—'}</span>
              </div>
              <div className="flex gap-3 px-4 py-2.5">
                <span className="text-muted-foreground w-20 shrink-0">CC</span>
                <span className="break-all">{confirmation.ccEmails.join(', ') || '—'}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Um recibo foi enviado para os endereços em cópia.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Notificar Vencedor
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2 border rounded-md p-3 bg-muted/30">
            <p className="text-sm font-semibold">{proposal.agent?.name ?? `Agente ${proposal.agent_id.slice(0, 8)}`}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{formatCurrencyCode(proposal.total_value, proposal.freight_currency)}</span>
              <span>{proposal.transit_time} dias</span>
              {proposal.carrier && <span>{proposal.carrier}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">CC (cópia)</p>
            <input
              type="text"
              value={ccInput}
              onChange={(e) => setCcInput(e.target.value)}
              placeholder="email1@exemplo.com, email2@exemplo.com"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Seu e-mail foi adicionado automaticamente. Separe múltiplos endereços com vírgula, ponto e vírgula ou espaço.</p>
          </div>
          {hasProposalPdf && (
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox checked={attachPdf} onCheckedChange={(v) => setAttachPdf(Boolean(v))} />
              Anexar cotação aprovada (PDF)
            </label>
          )}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Mensagem de fechamento</p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={16}
              className="resize-y text-sm font-mono"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); onDone(); }}>
            Pular
          </Button>
          <Button size="sm" disabled={sending} onClick={handleSend}>
            {sending ? 'Enviando...' : 'Notificar Vencedor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NotifyLosersModalProps {
  quotationId: string;
  agents: NonWinnerAgent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NotifyLosersModal({ quotationId, agents, open, onOpenChange }: NotifyLosersModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(agents.map((a) => a.id)));
  const [message, setMessage] = useState(
    'Agradecemos pela sua proposta. Após análise, optamos por outra oferta para esta cotação. Ficamos à disposição para futuras oportunidades.',
  );
  const [sending, setSending] = useState(false);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    setSending(true);
    const ok = await notifyLosers(quotationId, Array.from(selectedIds), message);
    setSending(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificar Agentes Nao Selecionados
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Selecione os agentes que devem receber a notificacao de nao selecao:
            </p>
            <div className="flex flex-col gap-2 border rounded-md p-3">
              {agents.map((agent) => (
                <label key={agent.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={selectedIds.has(agent.id)}
                    onCheckedChange={() => handleToggle(agent.id)}
                  />
                  {agent.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Mensagem</p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Pular
          </Button>
          <Button
            size="sm"
            disabled={sending || selectedIds.size === 0}
            onClick={handleSend}
          >
            {sending ? 'Enviando...' : `Enviar para ${selectedIds.size} agente${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function TaxesBreakdownGrouped({
  taxes,
  taxesCurrencyBreakdown,
  freightValue,
  freightCurrency,
}: {
  taxes: Record<string, number>;
  taxesCurrencyBreakdown: Record<string, string> | null;
  freightValue: number;
  freightCurrency: string | null;
}) {
  const fc = freightCurrency ?? 'USD';

  const origem: Record<string, number> = {};
  const frete: Record<string, number> = { [fc]: freightValue };
  const destino: Record<string, number> = {};

  for (const [key, value] of Object.entries(taxes)) {
    const currency = taxesCurrencyBreakdown?.[key] ?? fc;
    const cat = categorizeFee(key);
    if (cat === 'ORIGEM') {
      origem[currency] = (origem[currency] ?? 0) + value;
    } else if (cat === 'FRETE') {
      frete[currency] = (frete[currency] ?? 0) + value;
    } else {
      destino[currency] = (destino[currency] ?? 0) + value;
    }
  }

  const rows: Array<{ label: string; totals: Record<string, number>; color: string }> = [
    { label: 'Taxas de Origem', totals: origem, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Frete Internacional', totals: frete, color: 'text-green-600 dark:text-green-400' },
    { label: 'Taxas de Destino', totals: destino, color: 'text-orange-600 dark:text-orange-400' },
  ];

  return (
    <div className="space-y-1.5">
      {rows.map(({ label, totals, color }) => {
        const formatted = formatMultiCurrency(totals);
        if (formatted === '—') return null;
        return (
          <div key={label} className="flex items-baseline justify-between gap-2 bg-muted/30 rounded px-2 py-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${color}`}>
              {label}
            </span>
            <span className="text-xs tabular-nums font-medium text-right">{formatted}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetricField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </span>
      <span className="font-medium text-sm">
        {value ?? <span className="text-muted-foreground font-normal">—</span>}
      </span>
    </div>
  );
}
