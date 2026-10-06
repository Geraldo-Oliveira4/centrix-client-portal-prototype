'use client';

// Preferências de alertas (07/10/2026): canal, frequência e resumo semanal.
// Item "Configurar alertas" dos Primeiros passos — o passo fecha ao SALVAR.
// Só neste navegador; "Testar notificação" é simulado e marcado "Prévia".

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, Check } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { PagePortalHeader } from '../../_shared/page-header';
import { setDemoValue, useDemoValue } from '../../_shared/demo/use-demo-store';
import { markFirstStep } from '../../_shared/use-first-steps';
import {
  ALERT_CHANNELS,
  ALERT_DELIVERY_STORE_NAME,
  ALERT_FREQUENCIES,
  WEEKDAYS,
  alertDeliverySummary,
  parseAlertDelivery,
  type AlertDelivery,
} from '../lib/alert-delivery';

function Choice({
  selected,
  onClick,
  label,
  hint,
  role,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  role: 'checkbox' | 'radio';
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-11 flex-1 items-start gap-2 rounded-lg border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-brand-indigo-800/40 bg-brand-indigo-100' : 'border-border bg-card hover:bg-muted/40',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border',
          role === 'radio' ? 'rounded-full' : 'rounded',
          selected ? 'border-brand-indigo bg-brand-indigo text-white' : 'border-border',
        )}
      >
        {selected ? <Check className="h-4 w-4" /> : null}
      </span>
      <span>
        <span className="portal-body block font-medium text-foreground">{label}</span>
        <span className="portal-small block text-portal-neutral">{hint}</span>
      </span>
    </button>
  );
}

export default function AlertDeliveryPage() {
  const stored = useDemoValue(ALERT_DELIVERY_STORE_NAME, parseAlertDelivery);
  const [draft, setDraft] = useState<AlertDelivery>(stored);
  useEffect(() => setDraft(stored), [stored]);

  const toggleChannel = (id: AlertDelivery['channels'][number]) => {
    const on = draft.channels.includes(id);
    // Pelo menos um canal: desmarcar o último não tem efeito.
    if (on && draft.channels.length === 1) return;
    setDraft({ ...draft, channels: on ? draft.channels.filter((c) => c !== id) : [...draft.channels, id] });
  };

  const save = () => {
    setDemoValue(ALERT_DELIVERY_STORE_NAME, draft);
    markFirstStep('alertas');
    toast.success('Preferências de alertas salvas.');
  };

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Preferências de alertas"
        subtitle="Como os alertas chegam até você. O que acompanhar fica em Configurações › Alertas."
      />

      <section className="portal-card space-y-4 p-6" aria-labelledby="alertas-canal">
        <h2 id="alertas-canal" className="portal-h3">Canal</h2>
        <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-labelledby="alertas-canal">
          {ALERT_CHANNELS.map((c) => (
            <Choice key={c.id} role="checkbox" selected={draft.channels.includes(c.id)} onClick={() => toggleChannel(c.id)} label={c.label} hint={c.hint} />
          ))}
        </div>
      </section>

      <section className="portal-card space-y-4 p-6" aria-labelledby="alertas-frequencia">
        <h2 id="alertas-frequencia" className="portal-h3">Frequência</h2>
        <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-labelledby="alertas-frequencia">
          {ALERT_FREQUENCIES.map((f) => (
            <Choice key={f.id} role="radio" selected={draft.frequency === f.id} onClick={() => setDraft({ ...draft, frequency: f.id })} label={f.label} hint={f.hint} />
          ))}
        </div>
      </section>

      <section className="portal-card space-y-4 p-6" aria-labelledby="alertas-resumo">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 id="alertas-resumo" className="portal-h3">Resumo semanal</h2>
            <p className="portal-small text-portal-neutral">
              A leitura da semana da sua Inteligência: indicadores com a variação e a conclusão de cada um.
            </p>
          </div>
          <Switch
            checked={draft.weeklySummary}
            onCheckedChange={(on) => setDraft({ ...draft, weeklySummary: on })}
            aria-label="Receber resumo semanal"
          />
        </div>
        {draft.weeklySummary ? (
          <div className="space-y-1.5">
            <Label htmlFor="alertas-dia" className="portal-small">Dia do resumo</Label>
            <select
              id="alertas-dia"
              value={draft.weeklyDay}
              onChange={(e) => setDraft({ ...draft, weeklyDay: e.target.value as AlertDelivery['weeklyDay'] })}
              className="portal-body h-11 w-full max-w-xs rounded-md border border-input bg-background px-3"
            >
              {WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {d[0].toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      <div className="portal-card-muted space-y-4 p-6">
        <p className="portal-body" aria-live="polite">{alertDeliverySummary(draft)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save}>
            Salvar preferências
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => toast.info(`Prévia: notificação de teste simulada. ${alertDeliverySummary(draft)} Nada foi enviado.`)}
          >
            <BellRing className="h-5 w-5" aria-hidden="true" />
            Testar notificação
            <span className="portal-small rounded-full bg-brand-indigo-100 px-1.5 text-brand-indigo">Prévia</span>
          </Button>
          <Link href="/portal/preferencias#alertas" className="portal-small text-brand-indigo underline underline-offset-2">
            Escolher o que acompanhar
          </Link>
        </div>
        <p className="portal-small text-portal-neutral">
          Fica salvo neste navegador. Nesta demonstração nenhum alerta é enviado.
        </p>
      </div>
    </div>
  );
}
