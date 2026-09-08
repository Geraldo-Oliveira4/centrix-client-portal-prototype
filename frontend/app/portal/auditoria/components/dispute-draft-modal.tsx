'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Paperclip, Pencil, Send } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@/components/ui';

import { ProvenanceBadge } from '../../_shared/provenance-badge';
import { buildDisputeDraft } from '../lib/dispute-draft';
import type { ConciliationExample, EvaluatedLine } from '../lib/conciliation';

/**
 * Camada 3 — "Rascunho de Contestação".
 *
 * O texto sai de `buildDisputeDraft` (template determinístico, sem IA). O envio
 * NÃO acontece: não há destinatário real (o embarque é exemplo) nem serviço de
 * contestação neste protótipo, então "Enviar" fecha o fluxo dizendo exatamente
 * isso em vez de fingir que o e-mail saiu. Anexos também ficam locais.
 */
export function DisputeDraftModal({
  open,
  onOpenChange,
  example,
  line,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  example: ConciliationExample | null;
  line: EvaluatedLine | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  // Reseta a cada abertura: o rascunho é sempre regerado a partir da linha.
  useEffect(() => {
    if (!open || !example || !line) return;
    const draft = buildDisputeDraft(example, line);
    setSubject(draft.subject);
    setBody(draft.body);
    setEditing(false);
    setAttachments([]);
    setSent(false);
  }, [open, example, line]);

  if (!example || !line) return null;

  const draft = buildDisputeDraft(example, line);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Rascunho de Contestação
            <ProvenanceBadge provenance="preview" />
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-4">
              <Check className="mt-0.5 h-6 w-6 shrink-0 text-portal-neutral" />
              <div className="space-y-1">
                <p className="portal-body font-medium text-foreground">
                  Rascunho concluído — nada foi enviado
                </p>
                <p className="portal-small text-portal-neutral">
                  O disparo da contestação ao agente entra junto com o módulo de
                  contestação. Por enquanto esta tela só monta o texto: copie o
                  conteúdo se quiser enviá-lo por fora.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="portal-small text-portal-neutral">
              Texto montado automaticamente a partir da divergência do item{' '}
              <span className="font-medium text-foreground">{line.item}</span> —
              modelo fixo, sem IA. Os valores vêm do exemplo conceitual desta tela.
            </p>

            <div className="space-y-2">
              <label className="portal-small text-portal-neutral" htmlFor="dispute-to">
                Para
              </label>
              <Input id="dispute-to" value={draft.to} readOnly className="h-9" />
            </div>

            <div className="space-y-2">
              <label
                className="portal-small text-portal-neutral"
                htmlFor="dispute-subject"
              >
                Assunto
              </label>
              <Input
                id="dispute-subject"
                value={subject}
                readOnly={!editing}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <label className="portal-small text-portal-neutral" htmlFor="dispute-body">
                Mensagem
              </label>
              <Textarea
                id="dispute-body"
                value={body}
                readOnly={!editing}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="font-normal"
              />
            </div>

            {attachments.length > 0 ? (
              <ul className="space-y-1">
                {attachments.map((name) => (
                  <li
                    key={name}
                    className="portal-small inline-flex items-center gap-1.5 text-portal-neutral"
                  >
                    <Paperclip className="h-4 w-4" />
                    {name}
                    <span className="text-portal-neutral">· anexo local, não enviado</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setEditing((v) => !v)}
              >
                <Pencil className="h-5 w-5" />
                {editing ? 'Concluir edição' : 'Editar'}
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-5 w-5" />
                Anexar documentação
              </Button>
              <Button className="gap-1.5" onClick={() => setSent(true)}>
                <Send className="h-5 w-5" />
                Enviar
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const names = Array.from(e.target.files ?? []).map((f) => f.name);
                if (fileRef.current) fileRef.current.value = '';
                if (names.length) {
                  setAttachments((prev) => Array.from(new Set([...prev, ...names])));
                }
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
