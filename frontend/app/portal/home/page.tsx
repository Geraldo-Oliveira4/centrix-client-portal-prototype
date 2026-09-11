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
import { countBySemaforo } from '@/types/portal-shipment';

import { SectionHeading } from '../_shared/page-header';
import { HOME_LAYOUT_CARD_COMPONENTS } from './components/card-registry';
import { HomeBanner } from './components/home-banner';
import { HomeShortcuts } from './components/home-shortcuts';
import { HomeCustomizeDialog } from './components/customize-dialog';
import { HomeOnboardingDialog } from './components/onboarding-dialog';
import {
  cardsForThemes,
  knownThemes,
  layoutRows,
  visibleCards,
  type PortalHomeCard,
  type PortalHomeTheme,
} from './lib/home-layout';

/**
 * Home do Portal do Cliente — a landing pos-login, agora PERSONALIZAVEL.
 *
 * A VIA DE VOLTA: a versao 1b (Home fixa, validada com o Victor Orsi) esta
 * salva ao lado, em `page.tsx.bak-1b`, e o commit imediatamente anterior a esta
 * troca e `ea2b5d30cde74d23e32d43e852218602ce39a1e7`. O `.bak-1b` fica fora do
 * build de proposito: o `include` do tsconfig casa arquivos terminados em .ts e
 * .tsx, e o Next so roteia `page` com essas extensoes — a extensao `.bak-1b` nao
 * casa com nenhum dos dois.
 *
 * O QUE CONTINUA IDENTICO A 1b, e por isso nao foi reescrito: o `HomeBanner` no
 * topo (saudacao, frase dominante, farol) e o `HomeShortcuts` no rodape. Sao os
 * MESMOS componentes, nao copias — as duas pecas que o Orsi validou continuam
 * pixel a pixel onde estavam. O que mudou e o MEIO da tela: o bloco fixo "acao
 * urgente + corte da fila" deu lugar aos cards dos temas que o cliente escolheu.
 *
 * SEM ENDPOINT DE DADO NOVO. Os cards leem `/portal/quotations` e
 * `/portal/shipments`, as duas chaves SWR que o resto do portal ja usa, buscadas
 * UMA vez aqui e passadas a todos por `HomeCardProps`. O unico endpoint proprio
 * e o do LAYOUT, que guarda escolha, nao dado de negocio.
 *
 * ONBOARDING NA PRIMEIRA VISITA. Sem linha na tabela, o modal abre e nao fecha
 * sem escolha — nao ha tela atras dele para onde voltar.
 */
export default function PortalHomePage() {
  const { shipments, isLoading: loadingShipments, isError: shipmentsError } =
    useMyShipments();
  const { data: quotations, isLoading: loadingQuotations, isError: quotationsError } =
    useMyQuotations();
  const { layout, isLoading: loadingLayout, isError: layoutError, mutate } =
    useMyHomeLayout();

  const [saving, setSaving] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // UMA leitura de relogio por render, compartilhada pela saudacao do banner e
  // pelos prazos dos cards. Duas chamadas a `new Date()` podem cair em dias
  // diferentes na virada da meia-noite, e ai "Expira hoje" discordaria do prazo
  // que a fila ordenou. Mesma disciplina da 1b e do detalhe do embarque.
  const now = useMemo(() => new Date(), []);

  // `knownThemes` filtra vocabulario obsoleto (os temas ja se chamaram
  // `alertas`/`mapa_mundi`/`inteligencia`). Uma linha so com nomes antigos vira
  // zero temas reconhecidos e reabre o onboarding, em vez de virar uma Home
  // vazia sem saida — ver a docstring da funcao.
  const themes = useMemo(
    () => knownThemes(layout?.themes ?? []),
    [layout],
  );
  const enabledCards = useMemo<PortalHomeCard[]>(
    () => layout?.enabled_cards ?? [],
    [layout],
  );

  const cards = useMemo(
    () => visibleCards(themes, enabledCards),
    [themes, enabledCards],
  );

  // O FAROL do banner. A fonte e a MESMA do "Visao do todo" do Mapa e do card
  // "Situacao dos embarques": `countBySemaforo` sobre os embarques do cliente.
  // Nao ha aritmetica nova nesta tela.
  const counts = useMemo(() => countBySemaforo(shipments), [shipments]);
  const needsAttention = counts.warning + counts.danger;

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
    if (await persist(chosen)) toast.success('Home montada com os seus temas.');
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

  // Sem linha na tabela, ou com uma linha que so tem temas de um vocabulario
  // que esta versao nao conhece mais.
  const needsOnboarding = layout == null || themes.length === 0;

  return (
    <div className="space-y-8">
      {/* TOPO — identico a 1b, mesmo componente e mesma frase. */}
      <HomeBanner
        now={now}
        counts={counts}
        headline={
          // O numero e a frase mudam juntos: sem nada em aberto a tela da a boa
          // noticia em vez de imprimir um "0" grande, que le como painel quebrado.
          needsAttention === 0 ? (
            'Nenhum embarque precisa da sua atenção hoje.'
          ) : (
            <>
              {/* portal-warning (#C98A00), nao o warning-ink: o ink existe para
                  texto sobre fundo CLARO, e aqui o numero esta sobre o navy do
                  banner, onde ele daria 1.9:1. O tom de preenchimento da 5.7:1
                  sobre navy. Regra: o ink e para fundo claro, a fill e para
                  fundo escuro — nao o contrario. */}
              <span className="text-portal-warning">{needsAttention}</span>{' '}
              {needsAttention === 1
                ? 'embarque precisa da sua atenção hoje'
                : 'embarques precisam da sua atenção hoje'}
            </>
          )
        }
      />

      {/* LOGO ABAIXO DO BANNER — as duas afordancias de personalizacao.
          "Refazer do zero" fica SEMPRE VISIVEL e fora do modal: e a saida de
          emergencia de quem se perdeu na propria configuracao, e uma saida de
          emergencia atras de dois cliques nao e saida. Enquanto o onboarding
          nao foi concluido nao ha o que refazer, entao a faixa so aparece
          depois dele. */}
      {needsOnboarding ? null : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => setCustomizeOpen(true)}
          >
            <SlidersHorizontal className="h-5 w-5" />
            Personalizar
          </Button>
          <Button
            variant="ghost"
            className="gap-1.5 text-portal-neutral"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="h-5 w-5" />
            Refazer personalização do zero
          </Button>
        </div>
      )}

      {/* MEIO — os cards dos temas escolhidos, filtrados pelos habilitados.
          `layoutRows` agrupa em fileiras de uma ou duas colunas (e e quem
          impede uma metade orfa de deixar meia tela vazia ao lado); o registro
          e quem resolve card -> componente. Esta tela nunca cita um componente
          pelo nome nem decide largura de card. */}
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
        <div className="space-y-6">
          {layoutRows(cards).map((row) => (
            <div
              key={row.join('+')}
              className={
                row.length === 2
                  ? 'grid grid-cols-1 gap-6 lg:grid-cols-2'
                  : 'grid grid-cols-1 gap-6'
              }
            >
              {row.map((card) => {
                const Card = HOME_LAYOUT_CARD_COMPONENTS[card];
                return (
                  <div key={card} className="min-w-0">
                    <Card
                      shipments={shipments}
                      quotations={quotations}
                      now={now}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* RODAPE — identico a 1b, mesmo componente. */}
      <section className="space-y-3">
        <SectionHeading title="Atalhos" />
        <HomeShortcuts />
      </section>

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
