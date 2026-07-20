'use client';

import { useState } from 'react';
import { FileDown, Eye, Link, Send, Loader2, Files } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@/components/ui';
import { ClientLinkDialog } from './client-link-dialog';
import { ProposalPDFViewer, ProposalDocument } from './proposal-document';
import type { ProposalDocumentConfig } from './proposal-document';
import { fetchProposalAttachments } from '@/hooks/use-proposals';
import type { Quotation, QuotationProposal } from '@/types/quotation';
import type { QuotationClient } from '@/types/client';

async function triggerFileDownload(url: string, filename: string): Promise<void> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    // CORS or network error — open in new tab as fallback
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

interface ClientProposalSectionProps {
  quotationId: string;
  quotation: Quotation;
  proposals: QuotationProposal[];
  isLoadingProposals: boolean;
  client: QuotationClient | undefined;
  onMarkAsSent: () => void;
  canMarkAsSent: boolean;
}

export function ClientProposalSection({
  quotationId,
  quotation,
  proposals,
  isLoadingProposals,
  client,
  onMarkAsSent,
  canMarkAsSent,
}: ClientProposalSectionProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [clientLinkDialogOpen, setClientLinkDialogOpen] = useState(false);
  const [config, setConfig] = useState<ProposalDocumentConfig>({
    includeComparison: true,
    highlightRecommendation: true,
    includeCostBreakdown: false,
    includeTimeline: false,
    observations: '',
  });
  const [showPreview, setShowPreview] = useState(false);

  const documentData = {
    quotation,
    proposals,
    client,
    config,
  };

  const hasProposals = proposals.length > 0;
  const hasWinner = proposals.some((p) => p.is_winner);
  const proposalsWithPdf = proposals.filter(
    (p) => Object.keys(p.attachments_s3_keys || {}).length > 0,
  );

  const pdfFilename = `Proposta_${quotation.reference}_${new Date().toISOString().split('T')[0]}.pdf`;

  const handleDownloadAllAgentPdfs = async () => {
    if (proposalsWithPdf.length === 0) return;
    setDownloadingAll(true);
    try {
      for (const proposal of proposalsWithPdf) {
        const result = await fetchProposalAttachments(quotationId, proposal.id);
        if (!result) continue;
        for (const item of result.items) {
          await triggerFileDownload(item.download_url, item.filename);
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Proposta para Cliente</h3>

        {isLoadingProposals ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando propostas...
          </div>
        ) : !hasProposals ? (
          <div className="text-muted-foreground text-sm">
            Nenhuma proposta disponível. Aguarde os agentes enviarem suas cotações.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base">Conteúdo da Proposta</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeComparison"
                      checked={config.includeComparison}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({
                          ...prev,
                          includeComparison: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="includeComparison" className="cursor-pointer">
                      Incluir comparativo completo entre agentes
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="highlightRecommendation"
                      checked={config.highlightRecommendation}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({
                          ...prev,
                          highlightRecommendation: checked === true,
                        }))
                      }
                      disabled={!hasWinner}
                    />
                    <Label
                      htmlFor="highlightRecommendation"
                      className={`cursor-pointer ${!hasWinner ? 'text-muted-foreground' : ''}`}
                    >
                      Destacar proposta recomendada
                      {!hasWinner && ' (selecione um vencedor primeiro)'}
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeCostBreakdown"
                      checked={config.includeCostBreakdown}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({
                          ...prev,
                          includeCostBreakdown: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="includeCostBreakdown" className="cursor-pointer">
                      Incluir breakdown de custos
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeTimeline"
                      checked={config.includeTimeline}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({
                          ...prev,
                          includeTimeline: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="includeTimeline" className="cursor-pointer">
                      Incluir cronograma de entrega
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations" className="text-base">
                  Observações
                </Label>
                <Textarea
                  id="observations"
                  placeholder="Adicione observações ou condições especiais para o cliente..."
                  value={config.observations}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, observations: e.target.value }))
                  }
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                Pré-visualizar
              </Button>

              <PDFDownloadLink
                document={<ProposalDocument {...documentData} />}
                fileName={pdfFilename}
              >
                {({ loading }) => (
                  <Button
                    variant="outline"
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    {loading ? 'Gerando PDF...' : 'Baixar PDF'}
                  </Button>
                )}
              </PDFDownloadLink>

              {proposalsWithPdf.length > 0 && (
                <Button
                  variant="outline"
                  disabled={downloadingAll}
                  onClick={handleDownloadAllAgentPdfs}
                  className="gap-2"
                >
                  {downloadingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Files className="w-4 h-4" />
                  )}
                  {downloadingAll
                    ? 'Baixando...'
                    : `Baixar todos os PDFs dos agentes (${proposalsWithPdf.length})`}
                </Button>
              )}

              {hasProposals && (
                <Button
                  variant="outline"
                  onClick={() => setClientLinkDialogOpen(true)}
                  className="gap-2"
                >
                  <Link className="w-4 h-4" />
                  Enviar ao Cliente
                </Button>
              )}

              {canMarkAsSent && (
                <Button onClick={onMarkAsSent} className="gap-2">
                  <Send className="w-4 h-4" />
                  Marcar como Enviada ao Cliente
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização da Proposta</DialogTitle>
          </DialogHeader>
          <ProposalPDFViewer data={documentData} />
        </DialogContent>
      </Dialog>

      <ClientLinkDialog
        quotationId={quotationId}
        clientEmail={client?.email}
        open={clientLinkDialogOpen}
        onOpenChange={setClientLinkDialogOpen}
      />
    </div>
  );
}
