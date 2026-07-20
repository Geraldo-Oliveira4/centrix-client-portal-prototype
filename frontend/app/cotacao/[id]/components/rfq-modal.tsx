'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Info, Plus, Send, Users } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { addRFQAgents, createRFQ, dispatchRFQ, reopenRfqAgent, useRFQ } from '@/hooks/use-rfq';
import { useFreightAgents } from '@/hooks/use-freight-agents';
import { useServerSync } from '@/hooks/use-server-sync';
import { AgentSelector } from './agent-selector';
import { AuditDivergenceBanner } from './audit-divergence-banner';
import { RFQDispatchPreview } from './rfq-dispatch-preview';
import { isDispatchBlocked, resolveLabel } from '../lib/rfq-validation';
import type { AuditDivergencia, Quotation } from '@/types/quotation';
import type { ClientDna } from '@/types/client';
import type { ValidationBlock } from '@/types/quotation';

interface RFQModalProps {
  quotation: Quotation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  agents_targeted: string[];
  imo_class: string;
}

function buildInitialForm(quotation: Quotation): FormState {
  const dna = quotation.client_dna as ClientDna | undefined | null;

  const defaultAgentIds = dna?.default_agents
    ? Object.keys(dna.default_agents)
    : [];

  return {
    agents_targeted: defaultAgentIds,
    imo_class: quotation.imo_class ?? '',
  };
}

