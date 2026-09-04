'use client';

import { Download, Eye, FileText, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatShortDate } from '@/lib/portal-formatters';
import { cn } from '@/lib/utils';

import { SectionHeading } from '../../_shared/page-header';
import {
  formatFileSize,
  type ShipmentDocument,
  type ShipmentDocumentStatus,
} from '../lib/shipment-documents';

/**
 * Seção "Documentos" do detalhe do embarque.
 *
 * Aberta e no mesmo peso visual das outras seções primárias (`.portal-card`),
 * nunca dentro de accordion: documento é a segunda pergunta que o cliente traz
 * para esta tela, depois de "onde está minha carga", e um arquivo que só existe
 * atrás de um clique de expansão é um arquivo que ninguém encontra.
 *
 * A lista vem de `lib/shipment-documents.ts`, que já monta o shape da futura
 * Aprovação Documental (código do tipo, status, responsável). Aqui é só
 * apresentação: o que muda quando a integração existir é a origem da lista, não
 * esta tela.
 *
 * Pendente do CLIENTE ganha botão de envio; o resto ganha visualizar/baixar. É
 * a mesma distinção que alimenta o gatilho de ação da timeline — os dois leem o
 * mesmo registro, então a etapa nunca cobra um documento que a lista mostra
 * como entregue.
 */

const STATUS_LABEL: Record<ShipmentDocumentStatus, string> = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
};

const STATUS_CLASS: Record<ShipmentDocumentStatus, string> = {
  pendente: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning-ink',
  em_analise: 'border-portal-info/30 bg-portal-info/10 text-portal-info',
  aprovado: 'border-portal-success/25 bg-portal-success/10 text-portal-success',
};

export function ShipmentDocumentsSection({
  documents,
  onUpload,
  onOpen,
}: {
  documents: ShipmentDocument[];
  /** Documento que o cliente ainda deve. */
  onUpload: (document: ShipmentDocument) => void;
  /** Visualizar ou baixar um documento existente. */
  onOpen: (document: ShipmentDocument, intent: 'view' | 'download') => void;
}) {
  const pending = documents.filter((d) => d.status === 'pendente').length;

  return (
    <section id="documentos" className="portal-card space-y-4 scroll-mt-6 p-6">
      <SectionHeading
        title="Documentos"
        icon={<FileText className="h-5 w-5" />}
        hint={
          pending > 0
            ? `${documents.length} documentos · ${pending} aguardando você`
            : `${documents.length} documentos`
        }
      />

      {documents.length === 0 ? (
        <p className="portal-body text-portal-neutral">
          Nenhum documento emitido para este embarque até o momento.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              // Empilha no mobile pela mesma razão do gatilho de ação: lado a
              // lado, o botão espremia o nome do arquivo a uma palavra por linha.
              className={cn(
                'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-4',
                doc.status === 'pendente'
                  ? 'border-portal-warning/30 bg-portal-warning/[0.04]'
                  : 'border-border bg-white',
              )}
            >
              <FileText
                className={cn(
                  'h-5 w-5 shrink-0',
                  doc.status === 'pendente'
                    ? 'text-portal-warning-ink'
                    : 'text-portal-neutral',
                )}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="portal-body font-medium text-foreground">
                    {doc.label}
                  </p>
                  <span
                    className={cn(
                      'portal-small inline-flex items-center rounded border px-1.5 py-0.5 font-medium',
                      STATUS_CLASS[doc.status],
                    )}
                  >
                    {STATUS_LABEL[doc.status]}
                  </span>
                </div>
                <p className="portal-small text-portal-neutral">
                  {doc.fileName ? (
                    <>
                      {doc.fileName}
                      {doc.uploadedAt && ` · ${formatShortDate(doc.uploadedAt)}`}
                      {doc.sizeBytes != null && ` · ${formatFileSize(doc.sizeBytes)}`}
                    </>
                  ) : (
                    // Sem arquivo não há metadado a mostrar; o que importa é de
                    // quem é a bola.
                    'Aguardando envio pelo importador'
                  )}
                </p>
              </div>

              {doc.status === 'pendente' && doc.source === 'cliente' ? (
                <Button
                  size="sm"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() => onUpload(doc)}
                >
                  <Upload className="h-4 w-4" />
                  Enviar arquivo
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => onOpen(doc, 'view')}
                  >
                    <Eye className="h-4 w-4" />
                    Visualizar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-portal-neutral hover:text-foreground"
                    onClick={() => onOpen(doc, 'download')}
                  >
                    <Download className="h-4 w-4" />
                    Baixar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="portal-small text-portal-neutral">
        A lista acompanha o andamento do embarque: cada documento aparece quando
        a etapa que o gera é alcançada e muda de status conforme é validado.
      </p>
    </section>
  );
}
