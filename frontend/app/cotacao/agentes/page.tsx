'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useFreightAgents } from '@/hooks/use-freight-agents';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { DataTable } from '@/components/data-table';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { ErrorComponent } from '@arboria-tech/arboria-ui';
import { Button } from '@/components/ui';
import { FreightAgent } from '@/types/freight-agent';
import { columns } from './components/columns';
import { AgentModal } from './components/agent-modal';

export default function AgentesPage() {
  const { agents, isLoading, isError } = useFreightAgents();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  const handleRowClick = (agent: FreightAgent) => {
    setSelectedAgentId(agent.id);
    setModalOpen(true);
  };

  const handleCreateClick = () => {
    setSelectedAgentId(null);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
        <PageTitle title="Agentes de Carga" />
        <Button className="whitespace-nowrap" onClick={handleCreateClick}>
          <Plus className="w-4 h-4 mr-2" />
          Cadastrar Agente
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={agents ?? []}
        enableFiltering
        enableColumnVisibility={false}
        onRowClick={handleRowClick}
      />

      <AgentModal
        agentId={selectedAgentId ?? undefined}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedAgentId(null);
        }}
      />
    </div>
  );
}