export function RFQModal({ quotation, open, onOpenChange }: RFQModalProps) {
  const { rfq, agentTokens, hardBlocks, softWarnings, isLoading, mutate } = useRFQ(
    open ? quotation.id : null,
  );
  const { agents: allAgents } = useFreightAgents();

  const [form, setForm] = useState<FormState>(() => buildInitialForm(quotation));
  const [validationBlocks, setValidationBlocks] = useState<ValidationBlock[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationBlock[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isAddingAgents, setIsAddingAgents] = useState(false);
  const [reopeningAgentId, setReopeningAgentId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showDispatchPreview, setShowDispatchPreview] = useState(false);
  const [auditDivergencias, setAuditDivergencias] = useState<AuditDivergencia[]>([]);

  const isDangerousCargo = quotation.carga_perigosa === 'IMO';
  const clientDna = quotation.client_dna as ClientDna | undefined | null;

  const isRFQCreated = !!rfq;
  const isRFQDispatched = rfq?.dispatched_at != null;

  const existingAgentIds = useMemo(() => {
    return new Set(rfq?.agents_targeted ?? []);
  }, [rfq?.agents_targeted]);

  const newAgentIds = useMemo(() => {
    return form.agents_targeted.filter((id) => !existingAgentIds.has(id));
  }, [form.agents_targeted, existingAgentIds]);

  const hasNewAgentsToAdd = newAgentIds.length > 0;

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      setValidationBlocks([]);
      setValidationWarnings([]);
      setForm(buildInitialForm(quotation));
      setShowDispatchPreview(false);
      setAuditDivergencias([]);
    }
  }, [open, quotation]);

  useEffect(() => {
    if (!submitted) {
      setValidationBlocks(hardBlocks);
      setValidationWarnings(softWarnings);
    }
  }, [hardBlocks, softWarnings, submitted]);

  // Seeds `form` from the loaded rfq/quotation exactly once per modal-open
  // session. Without this, calling mutate() from handleAddAgents/handleDispatch
  // would re-fire this sync and stomp any field (e.g. imo_class) the analyst
  // edited locally after the RFQ was first loaded.
  useServerSync(
    rfq,
    (r) => setForm({ agents_targeted: r.agents_targeted ?? [], imo_class: quotation.imo_class ?? '' }),
    { skip: submitted, resetKey: open },
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const payload = {
      agents_targeted: form.agents_targeted,
      imo_class: form.imo_class || undefined,
    };
    const result = await createRFQ(quotation.id, payload);
    setIsSubmitting(false);
    if (result) {
      setValidationBlocks(result.hard_blocks);
      setValidationWarnings(result.soft_warnings);
      setSubmitted(true);
      mutate();
    }
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    setAuditDivergencias([]);
    const result = await dispatchRFQ(quotation.id);
    setIsDispatching(false);
    if (result.success) {
      setShowDispatchPreview(false);
      onOpenChange(false);
    } else if (result.auditDivergencias?.length) {
      setAuditDivergencias(result.auditDivergencias);
    }
  };

  const handleReopen = async (agentId: string) => {
    setReopeningAgentId(agentId);
    const ok = await reopenRfqAgent(quotation.id, agentId);
    setReopeningAgentId(null);
    if (ok) {
      mutate();
    }
  };

  const handleAddAgents = async () => {
    if (newAgentIds.length === 0) return;
    setIsAddingAgents(true);
    const result = await addRFQAgents(quotation.id, newAgentIds);
    setIsAddingAgents(false);
    if (result) {
      mutate();
    }
  };

  const blocked = isDispatchBlocked(validationBlocks);
  const hasValidation = validationBlocks.length > 0 || validationWarnings.length > 0;

  const isPreCreateMode = !isRFQCreated;
  const isPreDispatchMode = isRFQCreated && !isRFQDispatched;
  const isPostDispatchMode = isRFQDispatched;

  const savedAgentIds = rfq?.agents_targeted ?? [];
  const agentsChangedFromSaved =
    isPreDispatchMode &&
    (form.agents_targeted.length !== savedAgentIds.length ||
      form.agents_targeted.some((id) => !savedAgentIds.includes(id)));

  const targetedAgents = useMemo(() => {
    if (!allAgents || !rfq) return [];
    const ids = new Set(rfq.agents_targeted ?? []);
    return allAgents.filter((a) => ids.has(a.id));
  }, [allAgents, rfq]);

  const getTitle = () => {
    if (showDispatchPreview) return `Confirmar Envio — ${quotation.reference ?? quotation.id}`;
    if (isPostDispatchMode) return `RFQ Enviada — ${quotation.reference ?? quotation.id}`;
    if (isPreDispatchMode) return `RFQ — ${quotation.reference ?? quotation.id}`;
    return 'Iniciar Cotacao';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : showDispatchPreview && rfq ? (
          <div className="flex flex-col gap-4">
            {auditDivergencias.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  Revise o conteúdo abaixo antes de confirmar. Este é o resumo que será enviado aos agentes selecionados.
                </p>
              </div>
            )}

            {auditDivergencias.length > 0 && (
              <AuditDivergenceBanner divergencias={auditDivergencias} />
            )}

            <RFQDispatchPreview quotation={quotation} rfq={rfq} agents={targetedAgents} />

            <div className="flex items-center justify-between pt-1 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDispatchPreview(false);
                  setAuditDivergencias([]);
                }}
                disabled={isDispatching}
                className="flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button
                disabled={
                  isDispatching ||
                  auditDivergencias.some((d) => d.tipo_validacao === 'strict')
                }
                className="flex items-center gap-1.5"
                onClick={handleDispatch}
              >
                <Send className="w-4 h-4" />
                {isDispatching ? 'Enviando...' : 'Confirmar e Enviar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <InfoField label="Origem" value={quotation.origin} />
              <InfoField label="Destino" value={quotation.porto_destino?.join(', ') || quotation.aeroporto_destino?.join(', ')} />
              <InfoField label="Incoterm" value={quotation.incoterm} />
              <InfoField label="Modal" value={quotation.modal} />
              <InfoField label="Produto" value={quotation.product} />
            </div>

            <div className="flex flex-col gap-5">
              {isPostDispatchMode && (
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-3">
                  <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                    <Users className="w-4 h-4" />
                    <span className="font-medium">
                      {existingAgentIds.size} agente(s) ja receberam esta cotacao
                    </span>
                  </div>
                  {allAgents && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Array.from(existingAgentIds).map((agentId) => {
                        const agent = allAgents.find((a) => a.id === agentId);
                        if (!agent) return null;
                        const tokenRecord = agentTokens.find((t) => t.agent_id === agentId);
                        const isDeclined = !!tokenRecord?.declined_at;
                        const isReopening = reopeningAgentId === agentId;
                        return (
                          <span
                            key={agentId}
                            title={isDeclined && tokenRecord?.decline_reason ? `Motivo: ${tokenRecord.decline_reason}` : undefined}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
                              isDeclined
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
                            )}
                          >
                            {agent.name}
                            {isDeclined && (
                              <>
                                <span className="font-medium">· Declinado</span>
                                <button
                                  type="button"
                                  onClick={() => handleReopen(agentId)}
                                  disabled={isReopening}
                                  title='Limpa o declínio deste agente. Depois clique em "Re-disparar" para reenviar o link.'
                                  className="ml-1 font-semibold text-red-700 dark:text-red-300 underline decoration-dotted underline-offset-2 hover:text-red-900 dark:hover:text-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isReopening ? 'Reabrindo…' : 'Reabrir'}
                                </button>
                              </>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">
                  {isPostDispatchMode ? 'Adicionar Novos Agentes' : 'Agentes de Carga *'}
                </Label>
                <AgentSelector
                  value={form.agents_targeted}
                  onChange={(ids) => setForm((prev) => ({ ...prev, agents_targeted: ids }))}
                  disabled={false}
                  clientDna={clientDna}
                  quotationModal={quotation.modal}
                  tipoEmbarque={quotation.tipo_embarque}
                />
                {agentsChangedFromSaved && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Selecao alterada. Salve a RFQ para confirmar antes de disparar.
                  </p>
                )}
                {isPostDispatchMode && hasNewAgentsToAdd && (
                  <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded px-2 py-1">
                    {newAgentIds.length} novo(s) agente(s) selecionado(s). Clique em{' '}
                    <strong>Adicionar e Enviar Link</strong> para enviar o link da cotacao a eles.
                  </p>
                )}
                {form.agents_targeted.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selecione ao menos um agente de carga.
                  </p>
                )}
              </div>

              {isDangerousCargo && (
                <div className="flex flex-col gap-2">
                  <Label
                    className="text-sm font-medium text-red-700 dark:text-red-400"
                    htmlFor="imo_class"
                  >
                    Classe IMO *
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (carga perigosa)
                    </span>
                  </Label>
                  <Input
                    id="imo_class"
                    placeholder="Ex: IMO class 3 — liquidos inflamaveis"
                    value={form.imo_class}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, imo_class: e.target.value }))
                    }
                    disabled={isRFQCreated}
                    className="border-red-300 focus-visible:ring-red-400"
                  />
                </div>
              )}
            </div>

            {hasValidation && (
              <div className="flex flex-col gap-2 rounded-lg border overflow-hidden">
                {validationBlocks.length > 0 && (
                  <div className="flex flex-col gap-1 p-3 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Bloqueios Criticos ({validationBlocks.length})
                    </div>
                    {validationBlocks.map((block) => (
                      <div key={block.field} className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-red-800 dark:text-red-300">
                          {resolveLabel(block)}
                        </span>
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {block.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {validationWarnings.length > 0 && (
                  <div className="flex flex-col gap-1 p-3 bg-amber-50 dark:bg-amber-950/20">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
                      <Info className="w-3.5 h-3.5" />
                      Avisos ({validationWarnings.length})
                    </div>
                    {validationWarnings.map((block) => (
                      <div key={block.field} className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                          {resolveLabel(block)}
                        </span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {block.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {submitted && !blocked && isPreDispatchMode && (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Todos os campos obrigatorios preenchidos. Pronto para disparar.
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || isDispatching || isAddingAgents}
              >
                {isRFQCreated ? 'Fechar' : 'Cancelar'}
              </Button>

              <div className="flex items-center gap-2">
                {(isPreCreateMode || agentsChangedFromSaved) && (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || blocked || form.agents_targeted.length === 0}
                    variant="outline"
                  >
                    {isSubmitting ? 'Salvando...' : 'Salvar RFQ'}
                  </Button>
                )}

                {isPreDispatchMode && (
                  <Button
                    disabled={blocked || form.agents_targeted.length === 0}
                    className="flex items-center gap-1.5"
                    onClick={() => setShowDispatchPreview(true)}
                  >
                    <Send className="w-4 h-4" />
                    Disparar para Agentes
                  </Button>
                )}

                {isPostDispatchMode && (
                  <>
                    <Button
                      disabled={!hasNewAgentsToAdd || isAddingAgents}
                      className="flex items-center gap-1.5"
                      onClick={handleAddAgents}
                    >
                      <Plus className="w-4 h-4" />
                      {isAddingAgents ? 'Adicionando...' : 'Adicionar e Enviar Link'}
                    </Button>
                    <Button
                      disabled={isDispatching || hasNewAgentsToAdd}
                      variant="outline"
                      className="flex items-center gap-1.5"
                      onClick={handleDispatch}
                      title={hasNewAgentsToAdd ? 'Adicione os novos agentes primeiro antes de re-disparar' : undefined}
                    >
                      <Send className="w-4 h-4" />
                      {isDispatching ? 'Enviando...' : 'Re-disparar'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </span>
      <span className="text-sm font-medium">
        {value ?? <span className="text-muted-foreground font-normal">—</span>}
      </span>
    </div>
  );
}
