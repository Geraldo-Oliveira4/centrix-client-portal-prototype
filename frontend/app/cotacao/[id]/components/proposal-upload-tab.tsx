'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import {
  Button,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useFreightAgents } from '@/hooks/use-freight-agents';
import {
  createProposal,
  triggerProposalExtraction,
  uploadProposalAttachment,
  useProposal,
} from '@/hooks/use-proposals';
import { ProcessingState } from '@/app/cotacao/nova-cotacao/components/processing-state';
import { ProposalManualForm } from './proposal-manual-form';
import type { ProposalFormDefaults } from './proposal-manual-form';
import type { ProposalRouteType } from '@/types/quotation';

type UploadStep = 'idle' | 'uploading' | 'processing' | 'results';

const ACCEPTED_EXTENSIONS = '.msg,.pdf,.docx,.xls,.xlsx,.png,.jpg,.jpeg';
const PROCESSING_TIMEOUT_MS = 120_000;

interface ProposalUploadTabProps {
  quotationId: string;
  onDone: () => void;
}

interface ExtractedProposalForDefaults {
  total_value: number;
  freight_value: number;
  transit_time: number;
  carrier: string | null;
  incoterm: string | null;
  route_type: ProposalRouteType | null;
  route_detail: string | null;
  insurance_included: boolean;
  taxes_breakdown: Record<string, number>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function proposalToFormDefaults(p: ExtractedProposalForDefaults): ProposalFormDefaults {
  return {
    total_value: p.total_value ? String(p.total_value) : '',
    freight_value: p.freight_value ? String(p.freight_value) : '',
    transit_time: p.transit_time ? String(p.transit_time) : '',
    carrier: p.carrier ?? '',
    incoterm: p.incoterm ?? '',
    route_type: p.route_type ?? '',
    route_detail: p.route_detail ?? '',
    insurance_included: p.insurance_included ? 'true' : '',
    taxes: Object.entries(p.taxes_breakdown || {}).map(([key, value]) => ({
      key,
      value: String(value),
      currency: 'USD',
    })),
  };
}

export function ProposalUploadTab({ quotationId, onDone }: ProposalUploadTabProps) {
  const [step, setStep] = useState<UploadStep>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [agentId, setAgentId] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdProposalId, setCreatedProposalId] = useState<string | null>(null);
  const [extractedValues, setExtractedValues] = useState<ProposalFormDefaults | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { agents } = useFreightAgents();

  // Poll the proposal while in processing state
  const isPolling = step === 'processing' && !!createdProposalId;
  const { proposal: polledProposal } = useProposal(
    isPolling ? quotationId : null,
    isPolling ? createdProposalId : null,
    isPolling,
  );

  // Detect extraction completion via polling
  useEffect(() => {
    if (!polledProposal) return;

    if (polledProposal.extraction_status === 'COMPLETED') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setExtractedValues(proposalToFormDefaults(polledProposal));
      setStep('results');
    } else if (polledProposal.extraction_status === 'FAILED') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setStep('results');
    }
  }, [polledProposal]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }, []);

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || !agentId) return;

    setStep('uploading');
    setUploadProgress(0);

    // Create proposal with placeholder values. extraction_pending=true tells the
    // backend to skip audit and state transitions until the AI extraction
    // completes and real field values are available.
    const result = await createProposal(quotationId, {
      agent_id: agentId,
      total_value: 0,
      freight_value: 0,
      taxes_breakdown: {},
      transit_time: 0,
      extraction_pending: true,
    });

    if (!result) {
      setStep('idle');
      return;
    }

    const proposalId = result.proposal.id;
    setCreatedProposalId(proposalId);

    // Upload files sequentially
    const msgFile = selectedFiles.find((f) => f.name.toLowerCase().endsWith('.msg'));
    const otherFiles = selectedFiles.filter((f) => f !== msgFile);
    const allFiles = msgFile ? [msgFile, ...otherFiles] : otherFiles;

    for (let i = 0; i < allFiles.length; i++) {
      const isOriginalEmail = allFiles[i] === msgFile;
      await uploadProposalAttachment(
        quotationId,
        proposalId,
        allFiles[i],
        isOriginalEmail,
      );
      setUploadProgress(Math.round(((i + 1) / allFiles.length) * 100));
    }

    // Trigger AI extraction
    await triggerProposalExtraction(quotationId, proposalId);

    // Enter processing state — polling via useProposal starts automatically
    setStep('processing');
    setTimedOut(false);

    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
    }, PROCESSING_TIMEOUT_MS);
  };

  const handleProceedManually = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStep('results');
  };

  // --- Render per step ---

  if (step === 'processing') {
    return (
      <ProcessingState
        timedOut={timedOut}
        onProceedManually={handleProceedManually}
      />
    );
  }

  if (step === 'results') {
    return (
      <ProposalManualForm
        quotationId={quotationId}
        onProposalCreated={onDone}
        defaultValues={{
          agent_id: agentId,
          ...extractedValues,
        }}
        existingProposalId={createdProposalId ?? undefined}
        existingFiles={selectedFiles}
      />
    );
  }

  if (step === 'uploading') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm font-medium">
          Enviando {selectedFiles.length} arquivo(s)...
        </p>
        <Progress value={uploadProgress} className="w-full max-w-xs" />
        <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
      </div>
    );
  }

  // step === 'idle'
  return (
    <div className="flex flex-col gap-5">
      {/* Agent selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Agente de Carga
        </label>
        <Select onValueChange={setAgentId} value={agentId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar agente..." />
          </SelectTrigger>
          <SelectContent>
            {(agents ?? []).map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <span className="flex items-center gap-2">
                  {agent.name}
                  {agent.reliability_score != null && (
                    <span className={cn(
                      'text-xs font-medium',
                      agent.reliability_score >= 80 ? 'text-green-600' :
                      agent.reliability_score >= 50 ? 'text-yellow-600' :
                      'text-red-600',
                    )}>
                      {agent.reliability_score}%
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleFileChange}
        />
        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          .msg, .pdf, .docx, .xls, .xlsx, .png, .jpg, .jpeg
        </p>
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {selectedFiles.map((file, i) => (
            <div key={i} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({formatFileSize(file.size)})
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-6 w-6"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={selectedFiles.length === 0 || !agentId}
        >
          Enviar e processar
        </Button>
      </div>
    </div>
  );
}
