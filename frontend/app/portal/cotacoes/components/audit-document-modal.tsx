'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, FileText, Loader2, Upload } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { addMyQuotationDocument } from '@/hooks/use-portal-quotations';
import type { PortalAuditPreview } from '@/types/portal-audit';

import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { AuditResult } from '../../_shared/audit-result';

// The document types the client sends for a freight/invoice audit. The backend
// stores the file by name only (no type column), so the slot is UX labelling —
// but the upload itself is REAL (presigned S3 PUT via the quotation attachments
// endpoint). Only the "analysis" that would follow is not wired yet.
const SLOTS = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'packing', label: 'Packing List' },
  { key: 'bl', label: 'BL' },
] as const;

type SlotKey = (typeof SLOTS)[number]['key'];

interface AuditDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string | null;
  reference: string;
  preview: PortalAuditPreview | null;
  onSubmitted: (quotationId: string) => void;
}

function UploadSlot({
  label,
  uploadedName,
  uploading,
  onFile,
}: {
  label: string;
  uploadedName: string | null;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-5 w-5 shrink-0 text-portal-neutral" />
        <div className="min-w-0">
          <p className="portal-body font-medium text-foreground">{label}</p>
          {uploadedName ? (
            <p className="portal-small truncate text-portal-neutral">{uploadedName}</p>
          ) : (
            <p className="portal-small text-portal-neutral">PDF, imagem ou planilha</p>
          )}
        </div>
      </div>
      {uploadedName ? (
        <span className="inline-flex items-center gap-1 portal-small font-medium text-portal-success">
          <Check className="h-4 w-4" />
          Enviado
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Selecionar
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (inputRef.current) inputRef.current.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

export function AuditDocumentModal({
  open,
  onOpenChange,
  quotationId,
  reference,
  preview,
  onSubmitted,
}: AuditDocumentModalProps) {
  const [uploaded, setUploaded] = useState<Record<SlotKey, string | null>>({
    invoice: null,
    packing: null,
    bl: null,
  });
  const [uploadingKey, setUploadingKey] = useState<SlotKey | null>(null);
  const [phase, setPhase] = useState<'upload' | 'sent'>('upload');

  // Reset each time the modal opens for a (possibly different) quotation.
  useEffect(() => {
    if (open) {
      setUploaded({ invoice: null, packing: null, bl: null });
      setUploadingKey(null);
      setPhase('upload');
    }
  }, [open, quotationId]);

  const handleFile = async (key: SlotKey, file: File) => {
    if (!quotationId) return;
    setUploadingKey(key);
    const ok = await addMyQuotationDocument(quotationId, file);
    if (ok) setUploaded((prev) => ({ ...prev, [key]: file.name }));
    setUploadingKey(null);
  };

  const anyUploaded = Object.values(uploaded).some(Boolean);

  const handleSubmit = () => {
    if (!quotationId) return;
    onSubmitted(quotationId);
    setPhase('sent');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Enviar documentação — {reference}
            <ProvenanceBadge provenance="preview" />
          </DialogTitle>
        </DialogHeader>

        {phase === 'upload' ? (
          <div className="space-y-4">
            <p className="portal-body text-portal-neutral">
              Envie a documentação do embarque para conferência do valor realizado.
              O upload dos arquivos é real; a conferência automática ainda não está
              integrada neste protótipo.
            </p>
            <div className="space-y-2">
              {SLOTS.map((slot) => (
                <UploadSlot
                  key={slot.key}
                  label={slot.label}
                  uploadedName={uploaded[slot.key]}
                  uploading={uploadingKey === slot.key}
                  onFile={(file) => handleFile(slot.key, file)}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={!anyUploaded || uploadingKey !== null} onClick={handleSubmit}>
                Enviar para conferência
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Status do envio: Recebido -> Em análise -> Resultado */}
            <ol className="flex items-center gap-2">
              <li className="inline-flex items-center gap-1.5 portal-small font-medium text-portal-success">
                <Check className="h-4 w-4" />
                Recebido
              </li>
              <span className="h-px w-6 bg-border" />
              <li className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
                Em análise
                <ProvenanceBadge provenance="pending" />
              </li>
              <span className="h-px w-6 bg-border" />
              <li className="portal-small text-portal-neutral">Resultado</li>
            </ol>

            <p className="portal-body text-portal-neutral">
              Documentos recebidos. A conferência automática de fatura/BL ainda não
              está integrada, então o resultado abaixo segue sendo o comparativo
              ilustrativo — o mesmo que aparece no painel.
            </p>

            {preview ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
                <AuditResult preview={preview} />
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
