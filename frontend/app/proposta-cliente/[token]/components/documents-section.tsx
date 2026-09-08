'use client';

import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ClientPortalProposal } from '@/types/quotation';

interface DocumentsSectionProps {
  proposals: ClientPortalProposal[];
  quotationDocumentUrls: Record<string, string>;
}

async function downloadFile(url: string, filename: string) {
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
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

async function downloadAll(entries: { filename: string; url: string }[]) {
  for (const { filename, url } of entries) {
    await downloadFile(url, filename);
    // Small delay between downloads to avoid browser blocking
    await new Promise((r) => setTimeout(r, 300));
  }
}

function FileList({ entries }: { entries: { filename: string; url: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(({ filename, url }) => (
        <Button
          key={filename}
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => downloadFile(url, filename)}
        >
          <FileText className="w-5 h-5" />
          {filename}
          <Download className="w-5 h-5 text-muted-foreground" />
        </Button>
      ))}
    </div>
  );
}

export function DocumentsSection({ proposals, quotationDocumentUrls }: DocumentsSectionProps) {
  const withPdfs = proposals.filter((p) => Object.keys(p.pdf_urls).length > 0);
  const quotationEntries = Object.entries(quotationDocumentUrls).map(([filename, url]) => ({
    filename,
    url,
  }));

  const hasAgentDocs = withPdfs.length > 0;
  const hasQuotationDocs = quotationEntries.length > 0;

  if (!hasAgentDocs && !hasQuotationDocs) return null;

  const agentEntries = withPdfs.flatMap((p) =>
    Object.entries(p.pdf_urls).map(([filename, url]) => ({ filename, url })),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Quotation documents (uploaded by Freitas team or via AI extraction) */}
      {hasQuotationDocs && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between bg-brand-navy px-4 py-3">
            <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
              Documentos da Cotação
            </p>
            {quotationEntries.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => downloadAll(quotationEntries)}
              >
                <Download className="w-5 h-5" />
                Baixar todos ({quotationEntries.length})
              </Button>
            )}
          </div>
          <div className="px-4 py-3">
            <FileList entries={quotationEntries} />
          </div>
        </div>
      )}

      {/* Agent proposal documents */}
      {hasAgentDocs && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between bg-brand-navy px-4 py-3">
            <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
              Cotação dos Agentes
            </p>
            {agentEntries.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => downloadAll(agentEntries)}
              >
                <Download className="w-5 h-5" />
                Baixar todos ({agentEntries.length})
              </Button>
            )}
          </div>

          <div className="divide-y">
            {withPdfs.map((proposal) => (
              <div key={proposal.agent_name} className="px-4 py-3">
                <p className="text-xs font-semibold text-foreground mb-2">{proposal.agent_name}</p>
                <FileList
                  entries={Object.entries(proposal.pdf_urls).map(([filename, url]) => ({
                    filename,
                    url,
                  }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
