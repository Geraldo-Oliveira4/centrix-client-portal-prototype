'use client';

import { useRef, useState } from 'react';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { FileListItem, LoaderComponent, EmptyState } from '@arboria-tech/arboria-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  deleteShipmentDocumento,
  uploadShipmentDocumento,
  useShipmentDocumentos,
} from '@/hooks/use-shipments';
import type { EmbarqueDocumento } from '@/types/shipment';

interface DocumentosSectionProps {
  processId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DocumentosSection({ processId }: DocumentosSectionProps) {
  const { documentos, tiposArquivo, isLoading } = useShipmentDocumentos(processId);
  const [tipoCodigo, setTipoCodigo] = useState('');
  const [tipoLabelFallback, setTipoLabelFallback] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmbarqueDocumento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const tipoOptions = [...tiposArquivo.curated, ...tiposArquivo.outros].map((t) => ({
    value: String(t.codigo),
    label: t.descricao,
  }));
  const hasTipoOptions = tipoOptions.length > 0;

  const resolveTipo = (): { label: string; codigo: number | null } | null => {
    if (hasTipoOptions) {
      const selected = tipoOptions.find((o) => o.value === tipoCodigo);
      return selected ? { label: selected.label, codigo: Number(selected.value) } : null;
    }
    const label = tipoLabelFallback.trim();
    return label ? { label, codigo: null } : null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    if (!file) return;

    const tipo = resolveTipo();
    if (!tipo) return;

    setIsUploading(true);
    const uploaded = await uploadShipmentDocumento(processId, file, {
      tipo_arquivo_label: tipo.label,
      tipo_arquivo_codigo: tipo.codigo,
    });
    setIsUploading(false);
    if (uploaded) {
      setTipoCodigo('');
      setTipoLabelFallback('');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const deleted = await deleteShipmentDocumento(processId, deleteTarget.id);
    setIsDeleting(false);
    if (deleted) setDeleteTarget(null);
  };

  const canUpload = !!resolveTipo() && !isUploading;

  if (isLoading) {
    return <LoaderComponent />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 p-4 rounded-md border bg-muted/20">
        <p className="text-sm font-medium">Anexar documento</p>
        <div className="flex flex-col sm:flex-row gap-2">
          {hasTipoOptions ? (
            <Combobox
              value={tipoCodigo}
              onValueChange={setTipoCodigo}
              options={tipoOptions}
              placeholder="Tipo de documento..."
              searchPlaceholder="Buscar tipo..."
            />
          ) : (
            <Input
              value={tipoLabelFallback}
              onChange={(e) => setTipoLabelFallback(e.target.value)}
              placeholder="Tipo de documento (ex: Invoice, Packing List...)"
            />
          )}
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 shrink-0"
            disabled={!canUpload}
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploading ? 'Enviando...' : 'Selecionar arquivo'}
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {documentos.length === 0 ? (
        <EmptyState message="Nenhum documento anexado." className="py-3" />
      ) : (
        <div className="flex flex-col gap-2">
          {documentos.map((doc) => (
            <FileListItem
              key={doc.id}
              iconElement={<FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
              name={doc.tipo_arquivo_label}
              meta={formatDate(doc.created_at)}
              actions={
                <>
                  {doc.download_url && (
                    <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                      <a href={doc.download_url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-3.5 h-3.5" />
                        Baixar
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(doc)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover &quot;{deleteTarget?.tipo_arquivo_label}&quot;? Essa
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
