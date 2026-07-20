'use client';

import { useCallback, useRef, useState } from 'react';
import {
  CheckCircle2,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import { toast } from 'react-toastify';

export type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error';

interface UploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  msgUploadProgress: number;
  isUploading: boolean;
  fileStatuses?: Record<string, FileUploadStatus>;
}

const ACCEPTED_TYPES = '.msg,.pdf,.xls,.xlsx,.csv,.txt,.docx,.png,.jpg,.jpeg,.gif,.webp';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'msg') return <Mail className="w-4 h-4 text-blue-500" />;
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-500" />;
  if (ext === 'docx') return <FileText className="w-4 h-4 text-blue-600" />;
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext))
    return <FileImage className="w-4 h-4 text-blue-400" />;
  if (ext === 'txt') return <FileText className="w-4 h-4 text-muted-foreground" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function StatusIndicator({ status }: { status?: FileUploadStatus }) {
  if (!status || status === 'pending') return null;
  if (status === 'uploading')
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />;
  if (status === 'done')
    return <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />;
  return <X className="w-4 h-4 text-red-500 shrink-0" />;
}

function addFiles(existing: File[], incoming: File[]): File[] | null {
  const existingNames = new Set(existing.map((f) => f.name));
  const existingMsgCount = existing.filter((f) =>
    f.name.toLowerCase().endsWith('.msg'),
  ).length;

  const newFiles: File[] = [];
  for (const file of incoming) {
    if (existingNames.has(file.name)) continue;
    if (file.name.toLowerCase().endsWith('.msg')) {
      if (existingMsgCount > 0 || newFiles.some((f) => f.name.toLowerCase().endsWith('.msg'))) {
        toast.warning('Apenas 1 arquivo .msg permitido por cotacao.');
        return null;
      }
    }
    newFiles.push(file);
  }
  return [...existing, ...newFiles];
}

export function UploadZone({
  files,
  onFilesChange,
  msgUploadProgress,
  isUploading,
  fileStatuses,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNewFiles = useCallback(
    (incoming: File[]) => {
      const result = addFiles(files, incoming);
      if (result) onFilesChange(result);
    },
    [files, onFilesChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleNewFiles(Array.from(e.dataTransfer.files));
    },
    [handleNewFiles],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleNewFiles(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const msgFile = files.find((f) => f.name.toLowerCase().endsWith('.msg'));

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone — always visible when not uploading */}
      {!isUploading && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/30',
          )}
        >
          <UploadCloud className="w-10 h-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">
              Arraste todos os documentos do processo aqui
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              .msg, PDF, Word, Excel, CSV, TXT, imagens — max 50 MB por arquivo
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map((file, index) => {
            const status = fileStatuses?.[file.name];
            const isDone = status === 'done';
            const isError = status === 'error';
            const isMsg = file.name.toLowerCase().endsWith('.msg');
            const showProgress = isUploading && isMsg && msgUploadProgress > 0 && msgUploadProgress < 100;

            return (
              <div
                key={`${file.name}-${index}`}
                className={cn(
                  'flex flex-col rounded-md border px-3 py-2 gap-2',
                  isDone && 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20',
                  isError && 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
                  !isDone && !isError && 'bg-muted/20',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(file.name)}
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatBytes(file.size)}
                    </span>
                    {isMsg && (
                      <span className="text-[10px] font-medium text-blue-600 bg-blue-100 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded shrink-0">
                        EMAIL
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusIndicator status={status} />
                    {!isUploading && (
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
                  </div>
                </div>
                {showProgress && (
                  <div className="flex flex-col gap-1">
                    <Progress value={msgUploadProgress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground text-right">
                      {msgUploadProgress}%
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
