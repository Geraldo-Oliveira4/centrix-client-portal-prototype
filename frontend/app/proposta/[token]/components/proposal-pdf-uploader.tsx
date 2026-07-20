'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { FileText, Loader2, CheckCircle2, AlertCircle, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadFileToS3 } from '@/lib/upload-file';
import type {
  PortalProposalExtractionResult,
  PortalProposalExtractedFields,
} from '@/types/quotation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UploaderStep = 'idle' | 'uploading' | 'extracting' | 'done' | 'manual' | 'error';

interface ProposalPdfUploaderProps {
  token: string;
  apiUrl: string;
  onExtracted: (fields: PortalProposalExtractedFields, sourcePdfS3Key: string) => void;
  // Called when the file landed in S3 but AI extraction failed/timed out.
  // The upload is still valid for submission — the agent just fills the form manually.
  onAttachedWithoutExtraction: (sourcePdfS3Key: string) => void;
  showError?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUploadUrl(
  apiUrl: string,
  token: string,
  filename: string,
): Promise<{ presigned_url: string; s3_key: string }> {
  return axios
    .get<{ presigned_url: string; s3_key: string }>(`${apiUrl}/public/rfq/upload-url`, {
      params: { token, filename },
    })
    .then((res) => res.data);
}

function confirmUpload(apiUrl: string, token: string, s3Key: string): Promise<void> {
  return axios
    .post(`${apiUrl}/public/rfq/confirm-upload`, { s3_key: s3Key }, { params: { token } })
    .then(() => undefined);
}

function extractPdf(
  apiUrl: string,
  token: string,
  s3Key: string,
): Promise<PortalProposalExtractionResult> {
  return axios
    .post<PortalProposalExtractionResult>(
      `${apiUrl}/public/rfq/extract-pdf`,
      { s3_key: s3Key },
      { params: { token } },
    )
    .then((res) => res.data);
}

function parseS3XmlError(data: unknown): string | null {
  if (typeof data !== 'string' || !data.includes('<Error>')) return null;
  const code = data.match(/<Code>([^<]+)<\/Code>/)?.[1];
  return code ? `Erro no upload (${code}). Tente novamente ou preencha o formulario manualmente.` : null;
}

function countFilledFields(fields: PortalProposalExtractedFields): number {
  return Object.values(fields).filter((v) => v !== null && v !== undefined).length;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProposalPdfUploader({ token, apiUrl, onExtracted, onAttachedWithoutExtraction, showError }: ProposalPdfUploaderProps) {
  const [step, setStep] = useState<UploaderStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filledCount, setFilledCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'xlsx', 'xls', 'jpg', 'jpeg', 'png'];
    if (!ext || !allowed.includes(ext)) {
      setErrorMessage('Formato nao suportado. Use PDF, Excel ou imagem.');
      setStep('error');
      return;
    }

    setStep('uploading');
    setErrorMessage(null);

    // Phase 1: upload + confirm. A failure here means the file is NOT safely in
    // S3, so there is no valid key to submit — this must block (hard error).
    let s3Key: string;
    try {
      // Step 1: get presigned URL
      const { presigned_url, s3_key } = await getUploadUrl(apiUrl, token, file.name);

      // Step 2: upload directly to S3
      await uploadFileToS3(presigned_url, file, undefined, { silent: true });

      // Step 3: confirm the file landed in S3 (observability + early error detection).
      // Both steps 2 and 3 share the 'uploading' step intentionally — confirm is fast
      // and the user does not need a separate "Verificando..." label for it.
      await confirmUpload(apiUrl, token, s3_key);

      s3Key = s3_key;
    } catch (err: unknown) {
      let message = 'Nao foi possivel enviar o arquivo. Verifique sua conexao e tente novamente.';
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          message = err.response.data.error as string;
        } else {
          const s3Error = parseS3XmlError(err.response?.data);
          if (s3Error) message = s3Error;
        }
      }
      setErrorMessage(message);
      setStep('error');
      return;
    }

    // Phase 2: synchronous AI extraction. The file is already in S3, so any
    // failure here (timeout, model error, unreadable PDF) must NOT block the
    // agent — keep the upload and let them fill the form manually.
    setStep('extracting');
    try {
      const result = await extractPdf(apiUrl, token, s3Key);
      const count = countFilledFields(result.extracted_fields);
      setFilledCount(count);
      setStep('done');
      onExtracted(result.extracted_fields, s3Key);
    } catch {
      setStep('manual');
      onAttachedWithoutExtraction(s3Key);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected after an error
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStep('idle');
    setErrorMessage(null);
    setFilledCount(0);
  };

  const isProcessing = step === 'uploading' || step === 'extracting';

  if (step === 'done') {
    return (
      <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm">
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        <span className="text-green-800 flex-1">
          PDF processado —{' '}
          <span className="font-semibold">{filledCount} campo{filledCount !== 1 ? 's' : ''}</span>{' '}
          preenchido{filledCount !== 1 ? 's' : ''} automaticamente. Revise os valores antes de enviar.
        </span>
        <button
          type="button"
          onClick={reset}
          className="text-green-600 hover:text-green-800 transition-colors"
          aria-label="Carregar outro arquivo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (step === 'manual') {
    return (
      <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-amber-800 flex-1">
          Arquivo anexado. Nao foi possivel preencher os campos automaticamente —{' '}
          <span className="font-semibold">preencha o formulario manualmente</span> e envie normalmente.
        </span>
        <button
          type="button"
          onClick={reset}
          className="text-amber-600 hover:text-amber-800 transition-colors"
          aria-label="Carregar outro arquivo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
        <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
        <span className="text-destructive flex-1">{errorMessage}</span>
        <button
          type="button"
          onClick={reset}
          className="text-destructive/70 hover:text-destructive transition-colors"
          aria-label="Tentar novamente"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span>
          {step === 'uploading' ? 'Enviando arquivo...' : 'Extraindo dados do PDF...'}
        </span>
      </div>
    );
  }

  // idle
  return (
    <div className="flex flex-col gap-1">
      <div
        role="button"
        tabIndex={0}
        aria-label="Fazer upload de PDF da proposta (obrigatorio)"
        className={cn(
          'flex items-center gap-3 rounded-md border border-dashed px-4 py-3 text-sm cursor-pointer',
          'transition-colors hover:bg-muted/30 hover:border-muted-foreground/40',
          isDragging && 'bg-muted/40 border-muted-foreground/50',
          showError && 'border-destructive bg-destructive/5 hover:bg-destructive/10',
        )}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud className={cn('w-4 h-4 shrink-0', showError ? 'text-destructive' : 'text-muted-foreground')} />
        <div className="flex-1">
          <span className={cn('font-medium', showError ? 'text-destructive' : 'text-foreground')}>
            Anexar PDF da proposta
          </span>
          <span className="text-muted-foreground ml-1.5">
            — arraste ou clique para selecionar
          </span>
        </div>
        <FileText className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
      {showError && (
        <p className="text-xs text-destructive px-1">
          O PDF da proposta e obrigatorio. Anexe o arquivo antes de enviar.
        </p>
      )}
    </div>
  );
}
