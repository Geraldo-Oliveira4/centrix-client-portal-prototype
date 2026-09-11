'use client';

import { useMemo, useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import {
  resetMyHomeLayout,
  saveMyHomeLayout,
  useMyHomeLayout,
} from '@/hooks/use-portal-home-layout';

import { PagePortalHeader } from '../_shared/page-header';
import { ProvenanceBadge } from '../_shared/provenance-badge';
import { HOME_LAYOUT_CARD_COMPONENTS } from './components/card-registry';
import { HomeCustomizeDialog } from './components/customize-dialog';
import { HomeOnboardingDialog } from './components/onboarding-dialog';
import {
  PORTAL_HOME_THEME_LABELS,
  cardsForThemes,
  visibleCards,
  type PortalHomeCard,
  type PortalHomeTheme,
} from './lib/home-layout';

/**
 * EXPERIMENTO INTERNO — Home personalizavel.
 *
 * >>> ESTA NAO E A HOME DO CLIENTE. <<<
 *
 * A Home validada pelo Victor Orsi e `/portal/home`, e ela nao foi tocada: nao
 * importa nada deste diretorio e nao sabe que ele existe. Se esta frente for
 * descartada, o "voltar ao normal" e apagar
 * `app/portal/home-personalizada/`, `hooks/use-portal-home-layout.ts`,
 * `types/portal-home-layout.ts`, `backend/app/home_layout_experiment.py` e a
 * migracao 095 — nenhuma tela em uso muda.
 *
 * A rota tambem NAO entra na sidebar: quem a conhece chega pela URL. Uma
 * segunda "Home" no menu faria o cliente escolher entre duas, e a escolha nao e
 * dele — e nossa, e ainda nao foi feita.
 *
 * SEM ENDPOINT DE DADO NOVO. Os cards leem `/portal/quotations` e
 * `/portal/shipments`, as mesmas duas chaves SWR do resto do portal, buscadas
 * UMA vez aqui e passadas para todos. O unico endpoint novo e o do LAYOUT
 * (`/portal/home-layout-experiment`), que guarda escolha, nao dado de negocio.
 */
export default function PortalHomePersonalizadaPage() {
  const { shipments, isLoading: loadingShipments, isError: shipmentsError } =
    useMyShipments();
  const { data: quotations, isLoading: loadingQuotations, isError: quotationsError } =
    useMyQuotations();
  const { layout, isLoading: loadingLayout, isError: layoutError, mutate } =
    useMyHomeLayout();

  const [saving, setSaving] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // UMA leitura de relogio por render, compartilhada por todos os cards. Duas
  // chamadas a `new Date()` podem cair em dias diferentes na virada da
  // meia-noite, e ai dois cards dariam prazos diferentes — mesma disciplina da
  // Home real e do detalhe do embarque.
  const now = useMemo(() => new Date(), []);

  const themes = layout?.themes ?? [];
  const enabledCards = layout?.enabled_cards ?? [];

  // Os cards que a tela desenha: habilitados E de um tema escolhido. Ver
  // `visibleCards` para por que o segundo filtro existe.
  const cards = useMemo(
    () => visibleCards(themes, enabledCards),
    [themes, enabledCards],
  );

  const persist = async (
    nextThemes: PortalHomeTheme[],
    nextCards?: PortalHomeCard[],
  ) => {
    setSaving(true);
    const saved = await saveMyHomeLayout(
      { themes: nextThemes, enabled_cards: nextCards },
      (data) => mutate(data, { revalidate: false }),
    );
    setSaving(false);
    return saved != null;
  };

  const handleOnboarding = async (chosen: PortalHomeTheme[]) => {
    // Sem `enabled_cards`: o backend liga todos os cards dos temas escolhidos,
    // que e o que "acabei de escolher estes temas" quer dizer. Mandar a lista
    // daqui duplicaria a regra nas duas pontas.
    if (await persist(chosen)) {
      toast.success('Home montada com os seus temas.');
    }
  };

  const handleCustomize = async (
    nextThemes: PortalHomeTheme[],
    nextCards: PortalHomeCard[],
  ) => {
    if (await persist(nextThemes, nextCards)) {
      setCustomizeOpen(false);
      toast.success('Personalização salva.');
    }
  };

  const handleReset = async () => {
    setSaving(true);
    const ok = await resetMyHomeLayout((data) =>
      mutate(data, { revalidate: false }),
    );
    setSaving(false);
    if (ok) toast.success('Personalização apagada. Escolha os temas de novo.');
  };

  if (loadingShipments || loadingQuotations || loadingLayout) {
    return <LoaderComponent />;
  }
  if (shipmentsError || quotationsError || layoutError) return <ErrorComponent />;

  // `layout === null` = carregou e o cliente nunca escolheu. So isso abre o
  // onboarding; `undefined` (ainda carregando) ja foi tratado acima.
  const needsOnboarding = layout == null;

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Home personalizada"
        subtitle={
          needsOnboarding
            ? 'Escolha os seus temas para montar a tela.'
            : `Temas: ${themes
                .map((t) => PORTAL_HOME_THEME_LABELS[t])
                .join(' · ')}`
        }
        action={
          needsOnboarding ? null : (
            <>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setCustomizeOpen(true)}
              >
                <SlidersHorizontal className="h-5 w-5" />
                Personalizar
              </Button>
              {/* VISIVEL E NO TOPO, nao escondido dentro do modal de
                  personalizar: "refazer do zero" e a saida de emergencia de quem
                  se perdeu na propria configuracao, e uma saida de emergencia
                  atras de dois cliques nao e saida. Apaga a linha no banco e
                  reabre o onboarding. */}
              <Button
                variant="ghost"
                className="gap-1.5 text-portal-neutral"
                onClick={handleReset}
                disabled={saving}
              >
                <RotateCcw className="h-5 w-5" />
                Refazer personalização do zero
              </Button>
            </>
          )
        }
      />

      {/* A moldura de experimento fica na TELA, nao so no codigo: quem abrir
          esta rota numa demonstracao precisa saber que ela nao e a Home. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
        <ProvenanceBadge provenance="preview" />
        <p className="portal-small text-portal-neutral">
          Rota de teste interna. A Home do cliente continua em{' '}
          <span className="font-medium text-foreground">/portal/home</span> e não
          é afetada por nada desta tela.
        </p>
      </div>

      {needsOnboarding ? null : cards.length === 0 ? (
        // Temas escolhidos e todos os cards desligados. Nao e o mesmo estado de
        // "nunca onboardou" e nao pode reabrir o onboarding: foi uma escolha, e
        // a tela devolve os dois caminhos de volta que ela tem.
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="portal-body font-medium text-foreground">
            Todos os cards estão desligados.
          </p>
          <p className="portal-small text-portal-neutral">
            Ligue um card em “Personalizar”, ou refaça a personalização do zero.
            Os seus temas ({cardsForThemes(themes).length} cards disponíveis)
            continuam salvos.
          </p>
        </div>
      ) : (
        // Uma coluna, na ordem dos temas. O registro e quem resolve card ->
        // componente; esta tela nunca cita um componente pelo nome.
        <div className="space-y-8">
          {cards.map((card) => {
            const Card = HOME_LAYOUT_CARD_COMPONENTS[card];
            return (
              <Card
                key={card}
                shipments={shipments}
                quotations={quotations}
                now={now}
              />
            );
          })}
        </div>
      )}

      <HomeOnboardingDialog
        open={needsOnboarding}
        saving={saving}
        onConfirm={handleOnboarding}
      />

      <HomeCustomizeDialog
        open={customizeOpen}
        saving={saving}
        themes={themes}
        enabledCards={enabledCards}
        onOpenChange={setCustomizeOpen}
        onSave={handleCustomize}
      />
    </div>
  );
}
