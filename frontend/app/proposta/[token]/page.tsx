'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { StatusMessage } from '@/components/status-message';
import { RFQDetailsCard } from './components/rfq-details-card';
import { ProposalForm } from './components/proposal-form';
import type { ExistingPortalProposal, ProposalFormQuotation } from '@/types/quotation';

const API_URL = process.env.NEXT_PUBLIC_API ?? '';

interface FormData {
  quotation: ProposalFormQuotation;
  rfq: {
    include_insurance: boolean;
    destination_yard: string | null;
  };
  agent: {
    id: string;
    name: string;
  };
  already_submitted: boolean;
  already_declined: boolean;
  decline_reason: string | null;
  existing_proposals: ExistingPortalProposal[];
}

type PageState = 'loading' | 'ready' | 'declined' | 'expired' | 'invalid' | 'error';

export default function PropostaPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [formData, setFormData] = useState<FormData | null>(null);

  const fetchForm = useCallback(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }
    setPageState('loading');
    axios
      .get<FormData>(`${API_URL}/public/rfq/form`, { params: { token } })
      .then((res) => {
        setFormData(res.data);
        setPageState(res.data.already_declined ? 'declined' : 'ready');
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 404) setPageState('invalid');
        else if (status === 410) setPageState('expired');
        else setPageState('error');
      });
  }, [token]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  const handleSubmitted = useCallback(() => {
    fetchForm();
  }, [fetchForm]);

  const handleDeclined = useCallback((reason: string | null) => {
    setFormData((prev) => prev ? { ...prev, already_declined: true, decline_reason: reason } : prev);
    setPageState('declined');
  }, []);

  const defaultDestination =
    formData?.quotation.porto_destino?.join(', ') ||
    formData?.quotation.aeroporto_destino?.join(', ') ||
    null;

  const isFCL = formData?.quotation.tipo_embarque === 'FCL';
  const totalContainers = formData?.quotation.equipments.reduce((sum, e) => sum + e.quantity, 0) ?? 0;
  const requestedContainerTypes = Array.from(
    new Set((formData?.quotation.equipments ?? []).map((e) => e.tipo_container).filter((t): t is string => !!t)),
  );

  const hasExisting = (formData?.existing_proposals?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 flex items-center gap-3">
        <Image
          src="/circlecentrix.png"
          alt="Centrix"
          width={28}
          height={28}
          className="w-7 h-7"
        />
        <span className="font-semibold text-sm">Centrix — Portal do Agente</span>
      </div>

      <div className="px-4 sm:px-6 py-6">
        {pageState === 'loading' && (
          <div className="flex justify-center items-center py-24 text-muted-foreground text-sm">
            Carregando...
          </div>
        )}

        {pageState === 'invalid' && (
          <StatusMessage
            title="Link inválido"
            description="Este link de proposta não existe ou foi removido. Verifique o e-mail recebido e tente novamente."
            onRetry={fetchForm}
          />
        )}

        {pageState === 'declined' && (
          <DeclinedMessage reason={formData?.decline_reason ?? null} />
        )}

        {pageState === 'expired' && (
          <StatusMessage
            title="Cotação encerrada"
            description="Esta cotação foi encerrada e não está mais aceitando propostas. Se você acredita que isso é um erro (por exemplo, se você abriu esta página há algum tempo), tente novamente."
            onRetry={fetchForm}
          />
        )}

        {pageState === 'error' && (
          <StatusMessage
            title="Erro ao carregar"
            description="Não foi possível carregar os dados da cotação. Tente novamente em alguns instantes."
            onRetry={fetchForm}
          />
        )}

        {pageState === 'ready' && formData && (
          <div className="flex flex-col gap-4">
            {hasExisting ? (
              <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Você já possui {formData.existing_proposals.length === 1 ? 'uma proposta enviada' : `${formData.existing_proposals.length} propostas enviadas`} para esta cotação.
                  Os formulários abaixo estão pré-preenchidos com os dados enviados — edite e envie para criar uma nova versão,
                  ou adicione uma nova oferta independente.
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Olá, <span className="font-medium text-foreground">{formData.agent.name}</span>.
                Preencha sua proposta para a cotação abaixo.
              </p>
            )}

            <RFQDetailsCard data={formData} />

            <ProposalForm
              token={token}
              apiUrl={API_URL}
              onSubmitted={handleSubmitted}
              onDeclined={handleDeclined}
              defaultOrigin={formData.quotation.origin}
              defaultDestination={defaultDestination}
              existingProposals={formData.existing_proposals ?? []}
              isFCL={isFCL}
              totalContainers={totalContainers}
              requestedContainerTypes={requestedContainerTypes}
              insuranceRequired={formData.rfq.include_insurance}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DeclinedMessage({ reason }: { reason: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="text-lg font-semibold">Cotação declinada</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Você informou que não consegue atender esta cotação.
      </p>
      {reason && (
        <p className="text-sm text-muted-foreground max-w-sm">
          Motivo: <span className="text-foreground">{reason}</span>
        </p>
      )}
    </div>
  );
}
