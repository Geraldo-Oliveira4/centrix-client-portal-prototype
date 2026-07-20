'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useFreightAgents } from '@/hooks/use-freight-agents';
import { ScoreBadge } from '@/app/cotacao/agentes/components/score-badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';
import type { ClientDna } from '@/types/client';
import type { FreightAgent } from '@/types/freight-agent';

type ModalPrefix = 'AEREO' | 'MARITIMO_FCL' | 'MARITIMO_LCL';

interface AgentSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  clientDna?: ClientDna | null;
  quotationModal?: string | null;
  tipoEmbarque?: string | null;
}

function agentHasValidOea(agent: { certificacao_oea: boolean | null; data_validade_oea: string | null }): boolean {
  if (!agent.certificacao_oea) return false;
  if (!agent.data_validade_oea) return true;
  return new Date(agent.data_validade_oea) >= new Date(new Date().toDateString());
}

function inferModalPrefix(
  quotationModal: string | null | undefined,
  tipoEmbarque: string | null | undefined,
): ModalPrefix | null {
  if (!quotationModal) return null;
  if (quotationModal === 'AEREO') return 'AEREO';
  if (quotationModal === 'MARITIMO' && tipoEmbarque === 'FCL') return 'MARITIMO_FCL';
  if (quotationModal === 'MARITIMO' && tipoEmbarque === 'LCL') return 'MARITIMO_LCL';
  return null;
}

const MODAL_REGION_LABELS: Record<string, string> = {
  AEREO_ASIA: 'Aéreo — Ásia',
  AEREO_EUROPA: 'Aéreo — Europa',
  AEREO_AMERICAS: 'Aéreo — Américas',
  MARITIMO_FCL_ASIA: 'Marítimo FCL — Ásia',
  MARITIMO_FCL_EUROPA: 'Marítimo FCL — Europa',
  MARITIMO_FCL_AMERICAS: 'Marítimo FCL — Américas',
  MARITIMO_LCL_ASIA: 'Marítimo LCL — Ásia',
  MARITIMO_LCL_EUROPA: 'Marítimo LCL — Europa',
  MARITIMO_LCL_AMERICAS: 'Marítimo LCL — Américas',
};

export function AgentSelector({
  value,
  onChange,
  disabled = false,
  clientDna,
  quotationModal,
  tipoEmbarque,
}: AgentSelectorProps) {
  const { agents, isLoading } = useFreightAgents();

  const oeaRequired = clientDna?.exige_oea === true;

  const inferredModalRegionPrefix = useMemo(() => {
    return inferModalPrefix(quotationModal, tipoEmbarque);
  }, [quotationModal, tipoEmbarque]);

  const { recommendedAgents, otherAgents } = useMemo(() => {
    if (!agents) return { recommendedAgents: [], otherAgents: [] };
    if (!inferredModalRegionPrefix) return { recommendedAgents: [], otherAgents: agents };

    const recommended: FreightAgent[] = [];
    const others: FreightAgent[] = [];

    for (const agent of agents) {
      const hasMatch = agent.modal_regions?.some((mr) => mr.startsWith(inferredModalRegionPrefix));
      if (hasMatch) {
        recommended.push(agent);
      } else {
        others.push(agent);
      }
    }

    return { recommendedAgents: recommended, otherAgents: others };
  }, [agents, inferredModalRegionPrefix]);

  const toggle = (agentId: string, blocked: boolean) => {
    if (disabled || blocked) return;
    if (value.includes(agentId)) {
      onChange(value.filter((id) => id !== agentId));
    } else {
      onChange([...value, agentId]);
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-3">
        Carregando agentes de carga...
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-3">
        Nenhum agente de carga cadastrado.
      </div>
    );
  }

  const blockedCount = oeaRequired ? agents.filter((a) => !agentHasValidOea(a)).length : 0;
  const hasRecommendations = recommendedAgents.length > 0;

  const renderAgentButton = (agent: FreightAgent) => {
    const selected = value.includes(agent.id);
    const blocked = oeaRequired && !agentHasValidOea(agent);
    const isRecommended = inferredModalRegionPrefix
      ? agent.modal_regions?.some((mr) => mr.startsWith(inferredModalRegionPrefix)) ?? false
      : false;

    const button = (
      <button
        key={agent.id}
        type="button"
        disabled={disabled || blocked}
        onClick={() => toggle(agent.id, blocked)}
        className={cn(
          'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors text-left w-full',
          selected && !blocked
            ? 'border-primary bg-primary/5 text-foreground'
            : 'border-border bg-background text-foreground hover:bg-muted/50',
          isRecommended && !selected && 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/20',
          (disabled || blocked) && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
              selected && !blocked
                ? 'border-primary bg-primary'
                : 'border-border bg-background',
            )}
          >
            {selected && !blocked && (
              <svg
                className="w-2.5 h-2.5 text-primary-foreground"
                fill="none"
                viewBox="0 0 12 12"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <polyline points="1.5 6 4.5 9 10.5 3" />
              </svg>
            )}
          </div>
          <span className="font-medium truncate">{agent.name}</span>
          {isRecommended && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 border-blue-300 text-blue-700 dark:text-blue-400">
              Recomendado
            </Badge>
          )}
          {agent.email && (
            <span className="text-xs text-muted-foreground truncate hidden sm:block">
              {agent.email}
            </span>
          )}
        </div>
        <ScoreBadge score={agent.reliability_score} />
      </button>
    );

    if (blocked) {
      return (
        <Tooltip key={agent.id}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="top">
            <p>Agente bloqueado: sem certificacao OEA valida.</p>
            <p className="text-xs text-muted-foreground">Este cliente exige OEA Seguranca.</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1.5">
        {oeaRequired && blockedCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold">{blockedCount} agente{blockedCount > 1 ? 's' : ''} bloqueado{blockedCount > 1 ? 's' : ''}:</span>
            <span>cliente exige certificacao OEA valida.</span>
          </div>
        )}
        {inferredModalRegionPrefix && (
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
            <span className="font-semibold">Modal detectado:</span>
            <span>{inferredModalRegionPrefix === 'AEREO' ? 'Aéreo' : inferredModalRegionPrefix === 'MARITIMO_FCL' ? 'Marítimo FCL' : 'Marítimo LCL'}</span>
          </div>
        )}
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
          {hasRecommendations && (
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Agentes na regiao ({recommendedAgents.length})
              </div>
              {recommendedAgents.map(renderAgentButton)}
            </div>
          )}
          {hasRecommendations && otherAgents.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="outros-agentes" className="border-0">
                <AccordionTrigger className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 py-2 hover:no-underline hover:text-foreground">
                  Agentes fora da rota ({otherAgents.length})
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <div className="flex flex-col gap-1.5">
                    {otherAgents.map(renderAgentButton)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {!hasRecommendations && otherAgents.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {otherAgents.map(renderAgentButton)}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
