'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Send,
  PackageCheck,
  X,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  createShipmentInstruction,
  sendShipmentInstruction,
  updateSIAgentOrigem,
  useShipmentInstruction,
  type SIApi,
} from '@/hooks/use-shipment-instruction';
import { useUsers } from '@/hooks/use-users';
import type { SIQuotationView, ShipmentInstruction, SIParty, SendSIPayload } from '@/types/quotation';
import { MODAL_LABELS, SERVICE_TYPE_LABELS } from '@/types/quotation';

// SI generation is exposed to two audiences (ARB-2449): the internal analyst and
// the portal client on their own quotations. `portal` mode hides analyst-only
// controls (PTAX, platform-user CC, origin-agent request/follow-up).
type SIVariant = 'analyst' | 'portal';

function hasIncotermDivergence(siIncoterm: string | null | undefined, formIncoterm: string): boolean {
  if (!siIncoterm || !formIncoterm) return false;
  return siIncoterm.toUpperCase() !== formIncoterm.toUpperCase();
}

interface ShipmentInstructionSectionProps {
  quotation: SIQuotationView;
  onSent: () => void;
  variant?: SIVariant;
  siApi?: SIApi;
  // When false, the section never offers the "generate" CTA and renders nothing
  // if no SI exists yet — used to show a read-only SI on a closed quotation
  // (e.g. the portal after the client has already sent it).
  canCreate?: boolean;
}

// ---------------------------------------------------------------------------
// Party sub-form
// ---------------------------------------------------------------------------

