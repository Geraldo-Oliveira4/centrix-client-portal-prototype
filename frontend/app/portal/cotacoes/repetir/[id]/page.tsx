'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
} from '@/components/ui';
import { useMyQuotation, useMyClient } from '@/hooks/use-portal-quotations';
import type { PortalQuotation } from '@/types/portal';
import { DraftRequestForm } from '../../previa/draft-request-form';
import { availableAgents, type Quote } from '../../previa/model';
import { reusableDraft } from '../../previa-habituais/model';
import { historyReturn, isHistory } from '../../lib/history-model';
import {
  repeatQuotation,
  requestIssue,
  type LocalRequest,
} from '../../lib/repeat-model';
import { saveLocalRequest, useLocalRequests } from '../../lib/local-requests';

function RepeatPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { quotation, isLoading, isError } = useMyQuotation(params.id);
  const { client, isError: clientError } = useMyClient();
  const local = useLocalRequests(client?.id);
  if (isError || clientError) return <ErrorComponent />;
  if (isLoading || !client || !local.loaded) return <LoaderComponent />;
  if (local.error) return <p role="alert">{local.error}</p>;
  if (!quotation || !isHistory(quotation.state))
    return (
      <p>
        Abra uma cotação encerrada para preparar uma nova remessa.{' '}
        <Link className="underline" href="/portal/cotacoes">
          Voltar às cotações
        </Link>
      </p>
    );
  const resumeId = search.get('rascunho');
  const resume = local.rows.find(
    (r) => r.id === resumeId && r.sourceId === quotation.id,
  );
  if (resumeId && !resume)
    return (
      <p>
        Rascunho não encontrado neste navegador.{' '}
        <Link className="underline" href="/portal/cotacoes">
          Voltar às cotações
        </Link>
      </p>
    );
  return (
    <RepeatForm
      key={`${quotation.id}:${resumeId || 'new'}`}
      source={quotation}
      clientId={client.id}
      resume={resume}
      existing={local.rows.filter(
        (r) => r.sourceId === quotation.id && r.stage === 'draft',
      )}
      returnHref={historyReturn(search.get('retorno'))}
    />
  );
}

