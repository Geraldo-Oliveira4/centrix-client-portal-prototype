'use client';

import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import type { QuotationProposal } from '@/types/quotation';
import { ProposalManualForm, type ProposalFormDefaults } from './proposal-manual-form';
import { ProposalUploadTab } from './proposal-upload-tab';

interface ProposalModalProps {
  quotationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal?: QuotationProposal;
  mode?: 'edit' | 'duplicate';
}

function proposalToDefaults(proposal: QuotationProposal): ProposalFormDefaults {
  return {
    agent_id: proposal.agent_id,
    total_value: String(proposal.total_value),
    freight_value: String(proposal.freight_value),
    freight_currency: proposal.freight_currency ?? 'USD',
    transit_time: String(proposal.transit_time),
    taxes: Object.entries(proposal.taxes_breakdown ?? {}).map(([key, value]) => ({
      key,
      value: String(value),
      currency: proposal.taxes_currency_breakdown?.[key] ?? 'USD',
    })),
    route_type: proposal.route_type ?? '',
    route_detail: proposal.route_detail ?? '',
    carrier: proposal.carrier ?? '',
    validity: proposal.validity ? proposal.validity.slice(0, 10) : '',
    insurance_included:
      proposal.insurance_included === true
        ? 'true'
        : proposal.insurance_included === false
          ? 'false'
          : '',
    incoterm: proposal.incoterm ?? '',
  };
}

const TITLE_MAP: Record<string, string> = {
  edit: 'Editar Proposta',
  duplicate: 'Duplicar Proposta',
};

export function ProposalModal({ quotationId, open, onOpenChange, proposal, mode }: ProposalModalProps) {
  const [activeTab, setActiveTab] = useState<string>('manual');
  const resolvedMode = proposal ? (mode ?? 'edit') : null;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => setActiveTab('manual'), 200);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resolvedMode ? TITLE_MAP[resolvedMode] : 'Registrar Proposta'}
          </DialogTitle>
        </DialogHeader>

        {resolvedMode === 'edit' && proposal ? (
          <ProposalManualForm
            quotationId={quotationId}
            onProposalCreated={handleClose}
            defaultValues={proposalToDefaults(proposal)}
            existingProposalId={proposal.id}
            existingProposal={proposal}
          />
        ) : resolvedMode === 'duplicate' && proposal ? (
          <ProposalManualForm
            quotationId={quotationId}
            onProposalCreated={handleClose}
            defaultValues={proposalToDefaults(proposal)}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="upload" className="flex-1">
                Upload de Arquivos
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">
                Preenchimento Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <ProposalUploadTab
                quotationId={quotationId}
                onDone={handleClose}
              />
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <ProposalManualForm
                quotationId={quotationId}
                onProposalCreated={handleClose}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
