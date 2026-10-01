'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Mail, UserCheck } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  CLIENT_KIND_LABELS,
  EMPTY_COMPANY_FILTER,
  INVITE_ACTION_LABELS,
  INVITE_MAIN_PATH,
  INVITE_STATUS_LABELS,
  allowedInviteActions,
  appendLog,
  applyInviteAction,
  companyAccessSummary,
  effectiveInviteStatus,
  filterCompanies,
  type AccessCompany,
  type AccessContact,
  type ClientKind,
  type CompanyFilter,
  type InviteAction,
  type InviteStatus,
} from '../../../_shared/demo/access-model';
import {
  updateAccessState,
  useAccessState,
  useSetViewingAs,
  useViewingAs,
} from '../../../_shared/demo/use-access';
import {
  CompanyFilterBar,
  DemoSeal,
  InviteStatusBadge,
  KindBadge,
  formatDate,
  formatDateTime,
} from './shared';

/** O que cada ação diz depois de feita. Toda ação de convite é SIMULADA. */
const ACTION_TOAST: Partial<Record<InviteAction, string>> = {
  enviar: 'Convite simulado: nenhum e-mail foi enviado.',
  reenviar: 'Reenvio simulado: nenhum e-mail foi enviado.',
};

function ContactRow({
  company,
  contact,
  now,
}: {
  company: AccessCompany;
  contact: AccessContact;
  now: Date;
}) {
  const status = effectiveInviteStatus(contact, now);
  const actions = allowedInviteActions(contact, now);
  const responsible = company.responsibleId === contact.id;

  const run = (action: InviteAction) => {
    const at = new Date();
    let done = false;
    updateAccessState((state) => {
      const target = state.companies.find((c) => c.id === company.id);
      const current = target?.contacts.find((c) => c.id === contact.id);
      if (!target || !current) return state;
      const result = applyInviteAction(current, action, at);
      if (!result.ok) {
        toast.error(result.error);
        return state;
      }
      done = true;
      const next = {
        ...state,
        companies: state.companies.map((c) =>
          c.id !== target.id
            ? c
            : {
                ...c,
                contacts: c.contacts.map((ct) =>
                  ct.id === current.id ? result.contact : ct,
                ),
              },
        ),
      };
      return appendLog(next, {
        at: at.toISOString(),
        companyId: target.id,
        companyName: target.name,
        what: `${INVITE_ACTION_LABELS[action]}: ${current.email}`,
        from: INVITE_STATUS_LABELS[result.from],
        to: INVITE_STATUS_LABELS[result.to],
      });
    });
    if (done)
      toast.info(
        ACTION_TOAST[action] ?? `${INVITE_ACTION_LABELS[action]} (simulado).`,
      );
  };

  const makeResponsible = () => {
    const at = new Date().toISOString();
    updateAccessState((state) => {
      const previous = state.companies
        .find((c) => c.id === company.id)
        ?.contacts.find((c) => c.id === company.responsibleId);
      const next = {
        ...state,
        companies: state.companies.map((c) =>
          c.id === company.id ? { ...c, responsibleId: contact.id } : c,
        ),
      };
      return appendLog(next, {
        at,
        companyId: company.id,
        companyName: company.name,
        what: 'Responsável da empresa',
        from: previous?.email ?? '—',
        to: contact.email,
      });
    });
  };

  const dateLine =
    status === 'convite_enviado'
      ? `Enviado em ${formatDateTime(contact.invitedAt)} · expira em ${formatDateTime(contact.expiresAt)}`
      : status === 'expirado'
        ? `Enviado em ${formatDateTime(contact.invitedAt)} · expirou em ${formatDateTime(contact.expiresAt)}`
        : status === 'cadastrado'
          ? `Cadastrou-se em ${formatDateTime(contact.registeredAt)} · ainda não entrou`
          : status === 'ativo'
            ? `Ativo desde ${formatDate(contact.activeSince)}`
            : status === 'bloqueado'
              ? `Bloqueado em ${formatDateTime(contact.blockedAt)}`
              : 'Ainda sem convite';

  return (
    <li className="space-y-2 border-t border-border py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="portal-body font-medium text-foreground">
            {contact.name || 'Sem nome'}
            {responsible && (
              <span className="portal-small ml-2 inline-flex items-center gap-1 text-brand-indigo">
                <UserCheck className="h-4 w-4" /> Responsável
              </span>
            )}
          </p>
          <p className="portal-small break-all text-portal-neutral">
            {contact.email}
          </p>
          <p className="portal-small text-portal-neutral">{dateLine}</p>
        </div>
        <InviteStatusBadge status={status} />
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={
              action === 'enviar' || action === 'reenviar'
                ? 'default'
                : 'outline'
            }
            className="min-h-9"
            onClick={() => run(action)}
          >
            {(action === 'enviar' || action === 'reenviar') && (
              <Mail className="mr-1.5 h-4 w-4" />
            )}
            {INVITE_ACTION_LABELS[action]}
          </Button>
        ))}
        {!responsible && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9"
            onClick={makeResponsible}
          >
            Tornar responsável
          </Button>
        )}
      </div>
    </li>
  );
}

