'use client';

import { ArrowDown, ArrowUp, Minus, Wrench } from 'lucide-react';
import { LoaderComponent, ErrorComponent, EmptyState } from '@arboria-tech/arboria-ui';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useMyQuotations } from '@/hooks/use-portal-quotations';

import { PagePortalHeader } from '../../_shared/page-header';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import {
  buildAgentRanking,
  type ReliabilityLabel,
  type RelativeTone,
  type AgentRow,
} from '../lib/agent-helpers';

/**
 * Dashboard 2 — Agentes. RANKING ILUSTRATIVO, painel inteiro atrás do selo
 * "Pré-visualização".
 *
 * Chamava-se "Fornecedores" e foi renomeado (05/08/2026, revisão do Victor
 * Orsi): numa importação, "fornecedor" é o exportador — quem fabrica e embarca
 * a carga. Usar a mesma palavra para o agente de frete embaralha dois papéis que
 * o cliente enxerga separados no portal (Meus Exportadores × Meus Agentes). Não
 * reintroduza "fornecedor" para se referir a agente de frete.
 *
 * NOTA DE METODOLOGIA (não apagar): a versão real deste painel continua
 * bloqueada por uma correção no score de agentes — ele precisa sair de um
 * contador cumulativo para uma taxa de erro em janela móvel. Enquanto isso não
 * acontece, este painel NÃO exibe o score: a leitura de confiabilidade é um
 * rótulo qualitativo ilustrativo (Alta/Média/Baixa), e as colunas de preço e
 * prazo são relativas à média do próprio cliente, não a um benchmark de
 * mercado (não existe base de preços neste protótipo).
 *
 * Este repo já teve um caso de score numérico de IA/agente exposto
 * indevidamente ao cliente (quotation-card, recommendation-view,
 * reliability-block — corrigido no commit 20fb493). NÃO reintroduza aquele
 * padrão aqui: nenhum número de 0-100, nenhuma "confiabilidade %". Quando a
 * metodologia for corrigida, o que muda é a FONTE da coluna Confiabilidade e o
 * selo do painel — o resto da tabela já é dado real.
 */

const TONE_STYLE: Record<
  RelativeTone,
  { label: (kind: 'price' | 'transit') => string; className: string; icon: typeof Minus }
> = {
  below: {
    label: (kind) => (kind === 'price' ? 'Abaixo da média' : 'Mais rápido'),
    className: 'text-portal-success',
    icon: ArrowDown,
  },
  average: {
    label: () => 'Na média',
    className: 'text-portal-neutral',
    icon: Minus,
  },
  above: {
    label: (kind) => (kind === 'price' ? 'Acima da média' : 'Mais lento'),
    className: 'text-portal-warning',
    icon: ArrowUp,
  },
};

const RELIABILITY_STYLE: Record<ReliabilityLabel, string> = {
  Alta: 'border-portal-success/25 bg-portal-success/10 text-portal-success',
  Média: 'border-portal-warning/30 bg-portal-warning/10 text-portal-warning',
  Baixa: 'border-portal-neutral/30 bg-muted text-portal-neutral',
};

function RelativeCell({
  tone,
  kind,
}: {
  tone: RelativeTone;
  kind: 'price' | 'transit';
}) {
  const style = TONE_STYLE[tone];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        'portal-body inline-flex items-center gap-1.5 font-medium',
        style.className,
      )}
    >
      <Icon className="h-4 w-4" />
      {style.label(kind)}
    </span>
  );
}

function AgentTable({ rows }: { rows: AgentRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="portal-small font-medium text-portal-neutral">
              Agente
            </TableHead>
            <TableHead className="portal-small font-medium text-portal-neutral">
              Rotas atendidas
            </TableHead>
            <TableHead className="portal-small font-medium text-portal-neutral">
              Preço médio
            </TableHead>
            <TableHead className="portal-small font-medium text-portal-neutral">
              Prazo médio
            </TableHead>
            <TableHead className="portal-small font-medium text-portal-neutral">
              Confiabilidade
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} className="hover:bg-transparent">
              <TableCell className="align-top">
                <p className="portal-body font-medium text-foreground">{row.name}</p>
                <p className="portal-small text-portal-neutral">
                  {row.quotations}{' '}
                  {row.quotations === 1 ? 'cotação' : 'cotações'} com a melhor
                  proposta
                </p>
              </TableCell>
              <TableCell className="align-top">
                <p className="portal-body text-foreground">
                  {row.routes.length}{' '}
                  {row.routes.length === 1 ? 'rota' : 'rotas'}
                </p>
                <p className="portal-small text-portal-neutral">
                  {row.routes.join(' · ')}
                </p>
              </TableCell>
              <TableCell className="align-top">
                <RelativeCell tone={row.price} kind="price" />
              </TableCell>
              <TableCell className="align-top">
                <RelativeCell tone={row.transit} kind="transit" />
              </TableCell>
              <TableCell className="align-top">
                <span
                  className={cn(
                    'portal-small inline-flex items-center rounded border px-2 py-0.5 font-medium',
                    RELIABILITY_STYLE[row.reliability],
                  )}
                >
                  {row.reliability}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AgentesPage() {
  const { data, isLoading, isError } = useMyQuotations();

  if (isLoading) return <LoaderComponent />;
  if (isError || !data) return <ErrorComponent />;

  const rows = buildAgentRanking(data);

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Agentes"
        subtitle="Desempenho dos seus agentes de frete."
        action={<ProvenanceBadge provenance="preview" />}
      />

      {/* Banner de topo: o painel inteiro é ilustrativo, não só a última coluna. */}
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="portal-body text-foreground">
          <span className="font-medium">Ranking ilustrativo</span> — a
          metodologia definitiva do score de agentes está em correção (o cálculo
          precisa passar de contador cumulativo para taxa de erro em janela
          móvel). Até lá, use este painel como leitura de tendência, não como
          avaliação validada do agente.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="portal-h2 text-foreground">Agentes nas suas cotações</p>
            <p className="portal-small max-w-3xl text-portal-neutral">
              Ordenado por volume. Preço e prazo são comparados à média das suas
              próprias cotações — não a um benchmark de mercado.
            </p>
          </div>
          <ProvenanceBadge provenance="preview" />
        </div>

        {rows.length === 0 ? (
          <EmptyState message="Nenhum agente com proposta nas suas cotações ainda." />
        ) : (
          <AgentTable rows={rows} />
        )}

        <div className="space-y-1 border-t border-dashed pt-4">
          <p className="portal-small text-portal-neutral">
            <span className="font-medium text-foreground">Dado real:</span> nome
            do agente, número de cotações em que ele trouxe a melhor proposta e
            as rotas correspondentes.
          </p>
          <p className="portal-small text-portal-neutral">
            <span className="font-medium text-foreground">Ilustrativo:</span> a
            coluna Confiabilidade — rótulo qualitativo enquanto a metodologia do
            score de agentes está em correção. Preço e prazo são relativos a uma
            amostra pequena, então leia como tendência.
          </p>
        </div>
      </section>
    </div>
  );
}