function RepeatForm({
  source,
  clientId,
  resume,
  existing,
  returnHref,
}: {
  source: PortalQuotation;
  clientId: string;
  resume?: LocalRequest;
  existing: LocalRequest[];
  returnHref: string;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState(
    () => resume?.quote || repeatQuotation(source),
  );
  const [id] = useState(() => resume?.id || crypto.randomUUID());
  const [choosing, setChoosing] = useState(!resume && existing.length > 0);
  const [dialog, setDialog] = useState<'review' | 'leave' | 'habit' | null>(
    null,
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    resume?.stage === 'draft'
      ? 'Rascunho salvo neste navegador. Continue de onde parou.'
      : '',
  );
  const [agents, setAgents] = useState<string[]>(resume?.agents || []);
  const [confirmed, setConfirmed] = useState(false);
  const [waiting, setWaiting] = useState(resume?.stage === 'waiting');
  const [name, setName] = useState('');
  const [formKey, setFormKey] = useState(0);
  const record = (q: Quote, stage: LocalRequest['stage']) => {
    try {
      saveLocalRequest(clientId, {
        id,
        sourceId: source.id,
        sourceReference: source.reference,
        quote: q,
        stage,
        agents,
        updatedAt: new Date().toISOString(),
      });
      setError('');
      return true;
    } catch {
      setError(
        'Não foi possível salvar. Seus dados continuam nesta tela; tente novamente.',
      );
      return false;
    }
  };
  const save = (patch: Partial<Quote>) => {
    const next = { ...quote, ...patch };
    setQuote(next);
    if (record(next, 'draft')) {
      setNotice(
        'Rascunho salvo em Em andamento → Preencher detalhes. Nenhum convite enviado.',
      );
      router.replace(
        `/portal/cotacoes/repetir/${source.id}?rascunho=${id}&retorno=${encodeURIComponent(returnHref)}`,
        { scroll: false },
      );
    }
  };
  const review = (patch: Partial<Quote>) => {
    const next = { ...quote, ...patch };
    setQuote(next);
    setNotice('');
    const issue = requestIssue(next);
    if (issue) {
      setError(issue);
      return;
    }
    setError('');
    setConfirmed(false);
    setDialog('review');
  };
  const finish = () => {
    const issue = requestIssue(quote);
    if (issue || !agents.length || !confirmed) {
      setError(issue || 'Selecione agentes e confirme a revisão.');
      return;
    }
    if (!record(quote, 'waiting')) return;
    setWaiting(true);
    setDialog(null);
    setNotice('');
    router.replace(
      `/portal/cotacoes/repetir/${source.id}?rascunho=${id}&retorno=${encodeURIComponent(returnHref)}`,
      { scroll: false },
    );
  };
  const habitKey = `centrix-history-habits-v1:${clientId}`;
  const saveHabit = () => {
    if (!name.trim() || !quote.supplier.trim() || !quote.product.trim()) {
      setError('Informe nome, fornecedor e mercadoria para salvar o modelo.');
      return;
    }
    try {
      const habits = JSON.parse(localStorage.getItem(habitKey) || '[]');
      if (!Array.isArray(habits)) throw new Error();
      if (
        habits.some(
          (h) => h.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
        )
      ) {
        setError('Já existe um modelo com esse nome.');
        return;
      }
      habits.push({
        id: crypto.randomUUID(),
        sourceId: source.id,
        name: name.trim(),
        supplier: quote.supplier,
        draft: reusableDraft(quote.manualDraft!),
      });
      localStorage.setItem(habitKey, JSON.stringify(habits));
      setDialog(null);
      setError('');
      setNotice(
        'Modelo salvo neste navegador. Ele fica disponível em Usar modelo salvo ao preparar outra remessa.',
      );
    } catch {
      setError(
        'Não foi possível salvar o modelo. Seus dados continuam no formulário.',
      );
    }
  };
  const [models, setModels] = useState<
    {
      id: string;
      sourceId: string;
      name: string;
      supplier: string;
      draft: NonNullable<Quote['manualDraft']>;
    }[]
  >([]);
  const [showModels, setShowModels] = useState(false);
  const loadModels = () => {
    try {
      const list = JSON.parse(localStorage.getItem(habitKey) || '[]');
      if (!Array.isArray(list)) throw new Error();
      setModels(list.filter((h) => h.sourceId === source.id));
      setShowModels(true);
    } catch {
      setError('Não foi possível recuperar os modelos salvos.');
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <button
        className="portal-small underline underline-offset-4"
        onClick={() => setDialog('leave')}
      >
        Voltar ao histórico
      </button>
      <header>
        <h1 className="text-2xl font-semibold">
          {waiting ? 'Aguardando agentes' : 'Nova remessa'}
        </h1>
        <p className="portal-body mt-2 text-portal-neutral">
          Dados reaproveitados da {source.reference}. Revise para esta nova
          remessa.
        </p>
      </header>
      <p className="portal-small text-portal-neutral">
        Prévia · rascunhos e modelos salvos neste navegador. O envio aos agentes
        é simulado.
      </p>
      {error && (
        <p role="alert" className="text-portal-warning-ink">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-md border bg-background p-4 portal-body"
        >
          {notice}{' '}
          <Link className="underline" href="/portal/cotacoes?tab=funil">
            Ver em andamento
          </Link>
        </p>
      )}
      {choosing ? (
        <section className="space-y-4 rounded-lg border bg-background p-6">
          <h2 className="font-medium">Você já tem rascunhos desta cotação</h2>
          <p className="portal-body text-portal-neutral">
            Continue um deles ou prepare uma remessa separada.
          </p>
          {existing.map((r) => (
            <Link
              className="block underline"
              key={r.id}
              href={`/portal/cotacoes/repetir/${source.id}?rascunho=${r.id}&retorno=${encodeURIComponent(returnHref)}`}
            >
              Continuar {r.quote.po || r.quote.product || 'rascunho'} ·{' '}
              {new Date(r.updatedAt).toLocaleString('pt-BR')}
            </Link>
          ))}
          <Button variant="outline" onClick={() => setChoosing(false)}>
            Preparar outra remessa
          </Button>
        </section>
      ) : waiting ? (
        <section className="space-y-4 rounded-lg border bg-background p-6">
          <h2 className="font-medium">
            Solicitação preparada · envio simulado
          </h2>
          <p>
            {quote.supplier} · {quote.product}
          </p>
          <p>
            {quote.origin} → {quote.destination}
          </p>
          <ul className="space-y-2">
            {agents.map((agent) => (
              <li key={agent}>{agent} · aguardando resposta (simulação)</li>
            ))}
          </ul>
          <Link className="underline" href="/portal/cotacoes?tab=funil">
            Acompanhar em andamento
          </Link>
        </section>
      ) : (
        <>
          <div className="rounded-md border-l-2 border-portal-neutral/50 px-4 py-2 portal-body text-portal-neutral">
            Informe PO, datas, quantidade, peso/volume e valor desta carga.
            Selecione os agentes na revisão.
          </div>
          {!resume && (
            <Button variant="ghost" onClick={loadModels}>
              Usar modelo salvo desta cotação
            </Button>
          )}
          {showModels && (
            <div className="rounded-md border bg-background p-4 space-y-3">
              <p>
                O modelo substitui os dados desta preparação ainda não salva.
              </p>
              {!models.length && <p>Nenhum modelo salvo desta cotação.</p>}
              {models.map((h) => (
                <Button
                  variant="outline"
                  key={h.id}
                  onClick={() => {
                    const base = repeatQuotation(source);
                    setQuote({
                      ...base,
                      supplier: h.supplier,
                      product: h.draft.values.product || '',
                      manualDraft: {
                        ...h.draft,
                        values: {
                          ...base.manualDraft!.values,
                          ...h.draft.values,
                        },
                      },
                    });
                    setFormKey((k) => k + 1);
                    setShowModels(false);
                  }}
                >
                  {h.name}
                </Button>
              ))}
            </div>
          )}
          <DraftRequestForm
            key={formKey}
            quotation={quote}
            onSave={save}
            onReview={review}
            onSaveTemplate={(patch) => {
              setQuote({ ...quote, ...patch });
              setName('');
              setError('');
              setDialog('habit');
            }}
          />
        </>
      )}
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'leave'
                ? 'Voltar ao histórico?'
                : dialog === 'habit'
                  ? 'Salvar como habitual'
                  : 'Revisar nova solicitação'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'leave'
                ? 'Alterações desde o último salvamento não serão mantidas. Os rascunhos salvos permanecem em Em andamento.'
                : dialog === 'habit'
                  ? 'Guarde os dados estáveis para outra remessa. PO, datas, dimensões, valores e destinatários não entram no modelo.'
                  : 'Confira os dados e selecione os agentes. Esta confirmação simula o envio.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-portal-warning-ink">
              {error}
            </p>
          )}
          {dialog === 'habit' && (
            <label className="space-y-2">
              Nome do modelo
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          {dialog === 'review' && (
            <div className="space-y-4 text-sm">
              <p>
                {quote.supplier} · {quote.product}
              </p>
              <p>
                {quote.origin} → {quote.destination}
              </p>
              <p>
                PO: {quote.po || 'não informado'} · {quote.weight} kg ·{' '}
                {quote.volume} m³
              </p>
              <p>
                Prontidão: {quote.readyDate} · chegada necessária:{' '}
                {quote.needDate}
              </p>
              <fieldset className="space-y-2">
                <legend className="mb-2 font-medium">
                  Agentes disponíveis · demonstração
                </legend>
                {availableAgents.map((agent) => (
                  <label key={agent} className="flex gap-2">
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
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Revisei os dados desta nova remessa e os destinatários.
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Continuar editando
            </Button>
            {dialog === 'leave' ? (
              <Button onClick={() => router.push(returnHref)}>
                Voltar sem salvar alterações
              </Button>
            ) : (
              <Button onClick={dialog === 'habit' ? saveHabit : finish}>
                {dialog === 'habit'
                  ? 'Salvar modelo'
                  : 'Confirmar envio simulado'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default function RepeatRequestPage() {
  return (
    <Suspense fallback={<LoaderComponent />}>
      <RepeatPage />
    </Suspense>
  );
}
