'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from '@/components/ui';
import { cn } from '@/lib/utils';

import {
  MAX_PORTAL_HOME_THEMES,
  PORTAL_HOME_CARD_DESCRIPTIONS,
  PORTAL_HOME_CARD_LABELS,
  PORTAL_HOME_LAYOUT_CARDS,
  PORTAL_HOME_THEMES,
  PORTAL_HOME_THEME_LABELS,
  reconcileEnabledCards,
  type PortalHomeCard,
  type PortalHomeTheme,
} from '../lib/home-layout';

/**
 * "Personalizar": os temas em cima, um switch por card embaixo.
 *
 * DUAS DECISOES NUM MODAL SO, e nao duas telas, porque uma depende da outra: um
 * card so pode ser ligado se o tema dele estiver escolhido, e separar as duas
 * faria o cliente ligar um switch numa tela para descobrir na outra que ele nao
 * conta.
 *
 * O ESTADO E RASCUNHO ate "Salvar": nada vai para o banco a cada clique. Um
 * autosave aqui piscaria a Home inteira (cards montando e desmontando) enquanto
 * o cliente ainda esta decidindo.
 *
 * Desligar um card NAO desliga o tema, e desligar um tema NAO apaga a escolha
 * dos cards dos outros temas — `reconcileEnabledCards` e quem garante isso, e a
 * regra esta testada em `lib/home-layout.test.ts`.
 */
export function HomeCustomizeDialog({
  open,
  saving,
  themes,
  enabledCards,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  themes: PortalHomeTheme[];
  enabledCards: PortalHomeCard[];
  onOpenChange: (open: boolean) => void;
  onSave: (themes: PortalHomeTheme[], cards: PortalHomeCard[]) => void;
}) {
  const [draftThemes, setDraftThemes] = useState<PortalHomeTheme[]>(themes);
  const [draftCards, setDraftCards] = useState<PortalHomeCard[]>(enabledCards);

  // Reabrir o modal recomeca do que esta SALVO, nao do rascunho abandonado da
  // vez anterior: fechar sem salvar tem de descartar de verdade.
  useEffect(() => {
    if (open) {
      setDraftThemes(themes);
      setDraftCards(enabledCards);
    }
  }, [open, themes, enabledCards]);

  const toggleTheme = (theme: PortalHomeTheme) => {
    const next = draftThemes.includes(theme)
      ? draftThemes.filter((t) => t !== theme)
      : draftThemes.length >= MAX_PORTAL_HOME_THEMES
        ? draftThemes
        : [...draftThemes, theme];
    if (next === draftThemes) return;
    setDraftCards(reconcileEnabledCards(draftThemes, next, draftCards));
    setDraftThemes(next);
  };

  const toggleCard = (card: PortalHomeCard) => {
    setDraftCards((current) =>
      current.includes(card)
        ? current.filter((c) => c !== card)
        : [...current, card],
    );
  };

  const full = draftThemes.length >= MAX_PORTAL_HOME_THEMES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-brand-indigo" />
            Personalizar a Home
          </DialogTitle>
          <DialogDescription>
            Escolha os temas e ligue ou desligue cada card. A Home mostra só os
            cards ligados dos temas escolhidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <p className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
              Temas ({draftThemes.length} de {MAX_PORTAL_HOME_THEMES})
            </p>
            <div className="flex flex-wrap gap-2">
              {PORTAL_HOME_THEMES.map((theme) => {
                const selected = draftThemes.includes(theme);
                const blocked = !selected && full;
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleTheme(theme)}
                    disabled={blocked}
                    aria-pressed={selected}
                    className={cn(
                      'portal-small rounded-full border px-3 py-1.5 font-medium transition-colors',
                      selected
                        ? 'border-brand-indigo-800/30 bg-brand-indigo-100 text-foreground'
                        : 'border-border text-portal-neutral hover:bg-muted/40',
                      blocked && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    {PORTAL_HOME_THEME_LABELS[theme]}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <p className="portal-small font-medium uppercase tracking-wide text-portal-neutral">
              Cards
            </p>
            {draftThemes.length === 0 ? (
              // Sem tema nao ha card a listar, e a frase diz o que fazer em vez
              // de deixar um vazio mudo.
              <p className="portal-small text-portal-neutral">
                Escolha ao menos um tema acima para ver os cards disponíveis.
              </p>
            ) : (
              PORTAL_HOME_THEMES.filter((t) => draftThemes.includes(t)).map(
                (theme) => (
                  <div key={theme} className="space-y-2">
                    <p className="portal-small font-medium text-foreground">
                      {PORTAL_HOME_THEME_LABELS[theme]}
                    </p>
                    {PORTAL_HOME_LAYOUT_CARDS[theme].map((card) => (
                      <label
                        key={card}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
                      >
                        <Switch
                          checked={draftCards.includes(card)}
                          onCheckedChange={() => toggleCard(card)}
                        />
                        <span className="min-w-0 space-y-0.5">
                          <span className="portal-body block text-foreground">
                            {PORTAL_HOME_CARD_LABELS[card]}
                          </span>
                          <span className="portal-small block text-portal-neutral">
                            {PORTAL_HOME_CARD_DESCRIPTIONS[card]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ),
              )
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(draftThemes, draftCards)}
            disabled={draftThemes.length === 0 || saving}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