function InvitePath() {
  return (
    <p className="portal-small text-portal-neutral">
      Caminho do convite:{' '}
      {INVITE_MAIN_PATH.map((s) => INVITE_STATUS_LABELS[s]).join(' → ')}.
      Laterais: {INVITE_STATUS_LABELS.expirado} (convite vence em 7 dias) e{' '}
      {INVITE_STATUS_LABELS.bloqueado}.
    </p>
  );
}

function CompanyCard({ company, now }: { company: AccessCompany; now: Date }) {
  const [open, setOpen] = useState(false);
  const viewingAs = useViewingAs();
  const setViewingAs = useSetViewingAs();
  const summary = companyAccessSummary(company, now);
  const responsible = company.contacts.find(
    (c) => c.id === company.responsibleId,
  );
  const viewing = viewingAs === company.id;

  const setKind = (kind: ClientKind) => {
    if (kind === company.kind) return;
    const at = new Date().toISOString();
    updateAccessState((state) =>
      appendLog(
        {
          ...state,
          companies: state.companies.map((c) =>
            c.id === company.id ? { ...c, kind } : c,
          ),
        },
        {
          at,
          companyId: company.id,
          companyName: company.name,
          what: 'Tipo de cliente',
          from: CLIENT_KIND_LABELS[company.kind],
          to: CLIENT_KIND_LABELS[kind],
        },
      ),
    );
  };

  const toggleDemo = () => {
    const at = new Date().toISOString();
    updateAccessState((state) =>
      appendLog(
        {
          ...state,
          companies: state.companies.map((c) =>
            c.id === company.id ? { ...c, demo: !c.demo } : c,
          ),
        },
        {
          at,
          companyId: company.id,
          companyName: company.name,
          what: 'Conta de demonstração / interna',
          from: company.demo ? 'sim' : 'não',
          to: company.demo ? 'não' : 'sim',
        },
      ),
    );
  };

  return (
    <article
      className={cn(
        'portal-card p-4 sm:p-6',
        viewing && 'ring-2 ring-portal-info',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h3 className="portal-h3">{company.name}</h3>
          <div className="flex flex-wrap gap-2">
            <KindBadge kind={company.kind} />
            <span className="portal-small inline-flex rounded-full border border-border px-2 py-0.5 text-portal-neutral">
              {company.wave === null ? 'Sem onda' : `Onda ${company.wave}`}
            </span>
            {company.demo && <DemoSeal />}
          </div>
          <p className="portal-small text-portal-neutral">
            {company.contacts.length} contato
            {company.contacts.length === 1 ? '' : 's'} · responsável:{' '}
            {responsible ? responsible.name || responsible.email : 'a definir'}
            {company.cnpj ? ` · CNPJ fictício ${company.cnpj}` : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(summary) as InviteStatus[])
              .filter((s) => summary[s] > 0)
              .map((s) => (
                <span key={s} className="portal-small text-portal-neutral">
                  <InviteStatusBadge status={s} /> {summary[s]}
                </span>
              ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={viewing ? 'default' : 'outline'}
            className="min-h-11"
            onClick={() => setViewingAs(viewing ? null : company)}
          >
            <Eye className="mr-1.5 h-5 w-5" />
            {viewing ? 'Encerrar ver como' : 'Ver como'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <ChevronUp className="mr-1.5 h-5 w-5" />
            ) : (
              <ChevronDown className="mr-1.5 h-5 w-5" />
            )}
            {open ? 'Fechar' : 'Contatos e convites'}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="portal-small text-portal-neutral">
              Tipo de cliente:
            </span>
            {(Object.keys(CLIENT_KIND_LABELS) as ClientKind[]).map((kind) => (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={company.kind === kind ? 'default' : 'outline'}
                className="min-h-9"
                aria-pressed={company.kind === kind}
                onClick={() => setKind(kind)}
              >
                {CLIENT_KIND_LABELS[kind]}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-9"
              onClick={toggleDemo}
            >
              {company.demo
                ? 'Desmarcar demonstração'
                : 'Marcar como demonstração'}
            </Button>
          </div>
          {company.kind === 'saas' && (
            <p className="portal-small rounded-md bg-brand-indigo-100 px-3 py-2 text-brand-indigo">
              SaaS puro: sem operação da Freitas nem integração Inova. O cliente
              informa os dados; nada vem preenchido pela operação.
            </p>
          )}
          <InvitePath />
          {company.contacts.length ? (
            <ul>
              {company.contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  company={company}
                  contact={contact}
                  now={now}
                />
              ))}
            </ul>
          ) : (
            <p className="portal-body text-portal-neutral">
              Nenhum contato. Importe pela aba “Importar CSV”.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function CompaniesTab() {
  const state = useAccessState();
  const [filter, setFilter] = useState<CompanyFilter>(EMPTY_COMPANY_FILTER);
  // Um relógio por render: o status "Expirado" e as datas da linha concordam.
  const now = useMemo(() => new Date(), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const companies = filterCompanies(state.companies, filter, now);

  return (
    <div className="space-y-6">
      <CompanyFilterBar value={filter} onChange={setFilter} />
      <p className="portal-small text-portal-neutral">
        {companies.length} de {state.companies.length} empresas
      </p>
      {companies.length ? (
        <div className="space-y-4">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} now={now} />
          ))}
        </div>
      ) : (
        <p className="portal-body rounded-lg border border-dashed border-border p-6 text-portal-neutral">
          Nenhuma empresa neste recorte. Limpe os filtros para ver todas.
        </p>
      )}
    </div>
  );
}
