'use client';
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
} from '@/components/ui';
import { UploadZone } from '@/app/cotacao/nova-cotacao/components/upload-zone';
import type { ManualFormDraft } from '@/app/cotacao/nova-cotacao/components/manual-form';
import {
  assistFields,
  simulateSuggestions,
  applySuggestions,
  type AssistField,
  type Suggestion,
} from './draft-ai-model';

export function DraftAiAssist({
  draft,
  supplier,
  onClose,
  onApply,
}: {
  draft: ManualFormDraft;
  supplier: string;
  onClose: () => void;
  onApply: (result: { draft: ManualFormDraft; supplier: string }) => void;
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [selected, setSelected] = useState<AssistField[]>([]);
  const current = (field: AssistField) =>
    field === 'supplier' ? supplier : String(draft.values[field] || '');
  const analyze = () => {
    const results = simulateSuggestions(text);
    setSuggestions(results);
    setSelected(
      results
        .filter((item) => !current(item.field).trim())
        .map((item) => item.field),
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preencher com IA</DialogTitle>
          <DialogDescription>
            Traga os dados da carga e revise o que entra neste rascunho. Campos
            já preenchidos só mudam se você selecionar a substituição.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Prévia demonstrativa: sem IA ou envio de arquivos conectado. O exemplo
          reconhece cinco campos identificados no texto; não interpreta
          documentos.
        </p>
        {suggestions === null ? (
          <>
            <label className="space-y-2 text-sm">
              Cole o e-mail ou as informações da carga
              <Textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  'Fornecedor: ...\nMercadoria: ...\nPO: ...\nLocal de coleta: ...\nIncoterm: ...'
                }
              />
            </label>
            <Button
              variant="ghost"
              className="justify-self-start"
              onClick={() =>
                setText(
                  'Fornecedor: Fornecedor Exemplo\nMercadoria: Peças industriais de demonstração\nPO: PO-EXEMPLO-001\nLocal de coleta: Valencia, Spain\nIncoterm: FOB',
                )
              }
            >
              Usar exemplo de demonstração
            </Button>
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm">
                Adicionar documentos
              </summary>
              <div className="mt-3">
                <UploadZone
                  files={files}
                  onFilesChange={setFiles}
                  msgUploadProgress={0}
                  isUploading={false}
                  title="Selecione os documentos da carga"
                  expectedDocuments={[
                    'Invoice',
                    'Packing List',
                    'E-mail do fornecedor',
                  ]}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Arquivos ficam apenas nesta tela. A leitura de arquivos ainda
                  não está disponível; cole o conteúdo acima ou use o exemplo.
                </p>
              </div>
            </details>
          </>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Revise as sugestões</h3>
            {!suggestions.length && (
              <p className="text-sm">
                Nenhum dos cinco campos foi identificado. Use os rótulos do
                exemplo ou continue manualmente.
              </p>
            )}
            {suggestions.map((item) => (
              <label
                className="flex gap-3 rounded-md border p-3 text-sm"
                key={item.field}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(item.field)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, item.field]
                        : selected.filter((field) => field !== item.field),
                    )
                  }
                />
                <span>
                  <strong className="font-medium">
                    {assistFields[item.field]}
                  </strong>
                  <span className="mt-1 block text-muted-foreground">
                    Atual: {current(item.field) || 'não preenchido'}
                  </span>
                  <span className="block">Sugestão: {item.value}</span>
                  {current(item.field) && (
                    <span className="block text-xs text-muted-foreground">
                      Marque somente se quiser substituir este campo.
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={
              suggestions === null ? onClose : () => setSuggestions(null)
            }
          >
            {suggestions === null
              ? 'Continuar manualmente'
              : 'Voltar ao conteúdo'}
          </Button>
          {suggestions === null ? (
            <Button disabled={!text.trim()} onClick={analyze}>
              Ver sugestões · simulação
            </Button>
          ) : (
            <Button
              disabled={!selected.length}
              onClick={() =>
                onApply(
                  applySuggestions(draft, supplier, suggestions, selected),
                )
              }
            >
              Aplicar {selected.length || ''} {selected.length === 1 ? 'sugestão' : 'sugestões'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
