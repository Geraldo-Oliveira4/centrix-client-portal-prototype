'use client';

// The demonstration panel: the Freitas side of a portal that only has a client
// side.
//
// IT IS LABELLED AS A SIMULATION, in the tab and in the title. Everything it
// controls is a stage prop — release waves that exist only in this browser, and
// an analyst who does not exist at all. The screens it affects gain no badge of
// their own: since 12/08/2026 the prototype shows rich illustrative data
// without marking real x illustrative on the client's screens, and a portal
// that started apologising for itself again would undo that decision. The
// honesty lives here, where the controls are.
//
// A SHEET AND NOT A MODAL, against the portal's usual rule that details are
// modals: this is neither an entity nor a detail. The controls are a list that
// later prompts keep appending to, which wants a tall narrow column rather than
// a centred box — and closing the drawer leaves the tab, so the screen behind it
// comes back in one click without the panel having to be summoned again.

import { useState } from 'react';
import { Beaker } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { DEMO_SECTIONS } from './demo-sections';
import { useDemoPanel } from './use-demo-panel';

/**
 * Mounted once, by the portal layout. Renders nothing at all — not even the
 * tab — until someone asks for it with `?demo=1` or Ctrl+Shift+D.
 *
 * Two states, deliberately separate: `enabled` is whether this browser is
 * running a demonstration, `open` is whether the drawer is showing. Closing the
 * drawer leaves the tab; Ctrl+Shift+D takes the whole thing away.
 */
export function DemoPanel() {
  const { enabled } = useDemoPanel();
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* The tab. Bottom-RIGHT since 30/09/2026: bottom-left is now the client's
          Ajuda button, and this is a presenter tool. Under the mobile drawer's z-index so it can
          never sit on top of the menu, and quiet enough not to compete with the
          screen it exists to demonstrate. */}
      <SheetTrigger asChild>
        <button
          type="button"
          className="portal-small fixed bottom-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-medium text-portal-neutral shadow-sm transition-colors hover:border-brand-indigo-800/40 hover:text-brand-indigo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Beaker className="h-4 w-4 shrink-0" />
          Demonstração
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="flex w-[21rem] max-w-[90vw] flex-col gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="shrink-0 pr-8 text-left">
          <SheetTitle className="portal-h3">
            Painel de demonstração · simulação da Freitas
          </SheetTitle>
          <SheetDescription className="portal-small">
            Controles de quem apresenta. Valem só neste navegador e não mudam
            nada do lado do cliente.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {DEMO_SECTIONS.map(({ id, title, description, Content }) => (
            <section key={id} className="space-y-3">
              <div className="space-y-0.5">
                <h3 className="portal-body font-medium text-brand-indigo">
                  {title}
                </h3>
                {description ? (
                  <p className="portal-small text-portal-neutral">
                    {description}
                  </p>
                ) : null}
              </div>
              <Content />
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
