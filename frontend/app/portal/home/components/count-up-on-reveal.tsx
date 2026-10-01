'use client';

// Os números dos cards "contam" na revelação da Home (Prompt 5). Wrapper, para
// não editar os cards reaproveitados: anima o TEXTO já renderizado e termina
// exatamente no texto original (`home/lib/count-up.ts`). Sem movimento
// permitido, não faz nada.

import { useEffect, useRef, type ReactNode } from 'react';

import {
  easeOutCubic,
  formatCountable,
  parseCountable,
  type Countable,
} from '../lib/count-up';

const DURATION_MS = 900;

export function CountUpOnReveal({
  active,
  delayMs = 0,
  children,
}: {
  active: boolean;
  delayMs?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets: { node: Text; original: string; c: Countable }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n as Text;
      const c = parseCountable(text.data);
      if (c) targets.push({ node: text, original: text.data, c });
    }
    if (!targets.length) return;

    let frame = 0;
    let start = 0;
    const restore = () => {
      for (const t of targets) {
        if (t.node.isConnected) t.node.data = t.original;
      }
    };
    const tick = (time: number) => {
      if (!start) start = time;
      const k = easeOutCubic((time - start) / DURATION_MS);
      for (const t of targets) {
        if (t.node.isConnected)
          t.node.data = formatCountable(t.c, t.c.value * k);
      }
      if (k < 1) frame = requestAnimationFrame(tick);
      else restore();
    };
    for (const t of targets) t.node.data = formatCountable(t.c, 0);
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      restore();
    };
  }, [active, delayMs]);

  return <div ref={ref}>{children}</div>;
}
