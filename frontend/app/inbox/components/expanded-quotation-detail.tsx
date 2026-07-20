'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  ExternalLink,
  Mail,
  Paperclip,
  Play,
  Search,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge, Button, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ClientSelector } from '@/app/cotacao/nova-cotacao/components/client-selector';
import { DnaSummaryCard } from '@/app/cotacao/nova-cotacao/components/dna-summary-card';
import { updateQuotation } from '@/hooks/use-quotations';
import { COMPLETENESS_FIELD_LABELS, MODAL_LABELS } from '@/types/quotation';
import type { CompletenessField, Quotation } from '@/types/quotation';
import { formatBrNumber, formatLocalDatetime } from '@/utils/quotation-fields';
import type { QuotationClient } from '@/types/client';

// States where the analyst hasn't started working yet
const NOT_STARTED_STATES = new Set(['TRIAGEM_IA', 'AGUARDANDO_DADOS']);

function getMissingFields(quotation: Quotation): CompletenessField[] {
  const fields: CompletenessField[] = [
    'service_type',
    'modal',
    'origin',
    'incoterm',
    'product',
    'desired_deadline',
    'declared_value',
    'stackability',
  ];
  return fields.filter((f) => quotation[f] === null || quotation[f] === undefined);
}

interface FieldRowProps {
  label: string;
  value: string | number | boolean | null | undefined;
}

function FieldRow({ label, value }: FieldRowProps) {
  const display =
    value === null || value === undefined
      ? '--'
      : typeof value === 'boolean'
        ? value
          ? 'Sim'
          : 'Nao'
        : String(value);

  const isMissing = value === null || value === undefined;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm',
          isMissing && 'text-red-500 dark:text-red-400 italic',
        )}
      >
        {display}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client match panel — handles all DNA panel states
// ---------------------------------------------------------------------------

