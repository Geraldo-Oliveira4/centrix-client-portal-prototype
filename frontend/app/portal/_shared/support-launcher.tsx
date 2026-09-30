'use client';

// Ajuda e suporte (30/09/2026, feedback de marketing: "falta chat de suporte
// e report de bug"). SÓ VISUAL: o chat responde uma frase ilustrativa e o
// relato gera um protocolo local. Nada sai deste navegador, e as duas telas
// dizem isso.
//
// POSIÇÃO: canto inferior ESQUERDO, colado à direita da sidebar (o rodapé da
// sidebar é Configurações e não pode ficar coberto) e acompanhando o estado
// recolhido. A aba "Demonstração", que morava no mesmo canto, foi para o
// inferior direito: é ferramenta de quem apresenta, e em cantos opostos as duas
// nunca se sobrepõem.

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, LifeBuoy, Paperclip, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { useSidebar } from '../components/sidebar-context';
import { setDemoValue, useDemoValue } from './demo/use-demo-store';
import {
  SUPPORT_GREETING,
  SUPPORT_REPLY,
  SUPPORT_SEQUENCE_STORE_NAME,
  parseSequence,
  protocolFor,
  reportIssue,
  screenName,
} from './support-model';

interface ChatMessage {
  id: number;
  from: 'suporte' | 'voce';
  text: string;
}

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, from: 'suporte', text: SUPPORT_GREETING },
  ]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages, typing]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: prev.length, from: 'voce', text }]);
    setDraft('');
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: prev.length, from: 'suporte', text: SUPPORT_REPLY },
      ]);
    }, 900);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3"
        role="log"
        aria-live="polite"
        aria-label="Conversa com o suporte"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'portal-body max-w-[85%] rounded-lg px-3 py-2',
              message.from === 'voce'
                ? 'ml-auto bg-brand-indigo text-white dark:bg-brand-indigo-700'
                : 'bg-card text-foreground shadow-sm',
            )}
          >
            <span className="sr-only">
              {message.from === 'voce' ? 'Você: ' : 'Suporte: '}
            </span>
            {message.text}
          </div>
        ))}
        {typing && (
          <p className="portal-small text-portal-neutral">Suporte digitando…</p>
        )}
        <div ref={end} />
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="suporte-mensagem" className="sr-only">
            Sua mensagem
          </Label>
          <Input
            id="suporte-mensagem"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva sua dúvida"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={!draft.trim()} className="h-11 shrink-0 gap-1.5">
          <Send className="h-5 w-5" /> Enviar
        </Button>
      </form>
    </div>
  );
}

function Report({ onDone }: { onDone: () => void }) {
  const pathname = usePathname() ?? '';
  const sequence = useDemoValue(SUPPORT_SEQUENCE_STORE_NAME, parseSequence);
  const [description, setDescription] = useState('');
  const [screen, setScreen] = useState(() => screenName(pathname));
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const issue = reportIssue(description);

  if (protocol) {
    return (
      <div role="status" className="space-y-4 rounded-lg border border-portal-success/40 bg-portal-success/10 p-4">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-portal-success-ink" />
          <div className="space-y-1">
            <p className="portal-body font-medium text-foreground">
              Recebemos. Protocolo {protocol}
            </p>
            <p className="portal-small text-portal-neutral">
              Guarde o número para acompanhar. Demonstração: o relato fica só
              neste navegador e ninguém é notificado.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setProtocol(null);
              setDescription('');
              setFile(null);
              setTouched(false);
            }}
          >
            Reportar outro problema
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (issue) return;
        const next = sequence + 1;
        setDemoValue(SUPPORT_SEQUENCE_STORE_NAME, next);
        setProtocol(protocolFor(next, new Date().getFullYear()));
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="relato-descricao">O que aconteceu?</Label>
        <Textarea
          id="relato-descricao"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Ex.: cliquei em Enviar para a Freitas e nada aconteceu."
          aria-describedby="relato-descricao-ajuda"
          aria-invalid={touched && !!issue}
        />
        <p
          id="relato-descricao-ajuda"
          className={cn(
            'portal-small',
            touched && issue ? 'text-portal-danger-ink' : 'text-portal-neutral',
          )}
        >
          {issue ?? 'O que você fez e o que apareceu ajudam a achar o problema mais rápido.'}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="relato-tela">Tela</Label>
        <Input
          id="relato-tela"
          value={screen}
          onChange={(event) => setScreen(event.target.value)}
        />
        <p className="portal-small text-portal-neutral">
          Preenchida com a tela em que você está. Corrija se foi em outra.
        </p>
      </div>
      <div className="space-y-2">
        <span className="portal-body block font-medium">Print da tela (opcional)</span>
        <input
          ref={fileInput}
          id="relato-print"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <Paperclip className="h-4 w-4 shrink-0 text-portal-neutral" />
            <span className="portal-small min-w-0 flex-1 truncate">{file.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Remover o print"
              onClick={() => {
                setFile(null);
                if (fileInput.current) fileInput.current.value = '';
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip className="h-5 w-5" /> Anexar print
          </Button>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit">Enviar relato</Button>
      </div>
    </form>
  );
}

export function SupportLauncher() {
  const { collapsed } = useSidebar();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            'portal-small fixed bottom-4 left-4 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 font-medium text-brand-indigo shadow-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            // Desktop: colado a direita da sidebar (240px aberta, 56px recolhida).
            collapsed ? 'md:left-[72px]' : 'md:left-[256px]',
          )}
        >
          <LifeBuoy className="h-5 w-5 shrink-0" />
          Ajuda
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[24rem] max-w-[92vw] flex-col gap-4 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 pr-8 text-left">
          <SheetTitle className="portal-h3">Ajuda e suporte</SheetTitle>
          <SheetDescription className="portal-small">
            Fale com a equipe do Centrix ou conte um problema que você
            encontrou.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2">
            <TabsTrigger value="chat" className="min-h-11 whitespace-normal">
              Falar com o suporte
            </TabsTrigger>
            <TabsTrigger value="relato" className="min-h-11 whitespace-normal">
              Reportar um problema
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="mt-4 min-h-0 flex-1 data-[state=inactive]:hidden">
            <Chat />
          </TabsContent>
          <TabsContent value="relato" className="mt-4 overflow-y-auto">
            <Report onDone={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
