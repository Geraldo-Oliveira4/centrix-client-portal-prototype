'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Info, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'react-toastify';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';

import {
  Button,
  Input,
  Label,
  MultiCombobox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { Switch } from '@/components/ui/switch';
import {
  useMyAgents,
  useMyPreferences,
  updateMyPreferences,
} from '@/hooks/use-portal-agents';

import { useAlertTypePreferences } from '../_shared/alert-type-preferences';
import { PagePortalHeader, SectionHeading } from '../_shared/page-header';
import { ProvenanceBadge } from '../_shared/provenance-badge';
import {
  ALERT_TYPE_LABELS,
  ALL_ALERT_TYPES,
} from '../embarques/lib/shipment-alerts';
import { INCOTERM_OPTIONS, PORT_OPTIONS } from './lib/operation-options';

/**
 * Minhas Preferências — configuração de conta, em dois blocos com estatutos
 * DIFERENTES, e a tela precisa deixar isso visível.
 *
 * NOTIFICAÇÕES (real, sem selo): são as mesmas quatro chaves de Meus Embarques >
 * Alertas, lidas do módulo compartilhado. Ficam em localStorage porque o feed de
 * alertas é montado no frontend e não há disparo de e-mail/push por trás — ver
 * `_shared/alert-type-preferences.ts`.
 *
 * PERFIL DE OPERAÇÃO / DNA (selo "Pré-visualização" no bloco inteiro): as
 * escolhas SÃO gravadas (tabela `centrix_portal_client_preferences`, migração
 * 094), mas ainda não realimentam a montagem da cotação — o DNA que a Freitas
 * usa hoje vive fora do portal. O selo aqui é a única vez no portal em que
 * `preview` não marca um número fabricado: marca um bloco funcional cujo efeito
 * a jusante ainda não existe. O texto do bloco diz exatamente isso, e é ele que
 * sustenta o selo — não apague.
 *
 * FORA DESTE BLOCO POR DECISÃO DE ESCOPO: contatos internos da Freitas, acordos
 * comerciais e restrições contratuais. São dados operacionais internos, seguem
 * exclusivos do lado da Freitas, e o backend nem aceita esses campos.
 *
 * A ÚNICA EXCEÇÃO dentro do bloco é "Agentes bloqueados": é a MESMA lista do
 * toggle de Meus Agentes (uma coluna só, ver migração 094), e essa lista já tem
 * efeito real na RFQ. Por isso ela leva selo próprio de dado real — um bloco
 * "Pré-visualização" não pode fazer o cliente achar que bloquear agente aqui é
 * ensaio.
 */
export default function PortalPreferenciasPage() {
  const { enabledTypes, toggleType } = useAlertTypePreferences();
  const { preferences, isLoading, isError } = useMyPreferences();
  const { agents } = useMyAgents();

  const [port, setPort] = useState('');
  const [incoterm, setIncoterm] = useState('');
  const [insurance, setInsurance] = useState(false);
  const [particularities, setParticularities] = useState('');
  const [blocked, setBlocked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Semeia o formulário quando o servidor responde. `preferences` é a
  // identidade de referência do SWR, então isto roda de novo só quando a
  // resposta muda de verdade — não a cada render.
  useEffect(() => {
    if (!preferences) return;
    setPort(preferences.preferred_port ?? '');
    setIncoterm(preferences.default_incoterm ?? '');
    setInsurance(preferences.uses_insurance ?? false);
    setParticularities(preferences.cargo_particularities ?? '');
    setBlocked(preferences.paused_agent_ids);
  }, [preferences]);

  if (isLoading) return <LoaderComponent />;
  if (isError) return <ErrorComponent />;

  const handleSave = async () => {
    setSaving(true);
    const result = await updateMyPreferences({
      preferred_port: port || null,
      default_incoterm: incoterm || null,
      uses_insurance: insurance,
      cargo_particularities: particularities || null,
      paused_agent_ids: blocked,
    });
    setSaving(false);
    if (result) toast.success('Preferências salvas.');
  };

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Minhas Preferências"
        subtitle="Como você quer ser avisado e como sua operação costuma funcionar."
      />

      {/* Bloco 1 — Notificações. Real: é a mesma preferência da aba Alertas. */}
      <section className="portal-card space-y-4 p-6">
        <SectionHeading
          title="Notificações"
          icon={<Bell className="h-5 w-5" />}
          hint="mesmas opções da aba Alertas"
        />
        <p className="portal-body max-w-3xl text-portal-neutral">
          Escolha o que aparece no seu feed de alertas. É a mesma configuração de{' '}
          <Link
            href="/portal/embarques?tab=alertas"
            className="font-medium text-brand-indigo hover:underline"
          >
            Meus Embarques · Alertas
          </Link>
          : mudar aqui muda lá.
        </p>
        <div className="flex flex-col gap-3 border-t border-dashed pt-4 sm:flex-row sm:flex-wrap sm:gap-6">
          {ALL_ALERT_TYPES.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 portal-body text-foreground"
            >
              <Switch
                checked={enabledTypes.has(type)}
                onCheckedChange={() => toggleType(type)}
              />
              {ALERT_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </section>

      {/* Bloco 2 — Perfil de operação (DNA). Moldura tracejada + selo no bloco
          inteiro: as escolhas ficam salvas, mas ainda não realimentam a cotação. */}
      <section className="space-y-4 rounded-xl border border-dashed border-brand-indigo-800/40 bg-brand-indigo-100 p-6">
        <SectionHeading
          title="Perfil de operação"
          icon={<SlidersHorizontal className="h-5 w-5" />}
          hint="seu DNA de importação"
          action={<ProvenanceBadge provenance="preview" />}
        />
        <p className="portal-body max-w-3xl text-portal-neutral">
          Suas escolhas aqui ficam salvas, mas ainda não preenchem sozinhas as
          próximas cotações: o perfil que a Freitas usa hoje é mantido fora do
          portal. Esta tela é a versão do perfil que passa a ser sua para editar
          — quando a mudança for concluída, o que muda é o efeito, não os campos.
        </p>

        <div className="grid gap-4 border-t border-dashed pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pref-port">Porto / aeroporto preferido</Label>
            <Select value={port} onValueChange={setPort}>
              <SelectTrigger id="pref-port">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {PORT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pref-incoterm">Incoterm padrão</Label>
            <Select value={incoterm} onValueChange={setIncoterm}>
              <SelectTrigger id="pref-incoterm">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {INCOTERM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-3 portal-body text-foreground">
              <Switch checked={insurance} onCheckedChange={setInsurance} />
              Costumo contratar seguro de carga
            </label>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pref-particularities">
              Particularidades de carga
            </Label>
            <Textarea
              id="pref-particularities"
              value={particularities}
              onChange={(e) => setParticularities(e.target.value)}
              placeholder="Carga perigosa, temperatura controlada, exigência de OEA, restrição de porto..."
              rows={3}
            />
            <p className="portal-small text-portal-neutral">
              Texto livre — o que a Freitas precisa saber antes de cotar.
            </p>
          </div>

          {/* Mesma lista do toggle de Meus Agentes. Tem efeito real, por isso
              carrega selo próprio dentro de um bloco `preview`. */}
          <div className="space-y-2 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="pref-blocked">Agentes bloqueados</Label>
              <ProvenanceBadge provenance="real" />
            </div>
            <MultiCombobox
              value={blocked}
              onValueChange={setBlocked}
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="Nenhum agente bloqueado"
              searchPlaceholder="Buscar agente..."
              emptyText="Nenhum agente disponível na sua conta."
            />
            <p className="inline-flex items-start gap-1.5 portal-small text-portal-neutral">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Esta é a mesma lista do toggle de{' '}
              <Link
                href="/portal/preferencias/agentes"
                className="font-medium text-brand-indigo hover:underline"
              >
                Meus Agentes
              </Link>
              : bloquear aqui é pausar lá. Vale já para as próximas cotações.
            </p>
          </div>
        </div>

        {/* Só o Salvar. Havia um "Ir para Meus Agentes" ao lado dele, de quando
            Meus Agentes era item da sidebar; com a tela virando aba desta mesma
            Preferências (26/08/2026) ele passou a mandar o cliente para um lugar
            visível a dois centímetros dali, e saiu. `justify-end` mantém o
            Salvar na borda direita, onde ele já renderizava. */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-dashed pt-4">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar preferências'}
          </Button>
        </div>
      </section>
    </div>
  );
}