function ClientMatchPanel({
  quotation,
  onClientLinked,
}: {
  quotation: Quotation;
  onClientLinked?: () => void;
}) {
  const [showSelector, setShowSelector] = useState(false);
  const [linking, setLinking] = useState(false);

  const handleLinkClient = async (client: QuotationClient | null) => {
    if (!client) return;
    setLinking(true);
    const result = await updateQuotation(quotation.id, { client_id: client.id });
    setLinking(false);
    if (result) {
      setShowSelector(false);
      onClientLinked?.();
    }
  };

  // Client already matched — show DNA
  if (quotation.client) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">DNA do Cliente</h4>
        <DnaSummaryCard client={quotation.client} dna={quotation.client_dna} />
      </div>
    );
  }

  // Sender identified as a known freight agent contact (not an importer client)
  if (quotation.client_match_status === 'agent_matched') {
    const candidate = (quotation.client_match_candidates as Array<{
      freight_agent_id: string;
      contact_email: string;
      contact_name: string;
    }> | null)?.[0];
    return (
      <div className="space-y-3">
        <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <div className="w-full">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Agente de cargas identificado
              </p>
              {candidate ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-orange-700 dark:text-orange-400">
                    Contato: {candidate.contact_name}
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-400">
                    Email: {candidate.contact_email}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  Email do remetente: {quotation.sender_email || '--'}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Este pedido foi enviado por um agente cadastrado. Nao e necessario vincular um cliente importador.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found — show warning + manual selector
  if (quotation.client_match_status === 'not_found') {
    return (
      <div className="space-y-3">
        <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <div className="w-full">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Cliente nao encontrado
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                Email do remetente: {quotation.sender_email || '--'}
              </p>
              {!showSelector ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5"
                  onClick={() => setShowSelector(true)}
                >
                  <Search className="w-3.5 h-3.5" />
                  Vincular cliente existente
                </Button>
              ) : (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Buscar cliente cadastrado:
                  </p>
                  <ClientSelector
                    value={null}
                    onChange={handleLinkClient}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1.5 text-xs"
                    onClick={() => setShowSelector(false)}
                    disabled={linking}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multiple matches — show candidates + fallback selector
  if (quotation.client_match_status === 'multiple_found') {
    return (
      <div className="space-y-3">
        <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="w-full">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Multiplos clientes encontrados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Dominio do email: {quotation.sender_email?.split('@')[1] || '--'}
              </p>
              <div className="mt-2 space-y-1.5">
                {(quotation.client_match_candidates as Array<{ id: string; name: string; email: string }> | null)?.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={linking}
                    onClick={async () => {
                      setLinking(true);
                      const result = await updateQuotation(quotation.id, { client_id: candidate.id });
                      setLinking(false);
                      if (result) onClientLinked?.();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-md text-left text-sm border bg-background hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <div>
                      <span className="font-medium">{candidate.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{candidate.email}</span>
                    </div>
                    <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
              {!showSelector ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 gap-1.5 text-xs"
                  onClick={() => setShowSelector(true)}
                >
                  <Search className="w-3.5 h-3.5" />
                  Buscar outro cliente
                </Button>
              ) : (
                <div className="mt-2">
                  <ClientSelector
                    value={null}
                    onChange={handleLinkClient}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1.5 text-xs"
                    onClick={() => setShowSelector(false)}
                    disabled={linking}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No match status yet (manual creation or extraction pending)
  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-4 bg-muted/30">
        <p className="text-xs text-muted-foreground">
          Cliente nao identificado para esta cotacao.
        </p>
        {!showSelector ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5"
            onClick={() => setShowSelector(true)}
          >
            <Search className="w-3.5 h-3.5" />
            Vincular cliente
          </Button>
        ) : (
          <div className="mt-3">
            <ClientSelector
              value={null}
              onChange={handleLinkClient}
            />
            <Button
              size="sm"
              variant="ghost"
              className="mt-1.5 text-xs"
              onClick={() => setShowSelector(false)}
              disabled={linking}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ExpandedQuotationDetailProps {
  quotation: Quotation;
  onClientLinked?: () => void;
}

export function ExpandedQuotationDetail({
  quotation,
  onClientLinked,
}: ExpandedQuotationDetailProps) {
  const missingFields = getMissingFields(quotation);
  const completeness = quotation.completeness_score ?? 0;
  const attachmentCount = Object.keys(quotation.attachments_s3_keys || {}).length;

  const completenessColor =
    completeness >= 80
      ? '[&>div]:bg-green-500'
      : completeness >= 50
        ? '[&>div]:bg-yellow-500'
        : '[&>div]:bg-red-500';

  const completenessTextColor =
    completeness >= 80
      ? 'text-green-600 dark:text-green-400'
      : completeness >= 50
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="p-4 bg-muted/30 border-t">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Extracted fields */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Dados Extraidos</h4>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-bold tabular-nums', completenessTextColor)}>
                {completeness}%
              </span>
              <Progress value={completeness} className={cn('h-1.5 w-20', completenessColor)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <FieldRow
              label="Modal"
              value={quotation.modal ? MODAL_LABELS[quotation.modal] ?? quotation.modal : null}
            />
            <FieldRow label="Origem" value={quotation.origin} />
            <FieldRow label="Destino" value={quotation.porto_destino?.join(', ') || quotation.aeroporto_destino?.join(', ')} />
            <FieldRow label="Incoterm" value={quotation.incoterm} />
            <FieldRow label="Produto" value={quotation.product} />
            <FieldRow label="Prazo Desejado" value={formatLocalDatetime(quotation.desired_deadline)} />
            <FieldRow label="Valor Declarado" value={quotation.declared_value != null ? formatBrNumber(quotation.declared_value) : null} />
            <FieldRow label="Empilhavel" value={quotation.stackability} />
          </div>

          {missingFields.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs text-muted-foreground">Campos faltantes:</span>
              {missingFields.map((field) => (
                <span
                  key={field}
                  className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                >
                  {COMPLETENESS_FIELD_LABELS[field]}
                </span>
              ))}
            </div>
          )}

          {/* Attachments summary */}
          {attachmentCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Paperclip className="w-3.5 h-3.5" />
              <span>
                {attachmentCount} anexo{attachmentCount > 1 ? 's' : ''} processado{attachmentCount > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Link href={`/cotacao/${quotation.id}`}>
              <Button size="sm" variant="default" className="gap-1.5">
                {NOT_STARTED_STATES.has(quotation.state) ? (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Iniciar Cotação
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver Detalhes
                  </>
                )}
              </Button>
            </Link>
            <Button size="sm" variant="outline" className="gap-1.5" disabled>
              <Send className="w-3.5 h-3.5" />
              Solicitar Dados
            </Button>
            {quotation.original_email_s3_key && (
              <Button size="sm" variant="ghost" className="gap-1.5" disabled>
                <Mail className="w-3.5 h-3.5" />
                Ver Email Original
              </Button>
            )}
          </div>
        </div>

        {/* DNA panel + tags */}
        <div className="space-y-3">
          <ClientMatchPanel quotation={quotation} onClientLinked={onClientLinked} />

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {quotation.client?.is_vip && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">
                VIP
              </Badge>
            )}
            {(quotation.priority_score ?? 0) >= 80 && (
              <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400">
                URGENTE
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
