'use client';

// Field-level blocking UI for `ManualForm` — rendered only when the caller
// passes `hardblocks` (today: the portal's Cotação V2). The analyst screen
// passes nothing and none of this renders there.
//
// Generic on purpose: the RULES live in the portal's pure module
// (`app/portal/_shared/demo/quotation-hardblocks.ts`); this file only knows how
// to show "this field blocks the send, and here is why" and how to take the
// client to the field.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Hardblock } from '@/app/portal/_shared/demo/quotation-hardblocks';

export const FIELD_BLOCKS_SUMMARY_ID = 'resumo-pendencias';

/** The DOM id of a field's wrapper, the target of "ir para o campo". */
export function fieldAnchor(field: string): string {
  return `campo-${field}`;
}

const FieldBlocksContext = createContext<Map<string, Hardblock> | null>(null);

export const FieldBlocksProvider = FieldBlocksContext.Provider;

/**
 * Scrolls to a field, focuses its first control and flashes a ring around it.
 *
 * The ring is what makes the jump legible: after a smooth scroll the eye does
 * not know which of the fields now on screen is the one it was sent to.
 */
export function goToField(field: string): void {
  const target = document.getElementById(fieldAnchor(field));
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // The field's own control, in this order: a text box, then a select or
  // combobox trigger. Never the hidden checkbox behind a Switch (the "Deixar
  // que agentes decidam" toggles sit BEFORE the input they govern).
  const selectors = [
    'input:not([disabled]):not([type=checkbox]):not([aria-hidden=true])',
    'textarea:not([disabled])',
    'button[role=combobox]:not([disabled])',
    'button:not([disabled])',
  ];
  for (const selector of selectors) {
    const control = target.querySelector<HTMLElement>(selector);
    if (control) {
      control.focus({ preventScroll: true });
      break;
    }
  }
  target.classList.add('ring-2', 'ring-portal-warning', 'rounded-md');
  window.setTimeout(
    () =>
      target.classList.remove('ring-2', 'ring-portal-warning', 'rounded-md'),
    1600,
  );
}

/**
 * The reason a field blocks the send, under the field.
 *
 * Neutral text with an amber dot, not amber text: on a blank form a dozen
 * fields are pending at once, and a dozen warnings in a row read as an error
 * the client made rather than a checklist they have not finished.
 */
export function FieldBlockHint({ field }: { field: string }) {
  const blocks = useContext(FieldBlocksContext);
  const block = blocks?.get(field);
  if (!block) return null;
  return (
    <p className="portal-small flex items-start gap-1.5 text-portal-neutral">
      <span
        aria-hidden="true"
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-portal-warning"
      />
      <span>
        <span className="sr-only">Necessário para enviar: </span>
        {block.reason}
      </span>
    </p>
  );
}

/**
 * "Faltam N itens" at the top of the form: the count and one link per item.
 *
 * Labels only, as chips — the reasons are already under each field, and a
 * dozen full sentences here would push the form itself below the fold.
 */
export function FieldBlocksSummary({
  blocks,
  countLabel,
  readyLabel,
}: {
  blocks: Hardblock[];
  countLabel: string;
  readyLabel: string;
}) {
  if (blocks.length === 0) {
    return (
      <div
        id={FIELD_BLOCKS_SUMMARY_ID}
        role="status"
        className="flex items-center gap-2 rounded-lg border border-portal-success/40 bg-portal-success/10 px-4 py-3"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-portal-success" />
        <p className="portal-body font-medium text-portal-success">
          {readyLabel}
        </p>
      </div>
    );
  }
  return (
    <section
      id={FIELD_BLOCKS_SUMMARY_ID}
      aria-labelledby={`${FIELD_BLOCKS_SUMMARY_ID}-title`}
      className="rounded-lg border border-portal-warning/40 bg-portal-warning/10 px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-portal-warning-ink" />
        <div className="min-w-0 space-y-2">
          <p
            id={`${FIELD_BLOCKS_SUMMARY_ID}-title`}
            className="portal-body font-medium text-portal-warning-ink"
            aria-live="polite"
          >
            {countLabel} para enviar à Freitas
          </p>
          <p className="portal-small text-foreground/80">
            O envio libera quando todos estiverem preenchidos. Clique num item
            para ir ao campo; o motivo está embaixo de cada um.
          </p>
          <ul className="flex flex-wrap gap-2">
            {blocks.map((block) => (
              <li key={block.item}>
                <a
                  href={`#${fieldAnchor(block.field)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    goToField(block.field);
                  }}
                  className="portal-small inline-flex items-center rounded-full border border-portal-warning/50 bg-card px-2.5 py-1 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {block.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * A field that appears or disappears with the incoterm or the cargo type,
 * WITHOUT a layout jump: the height animates through `grid-template-rows`
 * (0fr <-> 1fr) instead of the block popping in.
 *
 * The content stays mounted and is made `inert` while closed, so a hidden
 * input is neither tabbable nor read by a screen reader. `closedOffset` cancels
 * the parent's gap for the zero-height row (e.g. `-mt-3` inside a `gap-3`
 * grid); without it closing the field would still leave a 12px step behind.
 */
export function FieldCollapse({
  open,
  className,
  closedOffset,
  children,
}: {
  open: boolean;
  className?: string;
  closedOffset?: string;
  children: React.ReactNode;
}) {
  const inner = useRef<HTMLDivElement>(null);
  // Clipping is needed only while the height animates; once open, a clipped
  // box would cut the 3px focus ring of the inputs inside it.
  const [clip, setClip] = useState(!open);
  useEffect(() => {
    inner.current?.toggleAttribute('inert', !open);
    if (!open) {
      setClip(true);
      return;
    }
    // A timer, not `transitionend`: with reduced motion there is no transition
    // and the event never fires.
    const timer = window.setTimeout(() => setClip(false), 220);
    return () => window.clearTimeout(timer);
  }, [open]);
  return (
    <div
      aria-hidden={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none',
        open
          ? 'grid-rows-[1fr] opacity-100'
          : cn('grid-rows-[0fr] opacity-0', closedOffset),
        className,
      )}
    >
      <div ref={inner} className={cn('min-h-0', clip && 'overflow-hidden')}>
        {children}
      </div>
    </div>
  );
}

/** The reason next to a disabled submit: "Faltam 3 itens · ver lista". */
export function SubmitBlockedNote({ countLabel }: { countLabel: string }) {
  return (
    <p className="portal-small text-portal-neutral">
      {countLabel} ·{' '}
      <a
        href={`#${FIELD_BLOCKS_SUMMARY_ID}`}
        onClick={(event) => {
          event.preventDefault();
          document
            .getElementById(FIELD_BLOCKS_SUMMARY_ID)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        className="font-medium text-brand-indigo underline underline-offset-4"
      >
        ver lista
      </a>
    </p>
  );
}
