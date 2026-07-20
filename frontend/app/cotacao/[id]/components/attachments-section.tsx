'use client';

import { useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Download, Loader2, Mail } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@/components/ui';
import { LoadingState } from '@arboria-tech/arboria-ui';
import { SectionHeader } from '@arboria-tech/arboria-ui';
import { QuotationFileList } from '@/components/quotation-file-list';
import {
  addQuotationDocument,
  deleteQuotationDocument,
  fetchAttachments,
  fetchOriginalEmailDownloadUrl,
} from '@/hooks/use-quotations';
import type { QuotationAttachment } from '@/types/quotation';
import { ClientLinksSection } from './client-links-section';

interface AttachmentsSectionProps {
  quotationId: string;
  hasOriginalEmail: boolean;
}

export function AttachmentsSection({
  quotationId,
  hasOriginalEmail,
}: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<QuotationAttachment[]>([]);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingEmail, setIsDownloadingEmail] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuotationAttachment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAttachments = useCallback(() => {
    setIsLoading(true);
    fetchAttachments(quotationId).then((result) => {
      setAttachments(result.items);
      setEmailBody(result.email_body);
      setIsLoading(false);
    });
  }, [quotationId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    for (const file of files) {
      await addQuotationDocument(quotationId, file);
    }
    setIsUploading(false);
    loadAttachments();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const deleted = await deleteQuotationDocument(quotationId, deleteTarget.filename);
    setIsDeleting(false);
    if (deleted) {
      setDeleteTarget(null);
      loadAttachments();
    }
  };

  const handleDownloadEmail = async () => {
    setIsDownloadingEmail(true);
    const url = await fetchOriginalEmailDownloadUrl(quotationId);
    setIsDownloadingEmail(false);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'email-original.msg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (isLoading) {
    return <LoadingState spinner message="Carregando documentos..." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Email body content */}
      {emailBody && (
        <div className="flex flex-col gap-2">
          <SectionHeader className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Conteúdo do Email
          </SectionHeader>
          <div
            className="rounded-lg border bg-muted/30 p-4 text-sm prose prose-sm max-w-none overflow-auto max-h-96"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(emailBody) }}
          />
        </div>
      )}

      <QuotationFileList
        attachments={attachments}
        isUploading={isUploading}
        onUpload={handleUpload}
        onDelete={setDeleteTarget}
      />

      {/* Original email download */}
      {hasOriginalEmail && (
        <div className="flex flex-col gap-2">
          <SectionHeader>Email Original</SectionHeader>
          <Button
            variant="outline"
            className="w-fit gap-2"
            onClick={handleDownloadEmail}
            disabled={isDownloadingEmail}
          >
            {isDownloadingEmail ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Baixar Email Original (.msg)
          </Button>
        </div>
      )}

      <ClientLinksSection quotationId={quotationId} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.filename}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
