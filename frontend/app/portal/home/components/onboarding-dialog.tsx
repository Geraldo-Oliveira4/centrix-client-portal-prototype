'use client';

import { useEffect, useState } from 'react';
import { Check, LayoutGrid } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import { cn } from '@/lib/utils';

import {
  MAX_PORTAL_HOME_THEMES,
  PORTAL_HOME_LAYOUT_CARDS,
  PORTAL_HOME_THEMES,
  PORTAL_HOME_THEME_DESCRIPTIONS,
  PORTAL_HOME_THEME_LABELS,
  PORTAL_HOME_THEME_QUESTIONS,
  PORTAL_HOME_CARD_LABELS,
  type PortalHomeTheme,
} from '../lib/home-layout';

/**
 * Onboarding: escolha ate tres temas.
 *
 * NAO E DESCARTAVEL — sem `onOpenChange`, sem X, sem fechar no Esc ou no clique
 * fora. A tela atras dele nao existe ate haver escolha (a Home personalizada E
 * os temas), entao um modal fechavel deixaria o cliente num vazio sem caminho de
 * volta. O caminho de saida e escolher, ou a sidebar.
 *
 * O teto de tres e do PRODUTO, nao do numero de temas: com tres temas hoje,
 * "ate tres" nao restringe nada, e mesmo assim o contador fica visivel — e ele
 * que ensina a regra antes de o quarto tema existir.
 */
export function HomeOnboardingDialog({
  open,
  saving,
  onConfirm,
}: {
  open: boolean;
  saving: boolean;
  onConfirm: (themes: PortalHomeTheme[]) => void;
}) {
  const [chosen, setChosen] = useState<PortalHomeTheme[]>([]);

  // "Refazer personalizacao do zero" nao desmonta este componente — ele so volta
  // a `open`. Sem esta limpeza o modal reabriria com os temas da vez anterior ja
  // marcados, que e exatamente o oposto do que o botao promete.
  useEffect(() => {
    if (open) setChosen([]);
  }, [open]);

  const toggle = (theme: PortalHomeTheme) => {
    setChosen((current) =>
      current.includes(theme)
        ? current.filter((t) => t !== theme)
        : current.length >= MAX_PORTAL_HOME_THEMES
          ? current
          : [...current, theme],
    );
  };

  const full = chosen.length >= MAX_PORTAL_HOME_THEMES;

  return (
    <Dialog open={open}>
      {/* Nao-descartavel: sem X (o Close do `DialogContent` e filho DIRETO dele,
          e so ele e atingido por `[&>button]`), sem Esc e sem clique fora. Nao
          ha tela atras deste modal ate haver uma escolha; fecha-lo deixaria o
          cliente num vazio sem caminho de volta. Nada e alterado em
          `components/ui/dialog.tsx`, que e compartilhado com o portal inteiro. */}
      <DialogContent
        size="lg"
        className="[&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-brand-indigo" />
            Monte a sua Home
          </DialogTitle>
          <DialogDescription>
            Escolha de 1 a {MAX_PORTAL_HOME_THEMES} temas. A sua Home passa a mostrar
            só o que pertence a eles — e você pode refazer esta escolha quando
            quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {PORTAL_HOME_THEMES.map((theme) => {
            const selected = chosen.includes(theme);
            // Um tema nao escolhido fica desabilitado quando o teto foi
            // atingido; o JA escolhido nunca, senao nao daria para trocar.
            const blocked = !selected && full;
            return (
              <button
                key={theme}
                type="button"
                onClick={() => toggle(theme)}
                disabled={blocked}
                aria-pressed={selected}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                  selected
                    ? 'border-brand-indigo-800/30 bg-brand-indigo-100'
                    : 'border-border hover:bg-muted/40',
                  blocked && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    selected
                      ? 'border-brand-indigo bg-brand-indigo text-white'
                      : 'border-border',
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="portal-body block font-medium text-foreground">
                    {PORTAL_HOME_THEME_LABELS[theme]}
                    {/* A pergunta e o que faz o rotulo de uma palavra significar
                        alguma coisa na primeira visita: "Custos" sozinho nao diz
                        se a tela mostra gasto, economia ou cotacao. */}
                    <span className="font-normal text-portal-neutral">
                      {' '}
                      — {PORTAL_HOME_THEME_QUESTIONS[theme]}
                    </span>
                  </span>
                  <span className="portal-small block text-portal-neutral">
                    {PORTAL_HOME_THEME_DESCRIPTIONS[theme]}
                  </span>
                  {/* O tema e abstrato; o card e o que aparece na tela. Dizer
                      quais cards vem junto e o que impede a escolha de ser um
                      chute. */}
                  <span className="portal-small block text-portal-neutral">
                    Cards:{' '}
                    {PORTAL_HOME_LAYOUT_CARDS[theme]
                      .map((card) => PORTAL_HOME_CARD_LABELS[card])
                      .join(' · ')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="items-center justify-between gap-3 sm:justify-between">
          <span className="portal-small text-portal-neutral">
            {chosen.length} de {MAX_PORTAL_HOME_THEMES} escolhidos
          </span>
          <Button
            onClick={() => onConfirm(chosen)}
            disabled={chosen.length === 0 || saving}
          >
            {saving ? 'Salvando…' : 'Montar minha Home'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
