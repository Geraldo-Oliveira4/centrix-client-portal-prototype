import type { ReactNode } from 'react';
import { Check, Clock3 } from 'lucide-react';
import s from '../../cotacoes/previa/quotation-preview.module.css';

export function PreparationSteps({ waiting }: { waiting: boolean }) {
  return (
    <ol className={s.preparationSteps} aria-label="Etapas da cotação">
      {['Preparar solicitação', 'Receber propostas', 'Comparar e escolher'].map(
        (label, index) => (
          <li
            key={label}
            aria-current={index === (waiting ? 1 : 0) ? 'step' : undefined}
          >
            <span>
              {waiting && index === 0 ? <Check size={13} /> : index + 1}
            </span>
            {label}
          </li>
        ),
      )}
    </ol>
  );
}

export function RequestSummary({
  rows,
  children,
}: {
  rows: { label: string; value?: string | null }[];
  children?: ReactNode;
}) {
  return (
    <section className={s.panel}>
      <div className={s.sectionHeading}>
        <div>
          <h2>Dados da solicitação</h2>
          <p>O que já está preenchido e o que falta informar.</p>
        </div>
      </div>
      <dl className={s.requestSummary}>
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={!value ? s.muted : undefined}>
              {value || 'Não informado'}
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}

export type ResponseRow = { id: string; name: string; received: boolean };

export function ResponseOffers({
  waiting,
  count,
  children,
}: {
  waiting: boolean;
  count: number;
  children: ReactNode;
}) {
  if (!waiting) return <>{children}</>;
  return (
    <details className={s.support}>
      <summary>
        Consultar {count}{' '}
        {count === 1 ? 'proposta recebida' : 'propostas recebidas'}
      </summary>
      {children}
    </details>
  );
}

export function WaitingResponses({
  rows,
  count,
  deadline,
  sentAt,
  unavailable,
  loading,
  onRefresh,
  onView,
  onInvite,
  onCompare,
  comparisonAvailable = false,
}: {
  rows: ResponseRow[];
  count: number;
  deadline?: string | null;
  sentAt?: string | null;
  unavailable?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
  onView?: (id: string) => void;
  onInvite?: () => void;
  onCompare?: () => void;
  comparisonAvailable?: boolean;
}) {
  return (
    <section className={s.panel}>
      <div className={s.sectionHeading}>
        <div>
          <h2>
            {count
              ? 'As propostas estão chegando'
              : 'Aguardando propostas dos agentes'}
          </h2>
          <p>
            {count
              ? comparisonAvailable
                ? 'Consulte cada proposta assim que chegar. Você pode avançar com as disponíveis ou aguardar mais respostas.'
                : 'Você já pode consultar as respostas recebidas. A comparação ainda não está liberada.'
              : 'Acompanhe as respostas nesta cotação.'}
          </p>
        </div>
        {onRefresh && (
          <button className={s.textButton} onClick={onRefresh}>
            Atualizar
          </button>
        )}
      </div>
      <div className={s.responseSummary}>
        <div>
          <small>Propostas recebidas</small>
          <strong>
            {count}
            {comparisonAvailable && rows.length
              ? ' de ' + rows.length + ' agentes'
              : ''}
          </strong>
        </div>
        <div>
          <small>Prazo solicitado para resposta</small>
          <strong>{deadline || 'Não informado'}</strong>
        </div>
        <div>
          <small>Próximo passo</small>
          <strong>Comparar e escolher</strong>
        </div>
      </div>
      {sentAt && (
        <p className={s.dispatchNote}>Solicitação enviada em {sentAt}.</p>
      )}
      <div className={s.agentTable}>
        <table>
          <thead>
            <tr>
              <th>Agente de cargas</th>
              <th>Situação da resposta</th>
              {onView && (
                <th>
                  <span className={s.srOnly}>Consultar proposta</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>
                  <span className={s.responseState}>
                    {row.received ? <Check size={14} /> : <Clock3 size={14} />}
                    {row.received ? 'Proposta recebida' : 'Aguardando resposta'}
                  </span>
                </td>
                {onView && (
                  <td>
                    {row.received && (
                      <button
                        className={s.textButton}
                        onClick={() => onView(row.id)}
                      >
                        Ver proposta
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(loading || unavailable || !rows.length) && (
        <p className={s.dispatchNote} role="status">
          {loading
            ? 'Consultando os agentes…'
            : unavailable
              ? 'Não foi possível consultar a lista de agentes convidados.'
              : 'A lista de agentes convidados não está disponível nesta cotação.'}
        </p>
      )}
      <div className={s.waitFooter}>
        <p>
          {comparisonAvailable
            ? 'Você não precisa esperar todos responderem. Confira validade, prazo e condições antes de escolher.'
            : 'Receber uma proposta não confirma a contratação. A escolha acontece na próxima etapa.'}
        </p>
        <div className="flex flex-wrap gap-4">
          {onInvite && (
            <button className={s.textButton} onClick={onInvite}>
              Convidar mais agentes
            </button>
          )}
          {onCompare && count > 0 && (
            <button className={s.secondary} onClick={onCompare}>
              {count === 1
                ? 'Revisar proposta disponível'
                : 'Comparar disponíveis'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
