'use client';

import { useRef, useState } from 'react';
import { Download, Eye, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import { EmptyState, FileListItem, SectionHeader } from '@arboria-tech/arboria-ui';
import {
  ACCEPTED_UPLOAD_TYPES,
  IMAGE_EXTENSIONS,
  getFileExtension,
  getFileIcon,
} from '@/lib/file-icons';
import type { QuotationAttachment } from '@/types/quotation';

interface QuotationFileListProps {
  attachments: QuotationAttachment[];
  isUploading: boolean;
  /** Called with the picked files when the user adds documents. */
  onUpload: (files: File[]) => void;
  /** When provided, each row shows a delete action wired to this callback. */
  onDelete?: (attachment: QuotationAttachment) => void;
  headerLabel?: string;
  emptyLabel?: string;
}

/**
 * Shared attachment list + upload + preview, used by the analyst
 * attachments-section and the portal documents-section. The analyst wraps it
 * with email-body / original-email / client-links + a delete-confirm dialog
 * (via `onDelete`); the portal uses it standalone.
 */
export function QuotationFileList({
  attachments,
  isUploading,
  onUpload,
  onDelete,
  headerLabel = 'Arquivos Anexados',
  emptyLabel = 'Nenhum arquivo anexado.',
}: QuotationFileListProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<QuotationAttachment | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    if (files.length > 0) onUpload(files);
  };

  const previewExt = previewAttachment ? getFileExtension(previewAttachment.filename) : '';
  const isImage = IMAGE_EXTENSIONS.has(previewExt);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SectionHeader className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          {headerLabel}
        </SectionHeader>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isUploading}
          onClick={() => uploadInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          Adicionar documento
        </Button>
        <input
          ref={uploadInputRef}
          type="file"
          accept={ACCEPTED_UPLOAD_TYPES}
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {attachments.length === 0 ? (
        <EmptyState message={emptyLabel} className="py-3" />
      ) : (
        <div className="flex flex-col gap-2">
          {attachments.map((att) => {
            const Icon = getFileIcon(att.filename);
            return (
              <FileListItem
                key={att.s3_key}
                iconElement={<Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
                name={att.filename}
                actions={
                  <>
                    {att.preview_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setPreviewAttachment(att)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Visualizar
                      </Button>
                    )}
                    <a
                      href={att.download_url}
                      target="_blank"
                      rel="noreferrer"
                      download={att.filename}
                    >
                      <Button variant="ghost" size="sm" className="gap-1.5">
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                    </a>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => onDelete(att)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </Button>
                    )}
                  </>
                }
              />
            );
          })}
        </div>
      )}

      <Dialog
        open={!!previewAttachment}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      >
        <DialogContent size="xl" className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {previewAttachment?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            {previewAttachment?.preview_url && isImage ? (
              <img
                src={previewAttachment.preview_url}
                alt={previewAttachment.filename}
                className="w-full h-auto rounded-md"
              />
            ) : previewAttachment?.preview_url ? (
              <iframe
                src={previewAttachment.preview_url}
                title={previewAttachment.filename}
                className="w-full h-[75vh] rounded-md border-0"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
