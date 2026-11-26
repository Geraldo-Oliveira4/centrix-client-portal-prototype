'use client';

// Mapa comparativo VERTICAL do detalhe da cotação: uma coluna por proposta,
// atributos em linhas alinhadas — o mesmo desenho da aba "Mapa" de
// `/portal/cotacoes/comparativo` (`map-tab.tsx`), aqui ligado às propostas
// reais e à escolha da página.
//
// A RECOMENDAÇÃO MORA NA COLUNA RECOMENDADA (pedido do Orsi para a
// demonstração): selo "Recomendada pela IA" + frase de fato + "Entender a
// recomendação" recolhido. O bloco separado "Recomendação Centrix" saiu da
// página para ela não aparecer duas vezes. Score numérico continua fora.
//
// Este componente SÓ DESENHA. Ordem, selos e frase vêm de
// `lib/comparison-map-model.ts` (puro, testado); a escolha é o `select(p)` da
// página, e a barra inferior segue sendo a única porta para o ApproveDialog.
//
// Dois desenhos do mesmo dado, trocados por CSS em 680px: <table> no desktop
// (até 4 colunas sem rolagem; a partir daí rola o contêiner, nunca a página) e
// cartões empilhados no celular, na mesma ordem das colunas.

import type { CSSProperties, ReactNode } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Sparkles,
  Timer,
} from 'lucide-react';

import { formatBRL, formatCurrency, formatDate } from '@/lib/portal-formatters';
import type { PortalProposal } from '@/types/portal';

import { ReviewedByFreitasBadge } from '../../../_shared/demo/quotation-v2-labels';
import s from '../../../cotacoes/previa/quotation-preview.module.css';
import { AgentHistoryInline } from '../../components/agent-history-drawer';
import { agentHistoryLine } from '../../lib/agent-history-line';
import {
  SHOW_ILLUSTRATIVE_MARKS,
  type ComparisonMap,
  type MapColumn,
} from '../../lib/comparison-map-model';
import { RecommendationPanel } from './recommendation-panel';

type Column = MapColumn<PortalProposal>;

interface ProposalsVerticalMapProps {
  quotationId: string;
  /** As propostas visíveis, como a página as tem (alimenta o RecommendationPanel). */
  proposals: PortalProposal[];
  map: ComparisonMap<PortalProposal>;
  /** O cliente pode escolher agora. Fora disso o mapa é só leitura. */
  deciding: boolean;
  /** A proposta escolhida na página (ou a vencedora, depois da decisão). */
  selectedId: string | null;
  onSelect: (proposal: PortalProposal) => void;
  onOpenHistory: (proposalId: string) => void;
  expandedId: string | null;
  onToggleDetails: (proposalId: string) => void;
  renderDetails: (proposal: PortalProposal) => ReactNode;
  /** Cotação V2 liberada: toda proposta visível passou pela revisão de saída. */
  reviewed: boolean;
  marketReference: number | null;
  /** `data_limite_necessidade` já formatada (dd/mm/aaaa), quando existe. */
  needBy: string | null;
}

interface Row {
  key: string;
  label: string;
  note?: string;
  render: (column: Column) => ReactNode;
}

const agentName = (p: PortalProposal) => p.agent?.name || 'Agente não informado';

function Seal({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className={s.mapSeal}>
      {icon}
      {children}
    </span>
  );
}