function PartyForm({
  label,
  value,
  onChange,
  collapsed,
  onToggle,
}: {
  label: string;
  value: SIParty;
  onChange: (v: SIParty) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const isTextoLivreMode = !!value.texto_livre;

  const field = (key: keyof Omit<SIParty, 'texto_livre'>, placeholder: string) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground capitalize">{key === 'pic' ? 'Contato (PIC)' : key}</Label>
      <Input
        value={(value[key] as string) ?? ''}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );

  const toggleTextoLivre = () => {
    if (isTextoLivreMode) {
      // Switch back to structured — clear texto_livre
      onChange({ ...value, texto_livre: undefined });
    } else {
      // Switch to free-text mode — pre-fill from current structured fields
      const parts = [
        value.nome,
        value.cnpj && `CNPJ: ${value.cnpj}`,
        value.endereco,
        value.pic && `Contato: ${value.pic}`,
        value.tel && `Tel: ${value.tel}`,
        value.email && `E-mail: ${value.email}`,
      ].filter(Boolean);
      onChange({ texto_livre: parts.join('\n') });
    }
  };

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          {label}
          {isTextoLivreMode && (
            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              texto livre
            </span>
          )}
        </span>
        {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleTextoLivre}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              {isTextoLivreMode ? 'Usar campos individuais' : 'Colar como texto livre'}
            </button>
          </div>
          {isTextoLivreMode ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dados completos (cole aqui)</Label>
              <Textarea
                value={value.texto_livre ?? ''}
                onChange={(e) => onChange({ ...value, texto_livre: e.target.value })}
                placeholder={'Nome da empresa\nCNPJ: 00.000.000/0001-00\nEndereço completo\nContato: Nome\nTel: +55 (11) 0000-0000\nE-mail: contato@empresa.com'}
                rows={5}
                className="text-sm resize-none"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {field('nome', 'Nome da empresa')}
              {field('cnpj', 'CNPJ / Tax ID')}
              {field('endereco', 'Endereço completo')}
              {field('pic', 'Nome do responsável')}
              {field('tel', 'Telefone')}
              {field('email', 'E-mail')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email preview dialog
// ---------------------------------------------------------------------------

const LEGAL_NOTICE =
  'AVISO LEGAL: A Freitas Comex atua como intermediária na negociação ' +
  'e não se responsabiliza solidariamente por obrigações financeiras, ' +
  'tributárias ou aduaneiras decorrentes desta operação. ' +
  'As informações contidas neste documento são de responsabilidade ' +
  'exclusiva das partes envolvidas na transação comercial.';

function PartyPreview({ label, party }: { label: string; party: SIParty }) {
  if (party.texto_livre) {
    return (
      <div className="grid grid-cols-[120px_1fr] gap-y-0.5 text-sm">
        <span className="font-semibold">{label}:</span>
        <span className="text-muted-foreground whitespace-pre-line">{party.texto_livre}</span>
      </div>
    );
  }

  const fields = [
    party.nome,
    party.cnpj && `CNPJ: ${party.cnpj}`,
    party.endereco,
    party.pic && `Contato: ${party.pic}`,
    party.tel && `Tel: ${party.tel}`,
    party.email && `E-mail: ${party.email}`,
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-[120px_1fr] gap-y-0.5 text-sm">
      <span className="font-semibold">{label}:</span>
      {fields.length > 0 ? (
        <span className="text-muted-foreground">{fields.join(' · ')}</span>
      ) : (
        <span className="italic text-muted-foreground">(não informado)</span>
      )}
    </div>
  );
}

function SIEmailPreview({
  open,
  onOpenChange,
  si,
  form,
  quotation,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  si: ShipmentInstruction | null;
  form: SIFormState;
  quotation: SIQuotationView;
}) {
  const origin =
    quotation.porto_embarque ?? quotation.aeroporto_embarque ?? null;
  const destinationList =
    quotation.porto_destino ?? quotation.aeroporto_destino ?? null;
  const destination = Array.isArray(destinationList)
    ? destinationList[0] ?? null
    : destinationList;

  const subject = [
    `Instruções de embarque ${si?.reference ?? '(rascunho)'}`,
    `Ref. ${quotation.reference}${quotation.client_reference ? ` - ${quotation.client_reference}` : ''}`,
    origin && destination ? `[${origin} x ${destination}]` : null,
  ]
    .filter(Boolean)
    .join(' - ');

  const flagLines: string[] = [];
  if (form.ptax_tipo === 'negociado' && form.ptax_valor) {
    flagLines.push(`PTAX: ${form.ptax_valor} (negociado)`);
  } else {
    flagLines.push('PTAX: padrão');
  }
  flagLines.push(form.incluir_seguro ? 'Seguro: incluir' : 'Seguro: não incluir');
  if (form.solicitar_agente_origem) {
    flagLines.push('Solicitar dados do agente de origem (coleta junto ao exportador)');
  }
  if (form.prontidao_prevista) {
    const d = new Date(form.prontidao_prevista + 'T12:00:00');
    flagLines.push(
      `Prontidão prevista da carga: ${d.toLocaleDateString('pt-BR')}`,
    );
  }

  const ccEmails = form.cc_emails_raw
    .replace(/;/g, ',')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pré-visualização — Instrução de Embarque</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm font-mono bg-muted/30 rounded-md p-4 border">
          {/* Subject */}
          <div>
            <span className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide">
              Assunto
            </span>
            <p className="mt-1 font-medium font-sans">{subject}</p>
          </div>

          {ccEmails.length > 0 && (
            <div>
              <span className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide">
                Cópia
              </span>
              <p className="mt-1 text-muted-foreground font-sans">{ccEmails.join(', ')}</p>
            </div>
          )}

          <hr className="border-border" />

          {/* Instruções livres */}
          {form.instrucoes_livres && (
            <div className="border-l-4 border-amber-400 pl-3">
              <p className="whitespace-pre-wrap font-sans font-semibold uppercase">
                {form.instrucoes_livres}
              </p>
            </div>
          )}

          {/* Incoterm divergence alert */}
          {hasIncotermDivergence(si?.incoterm_cotado, form.incoterm_aprovado) && (
            <div className="rounded bg-orange-100 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-800 px-3 py-2 font-sans text-orange-800 dark:text-orange-300 font-medium">
              ATENÇÃO: Incoterm alterado de {si?.incoterm_cotado} (cotado) para{' '}
              {form.incoterm_aprovado} (aprovado pelo cliente).
            </div>
          )}

          {/* Header */}
          <div>
            <p className="text-base font-bold font-sans">
              Instrução de Embarque — {si?.reference ?? '(rascunho)'}
            </p>
            <p className="font-sans text-muted-foreground">Referência: {quotation.reference}</p>
          </div>

          {/* Parties */}
          <div className="space-y-2">
            <p className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide">
              Partes
            </p>
            <div className="space-y-1.5 font-sans">
              <PartyPreview label="Exportador" party={form.exportador} />
              <PartyPreview label="Consignatário" party={form.consignatario} />
              <PartyPreview label="Notificado" party={form.notificado} />
            </div>
          </div>

          {/* Dados do embarque */}
          <div className="space-y-1.5">
            <p className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do Embarque
            </p>
            <div className="font-sans space-y-0.5">
              {quotation.modal && (
                <p>
                  <span className="font-semibold">Modal:</span>{' '}
                  {MODAL_LABELS[quotation.modal] ?? quotation.modal}
                </p>
              )}
              {quotation.service_type && (
                <p>
                  <span className="font-semibold">Direção:</span>{' '}
                  {SERVICE_TYPE_LABELS[quotation.service_type] ?? quotation.service_type}
                </p>
              )}
              {origin && (
                <p>
                  <span className="font-semibold">Local de coleta:</span> {origin}
                </p>
              )}
              {destination && (
                <p>
                  <span className="font-semibold">Destino:</span> {destination}
                </p>
              )}
              {form.incoterm_aprovado && (
                <p>
                  <span className="font-semibold">Incoterm:</span> {form.incoterm_aprovado}
                </p>
              )}
              {quotation.stackability != null && (
                <p>
                  <span className="font-semibold">Empilhável:</span>{' '}
                  {quotation.stackability ? 'Sim' : 'Não'}
                </p>
              )}
              {quotation.carga_tombavel != null && (
                <p>
                  <span className="font-semibold">Tombável:</span>{' '}
                  {quotation.carga_tombavel ? 'Sim' : 'Não'}
                </p>
              )}
              {quotation.declared_value != null && (
                <p>
                  <span className="font-semibold">Valor da carga:</span>{' '}
                  {quotation.declared_value_currency ?? ''} {quotation.declared_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>

          {/* Instruções adicionais (flags) */}
          <div className="space-y-1.5">
            <p className="text-xs font-sans font-semibold text-muted-foreground uppercase tracking-wide">
              Instruções Adicionais
            </p>
            <div className="font-sans space-y-0.5">
              {flagLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>

          <hr className="border-border" />

          {/* Legal notice */}
          <p className="text-xs font-sans text-muted-foreground leading-relaxed">
            {LEGAL_NOTICE}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SI draft form
// ---------------------------------------------------------------------------

interface SIFormState {
  exportador: SIParty;
  consignatario: SIParty;
  notificado: SIParty;
  incoterm_aprovado: string;
  ptax_tipo: 'padrao' | 'negociado';
  ptax_valor: string;
  incluir_seguro: boolean;
  solicitar_agente_origem: boolean;
  prontidao_prevista: string;
  instrucoes_livres: string;
  cc_emails_raw: string;
}

function siToForm(si: ShipmentInstruction): SIFormState {
  return {
    exportador: si.exportador ?? {},
    consignatario: si.consignatario ?? {},
    notificado: si.notificado ?? {},
    incoterm_aprovado: si.incoterm_aprovado ?? si.incoterm_cotado ?? '',
    ptax_tipo: si.ptax_tipo ?? 'padrao',
    ptax_valor: si.ptax_valor != null ? String(si.ptax_valor) : '',
    incluir_seguro: si.incluir_seguro,
    solicitar_agente_origem: si.solicitar_agente_origem,
    prontidao_prevista: si.prontidao_prevista ?? '',
    instrucoes_livres: si.instrucoes_livres ?? '',
    cc_emails_raw: (si.cc_emails ?? []).join(', '),
  };
}

function formToPayload(form: SIFormState, confirmDivergence: boolean): SendSIPayload {
  return {
    exportador: form.exportador,
    consignatario: form.consignatario,
    notificado: form.notificado,
    incoterm_aprovado: form.incoterm_aprovado || undefined,
    ptax_tipo: form.ptax_tipo,
    ptax_valor: form.ptax_valor ? parseFloat(form.ptax_valor) : undefined,
    incluir_seguro: form.incluir_seguro,
    solicitar_agente_origem: form.solicitar_agente_origem,
    prontidao_prevista: form.prontidao_prevista || undefined,
    instrucoes_livres: form.instrucoes_livres || undefined,
    cc_emails: form.cc_emails_raw.replace(/;/g, ',').split(',').map((e) => e.trim()).filter(Boolean),
    confirm_incoterm_divergence: confirmDivergence,
  };
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function ShipmentInstructionSection({
  quotation,
  onSent,
  variant = 'analyst',
  siApi,
  canCreate = true,
}: ShipmentInstructionSectionProps) {
  const { si, incotermDivergence, proposalValidityWarning, isLoading, mutate } = useShipmentInstruction(quotation.id, siApi);

  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmDivergence, setConfirmDivergence] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SIFormState | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    const result = await createShipmentInstruction(quotation.id, {}, siApi);
    setCreating(false);
    if (result) {
      setForm(siToForm(result.si));
      setShowForm(true);
      mutate();
    }
  };

  const handleSend = async () => {
    if (!form) return;

    const hasIncoterm = hasIncotermDivergence(si?.incoterm_cotado, form.incoterm_aprovado);

    if (hasIncoterm && !confirmDivergence) {
      setConfirmDivergence(true);
      return;
    }

    setSending(true);
    const ok = await sendShipmentInstruction(quotation.id, formToPayload(form, confirmDivergence), siApi);
    setSending(false);
    if (ok) {
      setShowForm(false);
      onSent();
    }
  };

  // When SI already exists and form not yet populated, populate from it.
  // form and showForm are intentionally excluded from deps — including them would
  // re-run this effect on every keystroke and overwrite the analyst's edits.
  useEffect(() => {
    if (si && !form && !showForm && si.status === 'RASCUNHO') {
      setForm(siToForm(si));
      setShowForm(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [si]);

  const isSent = si?.status === 'ENVIADA';

  // Read-only context (e.g. portal on a closed quotation) with no SI: show
  // nothing rather than an empty card or a "generate" CTA.
  if (!si && !showForm && !isLoading && !canCreate) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200/60 dark:border-amber-900/30">
        <div className="flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            Instrução de Embarque
          </p>
          {isSent && (
            <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Enviada
            </span>
          )}
          {si && !isSent && (
            <span className="text-xs text-muted-foreground">Rascunho — {si.reference}</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* RN-03: expired proposal validity warning */}
        {proposalValidityWarning && (
          <div className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950/20 p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              A proposta aprovada está com a validade expirada. Confirme com o agente antes de enviar a instrução.
            </p>
          </div>
        )}

        {/* Not yet created — includes a quotation whose only prior SI was
            cancelled by a reopen: GET /si returns 404 for a CANCELADA row
            (same convention as create/send_shipment_instruction), so si is
            simply null here and this CTA lets the analyst generate a fresh one. */}
        {!si && !showForm && !isLoading && canCreate && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Cotação aprovada pelo cliente. Gere a Instrução de Embarque para enviar ao agente selecionado.
            </p>
            <Button onClick={handleCreate} disabled={creating} className="gap-2 shrink-0">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Gerar Instrução de Embarque
            </Button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        )}

        {/* Sent view */}
        {isSent && si && (
          <SentView si={si} variant={variant} siApi={siApi} />
        )}

        {/* Draft form */}
        {showForm && form && !isSent && (
          <DraftForm
            si={si}
            form={form}
            onChange={setForm}
            incotermDivergence={incotermDivergence || hasIncotermDivergence(si?.incoterm_cotado, form.incoterm_aprovado)}
            confirmDivergence={confirmDivergence}
            onConfirmDivergenceChange={setConfirmDivergence}
            onSend={handleSend}
            sending={sending}
            quotation={quotation}
            variant={variant}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft form sub-component — two-panel layout (KeeperQuotes pattern)
// ---------------------------------------------------------------------------

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// Platform-user CC picker. Isolated so useUsers (which hits the internal
// /get-users via base_api) is never called in portal mode — a portal client has
// no internal session and would be bounced to the internal login.
function AnalystCcSection({
  form,
  onChange,
}: {
  form: SIFormState;
  onChange: (f: SIFormState) => void;
}) {
  const { users } = useUsers();
  const platformUsers = users ?? [];

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">E-mails em cópia</Label>
      {platformUsers.length > 0 && (() => {
        const parsedEmails = form.cc_emails_raw.split(',').map((e) => e.trim()).filter(Boolean);
        return (
        <div className="flex flex-wrap gap-1">
          {platformUsers.map((u) => {
            const isSelected = parsedEmails.includes(u.email);
            return (
              <button
                key={u.email}
                type="button"
                onClick={() => {
                  const updated = isSelected
                    ? parsedEmails.filter((e) => e !== u.email)
                    : [...parsedEmails, u.email];
                  onChange({ ...form, cc_emails_raw: updated.join(', ') });
                }}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/50',
                )}
              >
                {u.name || u.email}
                {isSelected && <X className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
        );
      })()}
      <Input
        value={form.cc_emails_raw}
        onChange={(e) => onChange({ ...form, cc_emails_raw: e.target.value })}
        placeholder="logistica@empresa.com, gerente@empresa.com"
        className="h-8 text-sm"
      />
      <p className="text-xs text-muted-foreground">Clique nos nomes para adicionar/remover. Ou digite e-mails separados por vírgula.</p>
    </div>
  );
}

function DraftForm({
  si,
  form,
  onChange,
  incotermDivergence,
  confirmDivergence,
  onConfirmDivergenceChange,
  onSend,
  sending,
  quotation,
  variant,
}: {
  si: ShipmentInstruction | null;
  form: SIFormState;
  onChange: (f: SIFormState) => void;
  incotermDivergence: boolean;
  confirmDivergence: boolean;
  onConfirmDivergenceChange: (v: boolean) => void;
  onSend: () => void;
  sending: boolean;
  quotation: SIQuotationView;
  variant: SIVariant;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({
    exportador: false,
    consignatario: false,
    notificado: true,
  });

  const origin = quotation.porto_embarque ?? quotation.aeroporto_embarque ?? null;
  const destinationList = quotation.porto_destino ?? quotation.aeroporto_destino ?? null;
  const destination = Array.isArray(destinationList)
    ? destinationList.join(', ')
    : (destinationList ?? null);

  return (
    <div className="space-y-4">
      {/* Incoterm divergence alert — full width */}
      {incotermDivergence && (
        <div className="flex items-start gap-3 rounded-md border border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20 p-3">
          <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-orange-900 dark:text-orange-200">Incoterm divergente</p>
            <p className="text-orange-700 dark:text-orange-300">
              Cotado: <strong>{si?.incoterm_cotado}</strong> — Aprovado:{' '}
              <strong>{form.incoterm_aprovado}</strong>. Confirme antes de enviar.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmDivergence}
                onChange={(e) => onConfirmDivergenceChange(e.target.checked)}
                className="rounded border-orange-400"
              />
              <span className="text-orange-800 dark:text-orange-300 font-medium">
                Confirmo a alteração de Incoterm
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Two-panel body */}
      <div className="grid grid-cols-2 gap-5 items-start">

        {/* ── Left panel: Parties ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Partes</p>
          <PartyForm
            label="Exportador"
            value={form.exportador}
            onChange={(v) => onChange({ ...form, exportador: v })}
            collapsed={collapsed.exportador}
            onToggle={() => setCollapsed((p) => ({ ...p, exportador: !p.exportador }))}
          />
          <PartyForm
            label="Consignatário"
            value={form.consignatario}
            onChange={(v) => onChange({ ...form, consignatario: v })}
            collapsed={collapsed.consignatario}
            onToggle={() => setCollapsed((p) => ({ ...p, consignatario: !p.consignatario }))}
          />
          <PartyForm
            label="Notificado"
            value={form.notificado}
            onChange={(v) => onChange({ ...form, notificado: v })}
            collapsed={collapsed.notificado}
            onToggle={() => setCollapsed((p) => ({ ...p, notificado: !p.notificado }))}
          />
        </div>

        {/* ── Right panel: Shipment data + flags ── */}
        <div className="space-y-4">

          {/* Read-only shipment data inherited from quotation */}
          <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Dados do Embarque
            </p>
            {quotation.modal && (
              <ReadOnlyField
                label="Modal"
                value={MODAL_LABELS[quotation.modal] ?? quotation.modal}
              />
            )}
            {quotation.service_type && (
              <ReadOnlyField
                label="Direção"
                value={SERVICE_TYPE_LABELS[quotation.service_type] ?? quotation.service_type}
              />
            )}
            <ReadOnlyField label="Origem" value={origin} />
            <ReadOnlyField label="Destino" value={destination} />
            {si?.incoterm_cotado && (
              <ReadOnlyField label="Incoterm cotado" value={si.incoterm_cotado} />
            )}
          </div>

          {/* Editable incoterm + prontidão */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Incoterm aprovado</Label>
              <Input
                value={form.incoterm_aprovado}
                onChange={(e) => onChange({ ...form, incoterm_aprovado: e.target.value.toUpperCase() })}
                placeholder="Ex: FOB, EXW, CIF"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prontidão prevista</Label>
              <Input
                type="date"
                value={form.prontidao_prevista}
                onChange={(e) => onChange({ ...form, prontidao_prevista: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Flags */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flags</p>
            {variant === 'analyst' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">PTAX</Label>
                  <Select
                    value={form.ptax_tipo}
                    onValueChange={(v) => onChange({ ...form, ptax_tipo: v as 'padrao' | 'negociado' })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Padrão</SelectItem>
                      <SelectItem value="negociado">Negociado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.ptax_tipo === 'negociado' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor PTAX</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={form.ptax_valor}
                      onChange={(e) => onChange({ ...form, ptax_valor: e.target.value })}
                      placeholder="Ex: 5.2500"
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.incluir_seguro}
                  onChange={(e) => onChange({ ...form, incluir_seguro: e.target.checked })}
                  className="rounded"
                />
                Incluir seguro
              </label>
              {variant === 'analyst' && (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.solicitar_agente_origem}
                    onChange={(e) => onChange({ ...form, solicitar_agente_origem: e.target.checked })}
                    className="rounded"
                  />
                  Solicitar agente de origem
                </label>
              )}
            </div>
          </div>

          {/* CC emails — analyst only (platform users) */}
          {variant === 'analyst' && (
            <AnalystCcSection form={form} onChange={onChange} />
          )}

          {/* Instruções livres */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Instruções adicionais (texto livre)</Label>
            <Textarea
              value={form.instrucoes_livres}
              onChange={(e) => onChange({ ...form, instrucoes_livres: e.target.value })}
              placeholder="Ex: SUSAN, CONFORME CONVERSAMOS SERÁ FOB. FAVOR ATUALIZAR DE ACORDO."
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Actions — full width */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2">
          <Eye className="w-4 h-4" />
          Pré-visualizar
        </Button>
        <Button
          onClick={onSend}
          disabled={sending || (incotermDivergence && !confirmDivergence)}
          className="gap-2"
        >
          {sending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
          ) : (
            <><Send className="w-4 h-4" /> Enviar Instrução de Embarque</>
          )}
        </Button>
      </div>

      <SIEmailPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        si={si}
        form={form}
        quotation={quotation}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sent view sub-component
// ---------------------------------------------------------------------------

function SentView({
  si,
  variant,
  siApi,
}: {
  si: ShipmentInstruction;
  variant: SIVariant;
  siApi?: SIApi;
}) {
  const [agentOrigem, setAgentOrigem] = useState(si.agente_origem ?? '');
  const [saving, setSaving] = useState(false);

  const handleSaveAgentOrigem = async () => {
    if (!agentOrigem.trim()) return;
    setSaving(true);
    await updateSIAgentOrigem(si.quotation_id, { agente_origem: agentOrigem }, siApi);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Referência:</span>{' '}
          <span className="font-medium">{si.reference}</span>
        </div>
        {si.sent_at && (
          <div>
            <span className="text-muted-foreground">Enviada em:</span>{' '}
            <span className="font-medium">
              {new Date(si.sent_at).toLocaleString('pt-BR')}
            </span>
          </div>
        )}
        {si.incoterm_aprovado && (
          <div>
            <span className="text-muted-foreground">Incoterm:</span>{' '}
            <span className="font-medium">{si.incoterm_aprovado}</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Seguro:</span>{' '}
          <span className="font-medium">{si.incluir_seguro ? 'Incluído' : 'Não incluído'}</span>
        </div>
      </div>

      {variant === 'analyst' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Agente de Origem (preencher após resposta do agente)
          </Label>
          <div className="flex gap-2">
            <Input
              value={agentOrigem}
              onChange={(e) => setAgentOrigem(e.target.value)}
              placeholder="Nome e contato do agente local no exterior"
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveAgentOrigem}
              disabled={saving || !agentOrigem.trim()}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
