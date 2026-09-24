'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * What a client sees when they open the URL of a module their company has not
 * been given yet.
 *
 * SIDEBAR AND HEADER STAY. This is a closed door inside the portal, not a
 * different application: replacing the whole shell would read as a session
 * error, and the client would have nowhere to go but the back button.
 *
 * The copy says what is true and stops there. No date, no "fale com o seu
 * consultor", no plan or price: when a module opens is a decision nobody has
 * taken, and a prototype that invents a promise here is worse than one that
 * says nothing.
 */
export function ModuleNotReleased() {
  return (
    <div className="portal-card mx-auto max-w-xl space-y-4 p-8 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-indigo-100 text-brand-indigo"
      >
        <Lock className="h-6 w-6" />
      </span>
      <h1 className="portal-h2">
        Este módulo ainda não está liberado para a sua empresa.
      </h1>
      <p className="portal-body text-portal-neutral">
        Ele volta a aparecer no menu assim que for liberado.
      </p>
      <div className="flex justify-center">
        <Button asChild>
          <Link href="/portal/home">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
