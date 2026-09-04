'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
import { StatusMessage } from '@/components/status-message';
import { QuotationSummaryCard } from './components/quotation-summary-card';
import { ProposalsClientTable } from './components/proposals-client-table';
import { EstimatedArrivalSection } from './components/estimated-arrival-section';
import { RecommendationSection } from './components/recommendation-section';
import { DocumentsSection } from './components/documents-section';
import { LiabilityDisclaimerSection } from './components/liability-disclaimer-section';
import { ProposalApprovalSection, ApprovalSuccessBanner } from './components/proposal-approval-section';
import type { ClientPortalData } from '@/types/quotation';

const API_URL = process.env.NEXT_PUBLIC_API ?? '';

type PageState = 'loading' | 'ready' | 'expired' | 'invalid' | 'error';

export default function PropostaClientePage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [approvedBy, setApprovedBy] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }

    setPageState('loading');
    axios
      .get<ClientPortalData>(`${API_URL}/public/cotacao/view`, { params: { token } })
      .then((res) => {
        setData(res.data);
        setPageState('ready');
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 404) setPageState('invalid');
        else if (status === 410) setPageState('expired');
        else setPageState('error');
      });
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const alreadyApproved = data?.proposals.find((p) => p.is_winner);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="relative overflow-hidden bg-brand-navy px-6 lg:px-10 py-4">
        {/* Decorative circles echoing the brand dot motif */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 flex items-center gap-4 pr-8 opacity-15">
          <div className="h-20 w-20 rounded-full bg-brand-orange-500" />
          <div className="h-12 w-12 rounded-full bg-brand-orange-500" />
          <div className="h-7 w-7 rounded-full bg-brand-orange-500" />
          <div className="h-4 w-4 rounded-full bg-brand-orange-500" />
        </div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/freitas-logo-branca.png"
              alt="Freitas"
              width={36}
              height={36}
              className="shrink-0"
            />
            <div>
              <p className="text-base font-semibold text-white leading-tight tracking-wide">
                freitas
              </p>
              {data && (
                <p className="text-xs text-white/60 mt-0.5">
                  Proposta Comercial — {data.quotation.reference}
                </p>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange-500" />
            <span className="text-xs text-white/50 tracking-wider uppercase">Portal do Cliente</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="px-6 lg:px-10 py-6">
        {pageState === 'loading' && (
          <div className="flex justify-center items-center py-24 text-muted-foreground text-sm">
            Carregando...
          </div>
        )}

        {pageState === 'invalid' && (
          <StatusMessage
            title="Link invalido"
            description="Este link nao existe ou expirou. Entre em contato com a equipe Freitas COMEX."
            onRetry={fetchData}
            logoSrc="/freitas-logo-azul.png"
            titleClassName="text-brand-indigo"
          />
        )}

        {pageState === 'expired' && (
          <StatusMessage
            title="Cotacao encerrada"
            description="Esta cotacao foi encerrada. Se voce acredita que isso e um erro, tente novamente antes de entrar em contato com a equipe Freitas COMEX."
            onRetry={fetchData}
            logoSrc="/freitas-logo-azul.png"
            titleClassName="text-brand-indigo"
          />
        )}

        {pageState === 'error' && (
          <StatusMessage
            title="Erro ao carregar"
            description="Nao foi possivel carregar os dados. Tente novamente em alguns instantes."
            onRetry={fetchData}
            logoSrc="/freitas-logo-azul.png"
            titleClassName="text-brand-indigo"
          />
        )}

        {pageState === 'ready' && data && (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
              {data.client && (
                <p className="text-sm text-muted-foreground">
                  Ola,{' '}
                  <span className="font-semibold text-foreground">{data.client.name}</span>.
                  Preparamos o comparativo de propostas para a sua solicitacao.
                </p>
              )}

              <QuotationSummaryCard data={data} variant="sidebar" />

              {data.observations && (
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-semibold text-brand-indigo uppercase tracking-wide mb-2">
                    Mensagem da Freitas COMEX
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {data.observations}
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-brand-orange-500/30 bg-brand-orange-50 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Link valido ate{' '}
                  <span className="font-semibold text-brand-orange-800">
                    {new Date(data.expires_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  As informacoes contidas neste documento sao confidenciais e destinadas
                  exclusivamente ao destinatario.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 py-1">
                <Image
                  src="/freitas-logo.png"
                  alt="Freitas"
                  width={18}
                  height={18}
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground">
                  Freitas COMEX
                </p>
              </div>
            </aside>

            {/* Main content */}
            <main className="flex flex-col gap-5 min-w-0">
              <ProposalsClientTable proposals={data.proposals} quotation={data.quotation} />

              <EstimatedArrivalSection proposals={data.proposals} />

              <RecommendationSection recommendation={data.recommendation} proposals={data.proposals} />

              <DocumentsSection
                proposals={data.proposals}
                quotationDocumentUrls={data.quotation.document_urls}
              />

              <LiabilityDisclaimerSection
                modal={data.quotation.modal}
                tipoEmbarque={data.quotation.tipo_embarque}
              />

              {approvedBy || alreadyApproved ? (
                <ApprovalSuccessBanner
                  agentName={approvedBy ?? alreadyApproved!.agent_name}
                />
              ) : (
                <ProposalApprovalSection
                  proposals={data.proposals}
                  token={token}
                  apiUrl={API_URL}
                  onApproved={(agentName) => setApprovedBy(agentName)}
                />
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
