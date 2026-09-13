'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Bookmark, Search } from 'lucide-react';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import { DraftRequestForm } from '../previa/draft-request-form';
import { availableAgents, type Quote } from '../previa/model';
import {
  habitFromRequest,
  history,
  initialHabits,
  routes,
  startRequest,
  type Habit,
} from './model';
import s from './habitual.module.css';

const KEY = 'centrix-habituais-preview-v1';
const entries = [
  ['nova', 'Nova cotação'],
  ['historico', 'Histórico'],
  ['fornecedor', 'Fornecedor'],
  ['rota', 'Rota preferida'],
];
type Modal = 'habit' | 'review' | 'repeat' | 'leave' | null;

export default function HabitualPreview({
  initialEntry,
}: {
  initialEntry: string;
}) {
  const [entry, setEntry] = useState(
    entries.some(([id]) => id === initialEntry) ? initialEntry : 'nova',
  );
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [savedDraft, setSavedDraft] = useState<Quote | null>(null);
  const [q, setQ] = useState<Quote | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [supplier, setSupplier] = useState('Hanwha Industrial');
  const [routeId, setRouteId] = useState('busan-santos');
  const [source, setSource] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [repeat, setRepeat] = useState<(typeof history)[number] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (!Array.isArray(value.habits)) throw new Error();
        setHabits(value.habits);
        setSavedDraft(value.draft || null);
      }
    } catch {
      setStorageError(
        'Não foi possível recuperar os dados salvos neste navegador. Os exemplos estão disponíveis.',
      );
    }
    setLoaded(true);
  }, []);

  const persist = (nextHabits: Habit[], draft: Quote | null) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ habits: nextHabits, draft }));
      setStorageError('');
      return true;
    } catch {
      setStorageError(
        'Não foi possível salvar neste navegador. Seus dados continuam nesta tela; tente novamente.',
      );
      return false;
    }
  };
  const begin = (item: Habit | null, route?: string) => {
    setQ(startRequest(item, route));
    setSource(
      item
        ? item.name
        : route
          ? routes.find((r) => r.id === route)?.label || ''
          : '',
    );
    setFormKey((k) => k + 1);
    setNotice('');
    setError('');
    setModal(null);
    setSent(false);
    setAgents([]);
    setConfirmed(false);
  };
  const saveDraft = (patch: Partial<Quote>) => {
    const next = { ...q!, ...patch };
    setQ(next);
    if (persist(habits, next)) {
      setSavedDraft(next);
      setNotice('Rascunho salvo neste navegador. Você pode continuar depois.');
    }
  };
  const saveHabit = () => {
    try {
      const next = habitFromRequest(q!, name, crypto.randomUUID());
      if (
        habits.some(
          (h) =>
            h.name.toLowerCase() === next.name.toLowerCase() &&
            h.supplier === next.supplier,
        )
      ) {
        setError(
          'Já existe uma solicitação habitual com esse nome para o fornecedor. Escolha outro nome.',
        );
        return;
      }
      const list = [...habits, next];
      if (!persist(list, savedDraft)) return;
      setHabits(list);
      setModal(null);
      setNotice(
        'Solicitação habitual salva. Ela não gera cotação nem envia convites.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };
  const review = (patch: Partial<Quote>) => {
    const next = { ...q!, ...patch };
    setQ(next);
    setError('');
    if (
      !next.supplier.trim() ||
      !next.product.trim() ||
      !(Number(next.weight) > 0) ||
      !(Number(next.volume) > 0) ||
      !next.needDate ||
      !next.manualDraft?.values.desired_deadline
    ) {
      setNotice(
        'Antes de revisar, informe fornecedor, mercadoria, peso/volume nos equipamentos ou volumes, chegada necessária e prazo de resposta.',
      );
      return;
    }
    if (next.needDate < next.readyDate) {
      setNotice(
        'A chegada necessária deve ser posterior ou igual à prontidão da carga.',
      );
      return;
    }
    setConfirmed(false);
    setModal('review');
    setNotice('');
  };
  const finish = () => {
    if (!agents.length || !confirmed) {
      setError('Selecione os agentes e confirme a revisão dos dados.');
      return;
    }
    if (!persist(habits, null)) return;
    setSavedDraft(null);
    setModal(null);
    setSent(true);
  };
  const route = routes.find((r) => r.id === routeId)!;
  const filtered = habits.filter(
    (h) =>
      (entry !== 'fornecedor' || h.supplier === supplier) &&
      (entry !== 'rota' || h.routeId === routeId) &&
      [
        h.name,
        h.supplier,
        h.draft.values.product,
        routes.find((r) => r.id === h.routeId)?.label,
      ]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')),
  );
  const suppliers = Array.from(new Set(habits.map((h) => h.supplier)));

  if (!loaded) return <p role="status">Carregando solicitações habituais...</p>;

  return (
    <div className={s.page}>
      <div className={s.preview}>
        <span>
          Prévia · dados ilustrativos · ações salvas somente neste navegador
        </span>
        <label>
          Entrada para testar{' '}
          <select
            aria-label="Entrada para testar"
            value={entry}
            disabled={!!q}
            onChange={(e) => {
              setEntry(e.target.value);
              setQuery('');
              setNotice('');
            }}
          >
            {entries.map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Link href="/portal/cotacoes/previa?variacoes=1">
          Detalhes e variações
        </Link>
      </div>
      {storageError && (
        <p role="alert" className={s.error}>
          {storageError}
        </p>
      )}
      {notice && (
        <p role="status" className={s.notice}>
          {notice}
        </p>
      )}

      {q ? (
        sent ? (
          <section className={s.result}>
            <h1>Solicitação preparada</h1>
            <p>
              {q.supplier} · {q.product}
            </p>
            <p>
              O próximo passo seria receber as propostas de {agents.join(', ')}.
            </p>
            <p className={s.muted}>
              Simulação concluída. Nenhuma solicitação ou mensagem foi enviada
              ao backend ou aos agentes.
            </p>
            <Button
              onClick={() => {
                setQ(null);
                setSent(false);
                setEntry('nova');
              }}
            >
              Voltar às solicitações
            </Button>
          </section>
        ) : (
          <>
            <button className={s.back} onClick={() => setModal('leave')}>
              <ArrowLeft size={15} /> Voltar às solicitações
            </button>
            <header>
              <h1>Nova cotação</h1>
              <p>
                {source
                  ? 'Dados reaproveitados de ' +
                    source +
                    '. Revise para esta nova remessa.'
                  : 'Prepare os dados da sua carga.'}
              </p>
            </header>
            <div className={s.context}>
              <Bookmark size={17} />
              <div>
                <strong>Confirme o que muda nesta remessa</strong>
                <p>
                  PO, prontidão, chegada necessária, quantidade, peso/volume e
                  prazo de resposta. Informe os equipamentos ou volumes atuais.
                </p>
                <span>
                  Preços, propostas, documentos e decisões anteriores permanecem
                  no histórico.
                </span>
              </div>
            </div>
            <DraftRequestForm
              key={formKey}
              quotation={q}
              onSave={saveDraft}
              onReview={review}
              onSaveTemplate={(patch) => {
                setQ({ ...q, ...patch });
                setName(patch.product || q.product);
                setError('');
                setModal('habit');
              }}
            />
          </>
        )
      ) : (
        <>
          <header className={s.heading}>
            <div>
              <h1>
                {entry === 'historico'
                  ? 'Histórico de cotações'
                  : entry === 'fornecedor'
                    ? supplier
                    : entry === 'rota'
                      ? route.label
                      : 'Nova cotação'}
              </h1>
              <p>
                {entry === 'historico'
                  ? 'Reaproveite uma solicitação para uma nova remessa.'
                  : entry === 'fornecedor'
                    ? 'Solicitações habituais deste fornecedor.'
                    : entry === 'rota'
                      ? 'Rota preferida · Marítimo · solicitações por fornecedor e carga.'
                      : 'Comece com os dados que você já usa ou preencha uma nova solicitação.'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                begin(null, entry === 'rota' ? routeId : undefined)
              }
            >
              {entry === 'rota' ? 'Cotar nesta rota' : 'Começar em branco'}
            </Button>
          </header>

          {entry === 'nova' && savedDraft && (
            <div className={s.resume}>
              <div>
                <strong>Continuar rascunho</strong>
                <p>
                  {savedDraft.supplier || 'Fornecedor a informar'} ·{' '}
                  {savedDraft.product || 'Mercadoria a informar'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setQ(savedDraft);
                  setSource('Rascunho salvo');
                  setFormKey((k) => k + 1);
                  setNotice('');
                }}
              >
                Continuar
              </Button>
            </div>
          )}
          {entry === 'historico' ? (
            <div className={s.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Fornecedor / carga</th>
                    <th>Referência</th>
                    <th>Rota</th>
                    <th>Situação</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.supplier}</strong>
                        <small>{item.draft.values.product}</small>
                      </td>
                      <td>
                        {item.reference}
                        <small>
                          {item.po} · {item.date}
                        </small>
                      </td>
                      <td>
                        {routes.find((r) => r.id === item.routeId)?.label}
                      </td>
                      <td>{item.status}</td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setRepeat(item);
                            setModal('repeat');
                          }}
                        >
                          Cotar novamente <ArrowRight size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section>
              <div className={s.sectionTitle}>
                <h2>
                  {entry === 'nova'
                    ? 'Usar uma solicitação habitual'
                    : 'Solicitações habituais'}
                </h2>
                <span>{filtered.length} disponíveis</span>
              </div>
              <div className={s.filters}>
                <label className={s.search}>
                  <Search size={16} />
                  <Input
                    aria-label="Buscar solicitação habitual"
                    placeholder="Buscar fornecedor, carga ou rota"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {entry === 'fornecedor' && (
                  <label>
                    Fornecedor{' '}
                    <select
                      aria-label="Fornecedor"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                    >
                      {suppliers.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                )}
                {entry === 'rota' && (
                  <label>
                    Rota{' '}
                    <select
                      aria-label="Rota preferida"
                      value={routeId}
                      onChange={(e) => setRouteId(e.target.value)}
                    >
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className={s.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Fornecedor / solicitação</th>
                      <th>Carga</th>
                      <th>Rota e condições</th>
                      <th>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.supplier}</strong>
                          <small>{item.name}</small>
                        </td>
                        <td>{item.draft.values.product || 'A informar'}</td>
                        <td>
                          {routes.find((r) => r.id === item.routeId)?.label}
                          <small>
                            {item.draft.values.tipo_embarque} ·{' '}
                            {item.draft.values.incoterm}
                          </small>
                        </td>
                        <td>
                          <Button variant="ghost" onClick={() => begin(item)}>
                            Usar solicitação <ArrowRight size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <div className={s.empty}>
                  <p>Nenhuma solicitação habitual encontrada.</p>
                  <Button variant="ghost" onClick={() => setQuery('')}>
                    Limpar busca
                  </Button>
                </div>
              )}
              <p className={s.muted}>
                Modelos não são pedidos em andamento. Uma nova solicitação
                começa quando você escolhe usar um deles.
              </p>
              {entry === 'nova' && (
                <button
                  className={s.back}
                  onClick={() => {
                    setEntry('historico');
                    setQuery('');
                  }}
                >
                  Ou buscar no histórico de cotações <ArrowRight size={14} />
                </button>
              )}
            </section>
          )}
        </>
      )}

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setModal(null);
            setError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {modal === 'habit'
                ? 'Salvar como solicitação habitual'
                : modal === 'review'
                  ? 'Revisar solicitação'
                  : modal === 'repeat'
                    ? 'Cotar novamente'
                    : 'Voltar às solicitações?'}
            </DialogTitle>
            <DialogDescription>
              {modal === 'habit'
                ? 'Salve os dados habituais para a próxima remessa. Datas, PO, dimensões, valores e documentos não fazem parte do modelo.'
                : modal === 'review'
                  ? 'Confira os dados desta remessa e escolha quem deve receber a solicitação.'
                  : modal === 'repeat'
                    ? 'Uma nova remessa reaproveita os dados. Para acompanhar a mesma carga, consulte a cotação existente.'
                    : 'As alterações desde o último salvamento não serão mantidas. Você pode voltar ao formulário e salvar o rascunho.'}
            </DialogDescription>
          </DialogHeader>
          {modal === 'habit' && (
            <label className={s.field}>
              Nome da solicitação
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Motores · Busan–Santos"
              />
            </label>
          )}
          {modal === 'review' && q && (
            <>
              <dl className={s.summary}>
                <div>
                  <dt>Fornecedor / carga</dt>
                  <dd>
                    {q.supplier} · {q.product}
                  </dd>
                </div>
                <div>
                  <dt>Rota</dt>
                  <dd>
                    {q.origin} → {q.destination}
                  </dd>
                </div>
                <div>
                  <dt>Prontidão / chegada necessária</dt>
                  <dd>
                    {q.readyDate} / {q.needDate}
                  </dd>
                </div>
                <div>
                  <dt>Peso / volume</dt>
                  <dd>
                    {q.weight} kg · {q.volume} m³
                  </dd>
                </div>
                <div>
                  <dt>Referência do cliente</dt>
                  <dd>{q.po || 'Não informada'}</dd>
                </div>
              </dl>
              <fieldset className={s.agents}>
                <legend>Enviar para</legend>
                {availableAgents.slice(0, 3).map((agent) => (
                  <label key={agent}>
                    <input
                      type="checkbox"
                      checked={agents.includes(agent)}
                      onChange={(e) =>
                        setAgents(
                          e.target.checked
                            ? [...agents, agent]
                            : agents.filter((a) => a !== agent),
                        )
                      }
                    />
                    {agent}
                  </label>
                ))}
              </fieldset>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Conferi os dados e os destinatários desta remessa.
              </label>
              <p className={s.muted}>
                Envio demonstrativo. Nenhum agente será contatado.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>
              {modal === 'leave' ? 'Continuar editando' : 'Voltar'}
            </Button>
            {modal === 'habit' && (
              <Button onClick={saveHabit}>Salvar modelo</Button>
            )}
            {modal === 'review' && (
              <Button onClick={finish}>Confirmar solicitação</Button>
            )}
            {modal === 'repeat' && repeat && (
              <>
                <Button variant="outline" asChild>
                  <Link
                    href={
                      repeat.status === 'Em cotação'
                        ? '/portal/cotacoes/previa?cenario=comparar'
                        : '/portal/cotacoes/previa?cenario=fechada'
                    }
                  >
                    Ver detalhe demonstrativo
                  </Link>
                </Button>
                <Button onClick={() => begin(repeat)}>Nova remessa</Button>
              </>
            )}
            {modal === 'leave' && (
              <Button
                onClick={() => {
                  setQ(null);
                  setModal(null);
                  setNotice('');
                }}
              >
                Voltar sem salvar alterações
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
