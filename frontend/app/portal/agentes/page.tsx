'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Info, Plus, ShieldCheck, Users } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import { Button } from '@/components/ui';
import { Switch } from '@/components/ui/switch';
import { useMyAgents, useMyPreferences, setAgentActive } from '@/hooks/use-portal-agents';

import { PagePortalHeader, SectionHeading } from '../_shared/page-header';
import { ProvenanceBadge } from '../_shared/provenance-badge';
import { RequestAgentModal } from './components/request-agent-modal';

/**
 * Meus Agentes — quais dos agentes pré-aprovados pela Freitas entram nas
 * próximas cotações deste cliente.
 *
 * A REGRA QUE A TELA IMPLEMENTA: o cliente não cadastra agente, ele SELECIONA
 * entre os pré-aprovados. A lista vem do `default_agents` do DNA (curadoria da
 * Freitas) e o único poder do cliente sobre ela é o toggle. Agente novo passa
 * por avaliação — daí o CTA do rodapé ser um pedido, não um formulário de
 * cadastro (ver `request-agent-modal.tsx`).
 *
 * O TOGGLE NÃO É DECORATIVO: pausar remove o agente da lista de montagem da RFQ
 * (`app/agent_pause.py` no backend), que é o que faz "não participa das
 * próximas solicitações" ser verdade. Ele não mexe em RFQ já montada — "próximas"
 * está no texto e no filtro.
 *
 * PLANO: `plan_limit` e `plan_name` vêm sempre nulos, porque não existe modelo
 * de planos no schema. O indicador mostra o número REAL de ativos e marca só o
 * limite como "Pendente integração". Não substitua por uma constante ("10",
 * "Plano Free") — seria o único número inventado da tela.
 */
export default function PortalAgentesPage() {
  const { agents, activeCount, totalCount, planLimit, planName, isLoading, isError } =
    useMyAgents();
  const { preferences } = useMyPreferences();
  const [requestOpen, setRequestOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  const paused = preferences?.paused_agent_ids ?? [];

  const handleToggle = async (agentId: string, active: boolean) => {
    setSavingId(agentId);
    await setAgentActive(agentId, active, paused);
    setSavingId(null);
  };

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Meus Agentes"
        subtitle={
          totalCount === 0
            ? 'Nenhum agente disponível na sua conta.'
            : `${totalCount} ${
                totalCount === 1
                  ? 'agente disponível na sua conta'
                  : 'agentes disponíveis na sua conta'
              }.`
        }
      />

      {/* Indicador de uso do plano. O número de ativos é real; o limite, não —
          e por isso só ele leva o selo. */}
      <section className="portal-card space-y-3 p-6">
        <SectionHeading
          title="Uso da sua conta"
          icon={<Users className="h-5 w-5" />}
        />
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <p className="text-3xl font-semibold leading-none text-foreground">
            {activeCount}
          </p>
          <p className="portal-body text-portal-neutral">
            {activeCount === 1 ? 'agente ativo' : 'agentes ativos'} de{' '}
            {totalCount} disponíveis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-3">
          <span className="portal-small text-portal-neutral">
            Limite de agentes do seu plano
            {planName ? ` (${planName})` : ''}:
          </span>
          {planLimit != null ? (
            <span className="portal-body font-medium text-foreground">
              {planLimit}
            </span>
          ) : (
            <ProvenanceBadge provenance="pending" />
          )}
        </div>
        <p className="portal-small text-portal-neutral">
          Planos e limites por plano ainda não existem como cadastro — o número
          de agentes ativos acima é real, o limite aparece quando esse modelo
          entrar.
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Agentes disponíveis"
          hint="pré-aprovados pela Freitas"
        />
        <p className="inline-flex items-start gap-1.5 portal-small text-portal-neutral">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Pausar um agente o tira das suas próximas solicitações de cotação.
          Cotações já enviadas não mudam.
        </p>

        {agents.length === 0 ? (
          <EmptyState message="A Freitas ainda não habilitou agentes de frete para a sua conta. Fale com seu contato para liberar os primeiros." />
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="portal-card flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="portal-body font-medium text-foreground">
                      {agent.name}
                    </p>
                    {agent.certificacao_oea && (
                      <span className="portal-small inline-flex items-center gap-1 rounded border border-portal-success/25 bg-portal-success/10 px-1.5 py-0.5 font-medium text-portal-success">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        OEA
                      </span>
                    )}
                  </div>
                  <p className="portal-small text-portal-neutral">
                    {agent.active
                      ? 'Participa das suas próximas cotações'
                      : 'Pausado — fora das suas próximas cotações'}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <Link
                    href="/portal/inteligencia/agentes"
                    className="portal-small inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Ver performance
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <label className="flex cursor-pointer items-center gap-2 portal-small text-foreground">
                    <Switch
                      checked={agent.active}
                      disabled={savingId === agent.id}
                      onCheckedChange={(checked) => handleToggle(agent.id, checked)}
                      aria-label={`${agent.active ? 'Pausar' : 'Ativar'} ${agent.name}`}
                    />
                    {agent.active ? 'Ativo' : 'Pausado'}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA de rodapé: pedido para a fila da Freitas, não cadastro direto. */}
      <section className="portal-card-muted flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="space-y-1">
          <p className="portal-h3 text-foreground">
            Precisa de um agente que não está na lista?
          </p>
          <p className="portal-body max-w-2xl text-portal-neutral">
            Você pode sugerir um agente. Ele entra na fila de avaliação da
            Freitas (habilitação, seguro, histórico) e só aparece aqui depois de
            aprovado — o portal não cadastra agente direto.
          </p>
        </div>
        <Button onClick={() => setRequestOpen(true)}>
          <Plus className="mr-2 h-5 w-5" />
          Solicitar novo agente
        </Button>
      </section>

      <RequestAgentModal open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
}
