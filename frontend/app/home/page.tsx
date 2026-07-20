'use client';

import { useState } from 'react';
import { useAuth } from '@arboria-tech/arboria-ui';
import { Search } from 'lucide-react';
import { Button, Input } from '@/components/ui';

export default function HomePage() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date();
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(today);
  const finalDate =
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const userName = session?.user?.name?.split(' ')[0] || 'Usuário';

  return (
    <div className="h-screen flex flex-col animate-in fade-in duration-700 overflow-x-hidden overflow-y-auto">
      <div className="flex-1 py-8 md:py-12">
        <div className="flex items-start justify-between mb-6 md:mb-10 gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-4xl font-light tracking-tight mb-2 truncate">
              Olá, {userName}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground font-light">
              {finalDate}
            </p>
          </div>

          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-9 px-3 md:px-4 text-xs font-medium whitespace-nowrap shrink-0"
          >
            Teste
          </Button>
        </div>

        <div className="mb-6 md:mb-10 flex justify-center">
          <div className="relative w-full max-w-4xl">
            <Search className="absolute left-3 md:left-4 top-1/2 h-4 md:h-5 w-4 md:w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 md:pl-12 h-12 md:h-14 text-sm md:text-base border-0 bg-muted/30 focus-visible:ring-1 focus-visible:ring-offset-0 w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
