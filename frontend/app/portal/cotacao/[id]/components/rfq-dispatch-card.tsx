'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  dispatchPortalRfq,
  savePortalRfq,
  useQuotationAgents,
} from '@/hooks/use-portal-quotations';
import { useServerSync } from '@/hooks/use-server-sync';
import { toDatetimeLocal } from '@/utils/quotation-fields';
import type { ValidationBlock } from '@/types/quotation';

interface RfqDispatchCardProps {
  quotationId: string;
  /** Current quotation deadline; when absent the client is asked to set one. */
  desiredDeadline: string | null;
  /**
   * True when the quotation has no collection point yet and origin is required
   * for dispatch. Reveals the inline origin fields up-front so the client can
   * complete them without first hitting a validation error.
   */
  originMissing?: boolean;
  /** Called after a successful dispatch so the page can refresh. */
  onDispatched: () => void;
}

export function RfqDispatchCard({
  quotationId,
  desiredDeadline,
  originMissing = false,
  onDispatched,
}: RfqDispatchCardProps) {
  const { agents, rfqDispatched, selectedAgentIds, isLoading } =
    useQuotationAgents(quotationId);

  const [selected, setSelected] = useState<string[]>([]);
  const [particularities, setParticularities] = useState('');
  const [deadline, setDeadline] = useState('');
  const [origin, setOrigin] = useState('');
  const [agentDefinesOrigin, setAgentDefinesOrigin] = useState(false);
  const [showOriginFields, setShowOriginFields] = useState(false);
  const [hardBlocks, setHardBlocks] = useState<ValidationBlock[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Once a save reports a missing origin, latch the inline origin fields open so
  // the client can complete the collection point without a separate edit step.
  // Latched (never auto-hidden) so it doesn't flicker while re-submitting.
  const originResolved = agentDefinesOrigin || origin.trim().length > 0;

  // The origin block gets its own dedicated input once revealed, so drop it from
  // the generic "missing fields" list to avoid a redundant duplicate message.
  const visibleHardBlocks = showOriginFields
    ? hardBlocks.filter((b) => b.field !== 'origin')
    : hardBlocks;

  // Seed the selection from any previously-saved RFQ, but only once: this
  // SWR key can revalidate in the background (e.g. tab refocus) while the
  // client has already toggled checkboxes but not yet submitted, and
  // re-seeding on every revalidation would silently discard those clicks.
  useServerSync(!isLoading ? selectedAgentIds : null, setSelected);

  useEffect(() => {
    setDeadline(toDatetimeLocal(desiredDeadline));
  }, [desiredDeadline]);

  // Reveal the origin fields up-front when we already know origin is missing, so
  // the client never has to hit a validation error first. Latched (never
  // auto-hidden) to match the reactive reveal in handleDispatch.
  useEffect(() => {
    if (originMissing) setShowOriginFields(true);
  }, [originMissing]);

  const toggleAgent = (agentId: string) => {
    setSelected((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
  };

  const canSubmit = useMemo(
    () =>
      selected.length > 0 &&
      !submitting &&
      (!showOriginFields || originResolved),
    [selected, submitting, showOriginFields, originResolved],
  );

  const handleDispatch = async () => {
    setSubmitting(true);
    setHardBlocks([]);
    const saveResult = await savePortalRfq(quotationId, {
      agents_targeted: selected,
      particularities: particularities.trim() || null,
      desired_deadline: deadline ? new Date(deadline).toISOString() : undefined,
      // Only send origin fields once revealed, so we never blank an origin the
      // client already provided at creation on an unrelated quotation.
      ...(showOriginFields
        ? {
            agente_define_local_coleta: agentDefinesOrigin,
            origin: agentDefinesOrigin ? null : origin.trim(),
          }
        : {}),
    }, { silentValidation: true });
    if (!saveResult) {
      setSubmitting(false);
      return;
    }
    if (saveResult.hard_blocks.length > 0) {
      setHardBlocks(saveResult.hard_blocks);
      if (saveResult.hard_blocks.some((b) => b.field === 'origin')) {
        setShowOriginFields(true);
      }
      setSubmitting(false);
      return;
    }
    // dispatchPortalRfq revalidates the quotation and agents SWR keys on success,
    // so the card re-fetches rfq_dispatched=true and hides itself.
    const ok = await dispatchPortalRfq(quotationId);
    setSubmitting(false);
    if (ok) onDispatched();
  };

  // Hidden once the RFQ has already gone out or while the eligible list loads.
  if (isLoading || rfqDispatched) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Solicitar cotação aos agentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum agente pré-definido está disponível para esta cotação. Entre
            em contato com a equipe Freitas.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Escolha os agentes</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {agents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex items-center gap-2 rounded border p-2.5 text-sm cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selected.includes(agent.id)}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                    <span>{agent.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {!desiredDeadline ? (
              <div className="space-y-2">
                <Label htmlFor="rfq-deadline">Prazo desejado</Label>
                <input
                  id="rfq-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
            ) : null}

            {showOriginFields ? (
              <div className="space-y-2 rounded border border-amber-200 bg-amber-50/60 p-3">
                <Label htmlFor="rfq-origin">Local de coleta (origem)</Label>
                <input
                  id="rfq-origin"
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  disabled={agentDefinesOrigin}
                  placeholder="Ex.: Shanghai, China"
                  className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={agentDefinesOrigin}
                    onCheckedChange={(v) => setAgentDefinesOrigin(v === true)}
                  />
                  <span>Deixar que o agente defina o local de coleta</span>
                </label>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="rfq-particularities">
                Particularidades (opcional)
              </Label>
              <Textarea
                id="rfq-particularities"
                value={particularities}
                onChange={(e) => setParticularities(e.target.value)}
                placeholder="Informações adicionais para os agentes (ex.: exigências de embalagem, restrições de horário)."
                rows={3}
              />
            </div>

            {visibleHardBlocks.length > 0 ? (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">
                  Complete os campos obrigatórios antes de enviar:
                </p>
                <ul className="mt-1 list-disc pl-5 text-sm text-destructive">
                  {visibleHardBlocks.map((b) => (
                    <li key={b.field}>{b.reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button onClick={handleDispatch} disabled={!canSubmit}>
                <Send className="mr-2 h-4 w-4" />
                {submitting ? 'Enviando...' : 'Enviar solicitação'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