export function ProposalsVerticalMap({
  quotationId,
  proposals,
  map,
  deciding,
  selectedId,
  onSelect,
  onOpenHistory,
  expandedId,
  onToggleDetails,
  renderDetails,
  reviewed,
  marketReference,
  needBy,
}: ProposalsVerticalMapProps) {
  const { columns } = map;

  const rows: Row[] = [
    {
      key: 'preco',
      label: 'Preço all-in (R$)',
      render: ({ proposal: p, cheapest }) => {
        const difference =
          marketReference && p.total_brl > 0
            ? Math.round((1 - p.total_brl / marketReference) * 100)
            : null;
        return (
          <>
            <strong className={s.mapPrice}>{formatBRL(p.total_brl)}</strong>
            {cheapest && (
              <Seal icon={<CircleDollarSign size={12} aria-hidden />}>
                Menor custo
              </Seal>
            )}
            {difference !== null && (
              <small>
                {difference === 0
                  ? 'Próximo da referência de mercado'
                  : `${Math.abs(difference)}% ${difference > 0 ? 'abaixo' : 'acima'} do mercado`}
              </small>
            )}
          </>
        );
      },
    },
    {
      key: 'frete',
      label: 'Frete',
      note: 'Internacional',
      render: ({ proposal: p }) => formatCurrency(p.freight_value),
    },
    {
      key: 'transito',
      label: 'Transit time',
      render: ({ proposal: p, fastest }) => (
        <>
          <strong>
            {p.transit_time == null ? 'Não informado' : `${p.transit_time} dias`}
          </strong>
          {fastest && (
            <Seal icon={<Timer size={12} aria-hidden />}>Menor prazo</Seal>
          )}
        </>
      ),
    },
    {
      key: 'chegada',
      label: 'Chegada prevista',
      // Fato com ícone + texto, nunca só cor. Sem necessidade informada
      // (`onTime === null`) não há marca.
      render: ({ arrival, onTime }) => (
        <>
          {arrival ? formatDate(arrival) : 'A confirmar'}
          {onTime === true && (
            <span className={s.mapFact}>
              <CheckCircle2 size={12} aria-hidden /> Chega a tempo
            </span>
          )}
          {onTime === false && (
            <span className={s.mapFact + ' ' + s.mapFactLate}>
              <Clock3 size={12} aria-hidden /> Chega após a sua necessidade
            </span>
          )}
        </>
      ),
    },
    {
      key: 'free-time',
      label: 'Free time',
      render: ({ freeTime }) =>
        freeTime ? (
          <>
            {freeTime.days} dias
            {SHOW_ILLUSTRATIVE_MARKS && freeTime.illustrative && (
              <span className={s.mapIllustrative}>ilustrativo</span>
            )}
          </>
        ) : (
          'A confirmar'
        ),
    },
    {
      key: 'validade',
      label: 'Validade da proposta',
      render: ({ proposal: p, issue }) => (
        <>
          {formatDate(p.validity)}
          {issue && <small className={s.warningText}>{issue}</small>}
        </>
      ),
    },
    {
      key: 'armador',
      label: 'Armador',
      render: ({ proposal: p }) => p.carrier || 'Não informado',
    },
    {
      key: 'agente',
      label: 'Agente',
      render: ({ proposal: p, history }) => {
        const line = agentHistoryLine(history);
        return (
          <>
            {agentName(p)}
            <div className={s.mapHistory}>
              <AgentHistoryInline
                text={line.text}
                muted={line.kind !== 'normal'}
                agentName={p.agent?.name || 'agente'}
                onOpen={() => onOpenHistory(p.id)}
              />
            </div>
          </>
        );
      },
    },
  ];

  const identity = ({ proposal: p, recommended }: Column) => (
    <>
      {recommended && (
        <span className={s.mapRecSeal}>
          <Sparkles size={13} aria-hidden /> Recomendada pela IA
        </span>
      )}
      <span className={s.mapAgent}>{agentName(p)}</span>
      {p.is_winner && (
        <span className={s.recommendedTag}>
          <Check size={11} aria-hidden /> Escolhida
        </span>
      )}
      {/* RQ-17: toda proposta que chegou ao cliente passou pela revisão de
          saída. Desfecho, não sugestão — daí o verde e não o azul. */}
      {reviewed && <ReviewedByFreitasBadge className="mt-1" />}
      {recommended && map.reason && (
        <p className={s.mapReason}>{map.reason}</p>
      )}
      {recommended && deciding && (
        <details className={s.mapWhy}>
          <summary>
            Entender a recomendação <ChevronDown size={13} aria-hidden />
          </summary>
          <RecommendationPanel quotationId={quotationId} proposals={proposals} />
          <p>A indicação não confirma atendimento à sua data necessária.</p>
        </details>
      )}
    </>
  );

  const actions = ({ proposal: p, issue }: Column) => {
    const selected = selectedId === p.id;
    const open = expandedId === p.id;
    return (
      <>
        {deciding && (
          <button
            type="button"
            className={s.secondary + ' ' + s.mapChoose}
            aria-pressed={selected}
            aria-label={
              (selected ? 'Proposta escolhida: ' : 'Escolher esta proposta: ') +
              agentName(p)
            }
            disabled={!!issue}
            onClick={() => onSelect(p)}
          >
            {selected ? (
              <>
                <Check size={15} aria-hidden /> Proposta escolhida
              </>
            ) : (
              'Escolher esta proposta'
            )}
          </button>
        )}
        {deciding && issue && (
          <small className={s.mapIssue}>{issue}: não pode ser escolhida.</small>
        )}
        <button
          type="button"
          className={s.mapDetailsToggle}
          aria-label={`Ver detalhes de ${agentName(p)}`}
          aria-expanded={open}
          onClick={() => onToggleDetails(p.id)}
        >
          Ver detalhes{' '}
          <ChevronDown
            size={13}
            aria-hidden
            className={open ? s.mapChevronOpen : undefined}
          />
        </button>
      </>
    );
  };

  const columnClass = (c: Column) =>
    [
      c.recommended ? s.mapRec : '',
      selectedId === c.proposal.id ? s.mapSelected : '',
      c.issue ? s.mapDisabled : '',
    ]
      .filter(Boolean)
      .join(' ');

  const expanded = columns.find((c) => c.proposal.id === expandedId) ?? null;

  return (
    <>
      {deciding && !map.recommendedId && (
        <p className={s.mapHint}>
          Ainda não há indicação válida para esta cotação. Compare prazo,
          validade e condições das propostas.
        </p>
      )}

      {needBy && (
        <p className={s.mapNeed}>
          Sua necessidade de chegada: <strong>{needBy}</strong>
        </p>
      )}

      <div
        className={s.mapScroll}
        style={{ '--map-cols': columns.length } as CSSProperties}
      >
        <table className={s.mapTable}>
          <caption className={s.srOnly}>
            Mapa comparativo das {columns.length} propostas, uma por coluna
            {map.recommendedId ? ', com a recomendada primeiro' : ''}.
          </caption>
          <colgroup>
            <col className={s.mapLabelCol} />
            {columns.map((c) => (
              <col key={c.proposal.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={s.mapRowLabel}>
                Proposta
              </th>
              {columns.map((c) => (
                <th
                  key={c.proposal.id}
                  scope="col"
                  className={s.mapHead + ' ' + columnClass(c)}
                >
                  {identity(c)}
                </th>
              ))}
            </tr>
            <tr>
              <td className={s.mapRowLabel}>
                <span className={s.srOnly}>Ações</span>
              </td>
              {columns.map((c) => (
                <td
                  key={c.proposal.id}
                  className={s.mapActions + ' ' + columnClass(c)}
                >
                  {actions(c)}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className={s.mapRowLabel}>
                  {row.label}
                  {row.note && <small>{row.note}</small>}
                </th>
                {columns.map((c) => (
                  <td key={c.proposal.id} className={columnClass(c)}>
                    {row.render(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {expanded && (
        <div className={s.mapDetailsDesktop}>
          <p className={s.mapDetailsTitle}>
            Detalhes de {agentName(expanded.proposal)}
          </p>
          {renderDetails(expanded.proposal)}
        </div>
      )}

      <ul className={s.mapCards} aria-label="Propostas para comparar">
        {columns.map((c) => (
          <li key={c.proposal.id} className={s.mapCard + ' ' + columnClass(c)}>
            <div className={s.mapHead}>{identity(c)}</div>
            <div className={s.mapActions}>{actions(c)}</div>
            <dl className={s.mapFacts}>
              {rows.map((row) => (
                <div key={row.key}>
                  <dt>
                    {row.label}
                    {row.note && <small>{row.note}</small>}
                  </dt>
                  <dd>{row.render(c)}</dd>
                </div>
              ))}
            </dl>
            {expandedId === c.proposal.id && renderDetails(c.proposal)}
          </li>
        ))}
      </ul>
    </>
  );
}
