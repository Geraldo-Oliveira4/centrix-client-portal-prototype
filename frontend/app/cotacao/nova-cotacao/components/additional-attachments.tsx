'use client';

import { useCallback, useRef } from 'react';
import { CheckCircle2, Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { FileListItem } from '@arboria-tech/arboria-ui';
import { cn } from '@/lib/utils';
import { ACCEPTED_UPLOAD_TYPES, getFileIcon } from '@/lib/file-icons';

export type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error';

interface AdditionalAttachmentsProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  fileStatuses?: Record<string, FileUploadStatus>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusIndicator({ status }: { status?: FileUploadStatus }) {
  if (!status || status === 'pending') return null;
  if (status === 'uploading')
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />;
  if (status === 'done')
    return <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />;
  return <X className="w-4 h-4 text-red-500 shrink-0" />;
}

export function AdditionalAttachments({
  files,
  onChange,
  disabled = false,
  fileStatuses,
}: AdditionalAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length === 0) return;
      const existing = new Set(files.map((f) => f.name));
      const newFiles = selected.filter((f) => !existing.has(f.name));
      onChange([...files, ...newFiles]);
      if (inputRef.current) inputRef.current.value = '';
    },
    [files, onChange],
  );

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Anexos adicionais</p>
          <span className="text-xs text-muted-foreground">
            (PDF, Word, Excel, imagens)
          </span>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            Adicionar arquivos
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_UPLOAD_TYPES}
          multiple
          className="hidden"
          onChange={handleAdd}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map((file, index) => {
            const status = fileStatuses?.[file.name];
            const isDone = status === 'done';
            const isError = status === 'error';
            const Icon = getFileIcon(file.name);
            return (
              <FileListItem
                key={`${file.name}-${index}`}
                iconElement={<Icon className="w-4 h-4 text-muted-foreground" />}
                name={file.name}
                meta={
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatBytes(file.size)}
                  </span>
                }
                actions={
                  <>
                    <StatusIndicator status={status} />
                    {!disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemove(index)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </>
                }
                className={cn(
                  'py-2',
                  isDone && 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20',
                  isError && 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
                  !isDone && !isError && 'bg-muted/20',
                )}
              />
            );
          })}
        </div>
      )}

      {files.length === 0 && !disabled && (
        <p className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-md">
          Nenhum anexo adicional selecionado
        </p>
      )}
    </div>
  );
}
