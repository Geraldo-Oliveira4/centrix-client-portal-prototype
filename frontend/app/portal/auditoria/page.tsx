'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, PackageCheck, Wrench } from 'lucide-react';

import { Button } from '@/components/ui';

import { PagePortalHeader, SectionHeading } from '../_shared/page-header';
import { ProvenanceBadge } from '../_shared/provenance-badge';
import { ConciliationList } from './components/conciliation-list';
import { ConciliationTable } from './components/conciliation-table';
import { DisputeDraftModal } from './components/dispute-draft-modal';
import { DivergenceCausesBlock } from './components/divergence-causes-block';
import {
  CONCILIATION_EXAMPLES,
  type ConciliationExample,
  type EvaluatedLine,
} from './lib/conciliation';

/**
 * Auditoria — planejado (cotação) × realizado (NF final), em três camadas:
 *
 *   1. Conciliação determinística — a tabela por embarque.
 *   2. Árvore de decisão — if/else sobre o limite de divergência, marca a linha
 *      com "Sugerimos contestar". Não é IA.
 *   3. Rascunho de contestação — texto montado por template determinístico.
 *
 * A tela inteira é CONCEITUAL, e por dois motivos de schema, não de escopo:
 *
 *   - o gatilho é a chegada do embarque, e `EmbarqueState` termina em
 *     `embarcado` (partida). Não existe estado de chegada confirmada, nem data
 *     de chegada preenchida (`Processo.datas` fica NULL), então NENHUM embarque
 *     real é elegível hoje — a lista de elegíveis é honestamente vazia;
 *   - o lado "realizado" viria da NF final, e não existe model de nota fiscal
 *     ou fatura no repositório.
 *
 * Por isso os embarques mostrados são exemplos declaradamente fictícios
 * (prefixo EXEMPLO-), e não um embarque real do cliente com números fabricados
 * pendurados nele. Se o módulo de Tracking passar a marcar a chegada e a NF
 * final entrar no schema, o que muda aqui é a FONTE das linhas — a conciliação,
 * a árvore de decisão e o template de contestação continuam válidos.
 *
 * A conferência cotado × valor de fechamento que morava nesta rota NÃO é
 * auditoria: é conferência da própria cotação, e vive em Minhas Cotações >
 * Histórico. Não traga aquele painel de volta para cá.
 *
 * A Camada 1 é resumo -> detalhe (mesmo padrão de Meus Embarques > Lista): a
 * lista compacta responde "algum embarque divergiu?" e o "Ver detalhe" abre a
 * tabela item a item de UM embarque. As cinco tabelas já ficaram abertas ao
 * mesmo tempo; não volte àquilo — a leitura de desfecho sumia atrás de ~20
 * linhas de item.
 */
export default function AuditoriaPage() {
  const [selected, setSelected] = useState<{
    example: ConciliationExample;
    line: EvaluatedLine;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Drill-in da Camada 1: lista compacta -> detalhe de um embarque. Guarda a
  // referência, não o objeto, para o estado não segurar uma cópia velha do
  // exemplo se `CONCILIATION_EXAMPLES` mudar.
  const [openReference, setOpenReference] = useState<string | null>(null);

  const openExample =
    CONCILIATION_EXAMPLES.find((e) => e.reference === openReference) ?? null;

  const openDispute = (example: ConciliationExample) => (line: EvaluatedLine) => {
    setSelected({ example, line });
    setModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Auditoria"
        subtitle="Confere o que foi contratado na cotação contra o que foi cobrado no fechamento do embarque."
        action={<ProvenanceBadge provenance="preview" />}
      />

      {/* Banner de topo: a tela inteira é conceitual, não só um número. */}
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="portal-body text-foreground">
          <span className="font-medium">Conceitual</span> — aguarda conclusão do
          módulo de Tracking. Exemplo abaixo com dado ilustrativo.
        </p>
      </div>

      {/* Gatilho: o estado que dispara a auditoria ainda não existe no
          acompanhamento de embarque, então nenhum embarque real entra na lista.
          Badge `pending`, não `preview`: não é número inventado, é fonte que
          ainda vai existir. */}
      <section className="portal-card space-y-4 p-6">
        <SectionHeading
          title="Quando a auditoria dispara"
          icon={<PackageCheck className="h-5 w-5" />}
          action={<ProvenanceBadge provenance="pending" />}
        />
        <p className="portal-body max-w-3xl text-portal-neutral">
          A conferência só faz sentido depois que o embarque chega e a
          documentação final é emitida — é aí que existe um realizado para
          comparar com o planejado. O acompanhamento de embarque ainda não marca
          a chegada confirmada, então nenhum embarque seu entra nesta lista por
          enquanto.
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-dashed pt-4">
          <p className="text-3xl font-semibold leading-none text-portal-neutral">0</p>
          <p className="portal-body text-portal-neutral">
            embarques elegíveis hoje
          </p>
          <p className="portal-small text-portal-neutral">
            passam a aparecer aqui automaticamente quando a chegada for
            confirmada
          </p>
        </div>
      </section>

      {/* Leitura agregada da Camada 1, antes do embarque a embarque: a lista diz
          QUAIS embarques divergiram, este bloco diz O QUE costuma divergir. */}
      <DivergenceCausesBlock examples={CONCILIATION_EXAMPLES} />

      {/* Camada 1 + Camada 2 */}
      <section className="space-y-4">
        <SectionHeading
          title="Conciliação por embarque"
          hint="planejado × realizado"
          action={<ProvenanceBadge provenance="preview" />}
        />
        <p className="portal-small max-w-3xl text-portal-neutral">
          Os embarques abaixo são exemplos fictícios, criados só para mostrar a
          leitura item a item. Nenhum número aqui vem de um embarque seu. Eles
          cobrem os quatro desfechos possíveis: fechamento limpo, diferença que
          cabe no limite, divergência para baixo (diverge, mas não há o que
          contestar) e divergência para cima (aí sim sugerimos contestar).
        </p>

        {openExample ? (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 -ml-2"
              onClick={() => setOpenReference(null)}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para a lista
            </Button>
            <ConciliationTable
              example={openExample}
              onDispute={openDispute(openExample)}
            />
          </div>
        ) : (
          <ConciliationList
            examples={CONCILIATION_EXAMPLES}
            onOpen={(example) => setOpenReference(example.reference)}
          />
        )}
      </section>

      <section className="portal-card space-y-3 p-6">
        <p className="portal-h3 text-foreground">
          Procurando a conferência das cotações fechadas?
        </p>
        <p className="portal-body max-w-3xl text-portal-neutral">
          O comparativo entre o valor cotado e o valor de fechamento é uma
          conferência da própria cotação, não auditoria de fatura. Ele fica no
          histórico, dentro de cada cotação fechada.
        </p>
        <div>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/portal/cotacoes?tab=historico">
              Ir para Minhas Cotações · Histórico
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <DisputeDraftModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        example={selected?.example ?? null}
        line={selected?.line ?? null}
      />
    </div>
  );
}
