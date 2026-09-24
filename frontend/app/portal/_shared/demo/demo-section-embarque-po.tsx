'use client';

// A seção "Embarque via PO" do painel — a Freitas, simulada.
//
// Mesmo desenho da seção da Cotação V2: uma ação por estado, e só a válida.
// Não há tela interna aqui e não haverá: a fila de validação e a tela de
// validação (Telas 10 e 11 da spec) são do Centrix interno.
//
// GUARD RAIL NÃO MODELADO. A spec fala nos "primeiros 5 embarques" (RQ-3) e a
// Open Question 2 ainda não diz se a contagem é por cliente ou no total, nem
// quem a libera. TODO embarque via PO passa pela revisão — inventar um número
// seria colocar uma regra que ninguém combinou na frente de quem valida.

import { useMemo, useState } from 'react';
import { CheckCircle2, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMyShipments } from '@/hooks/use-portal-shipments';

import {
  PO_FIELD_LABELS,
  PO_FIXABLE_FIELDS,
  PO_STAGE_DESCRIPTIONS,
  PO_STAGE_LABELS,
  cancel,
  returnToClient,
  submitToFreitas,
  validate,
  type ShipmentPoReview,
} from './shipment-po-review';
import { buildPoScenarioStore } from './shipment-po-scenarios';
import {
  clearShipmentPoStore,
  updateShipmentPoReview,
  useShipmentPoStore,
  writeShipmentPoStore,
} from './use-shipment-po-review';
import {
  setPoReadFailure,
  setPoReviewView,
  usePoReadFailure,
  usePoReviewView,
} from './po-review-view';
import { usePortalModuleReleased } from './use-feature-flags';

/** Motivos prontos, fictícios — os três exemplos que a spec cita. */
const RETURN_REASONS = [
  'Peso bruto divergente do PO anexado',
  'Exportador não confere com a invoice',
  'Falta o tipo de carga para o modal marítimo',
];

const FREE_REASON = '__livre__';

const now = () => new Date().toISOString();

function ReturnDialog({
  shipmentId,
  reference,
  onClose,
}: {
  shipmentId: string;
  reference: string;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState(RETURN_REASONS[0]);
  const [free, setFree] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const reason = choice === FREE_REASON ? free.trim() : choice;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver {reference} ao cliente</DialogTitle>
          <DialogDescription>
            O motivo aparece no cartão e na tela de correção, e os campos
            marcados ficam destacados no formulário. O motivo é obrigatório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="po-return-reason" className="portal-small">
              Motivo
            </Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger id="po-return-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
                <SelectItem value={FREE_REASON}>Outro motivo…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {choice === FREE_REASON && (
            <div className="space-y-1.5">
              <Label htmlFor="po-return-free" className="portal-small">
                Escreva o motivo
              </Label>
              <Input
                id="po-return-free"
                value={free}
                onChange={(event) => setFree(event.target.value)}
                placeholder="O que o cliente precisa corrigir"
              />
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="portal-small text-portal-neutral">
              Campos a corrigir
            </legend>
            <div className="flex flex-wrap gap-2">
              {PO_FIXABLE_FIELDS.map((field) => (
                <label
                  key={field}
                  className="portal-small flex items-center gap-1.5 rounded border border-border px-2 py-1"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 accent-[hsl(var(--primary))]"
                    checked={fields.includes(field)}
                    onChange={(event) =>
                      setFields((prev) =>
                        event.target.checked
                          ? [...prev, field]
                          : prev.filter((f) => f !== field),
                      )
                    }
                  />
                  {PO_FIELD_LABELS[field]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!reason}
            onClick={() => {
              updateShipmentPoReview(shipmentId, (entry) =>
                returnToClient(entry, reason, fields, now()),
              );
              onClose();
            }}
          >
            Devolver ao cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShipmentRow({
  shipmentId,
  entry,
  onReturn,
}: {
  shipmentId: string;
  entry: ShipmentPoReview;
  onReturn: () => void;
}) {
  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="portal-body font-medium text-foreground">
          {entry.reference}
        </p>
        <p className="portal-small text-portal-neutral">
          {PO_STAGE_LABELS[entry.stage]} · {PO_STAGE_DESCRIPTIONS[entry.stage]}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {entry.stage === 'draft' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateShipmentPoReview(shipmentId, (item) =>
                submitToFreitas(item, now()),
              )
            }
          >
            Enviar (como o cliente)
          </Button>
        )}

        {entry.stage === 'awaiting_review' && (
          <>
            <Button
              size="sm"
              onClick={() =>
                updateShipmentPoReview(shipmentId, (item) =>
                  validate(item, now()),
                )
              }
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Validar e ativar
            </Button>
            <Button size="sm" variant="outline" onClick={onReturn}>
              <Undo2 className="mr-1.5 h-4 w-4" />
              Devolver ao cliente
            </Button>
          </>
        )}

        {entry.stage === 'returned' && (
          <p className="portal-small text-portal-neutral">
            A bola está com o cliente: ele corrige e reenvia.
          </p>
        )}

        {entry.stage === 'active' && (
          <p className="portal-small text-portal-neutral">
            Embarque ativo. O cliente acompanha em Meus Embarques.
          </p>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="text-portal-neutral"
          onClick={() =>
            updateShipmentPoReview(shipmentId, (item) => cancel(item, now()))
          }
        >
          Voltar ao rascunho
        </Button>
      </div>
    </li>
  );
}

export function EmbarquePoSection() {
  const released = usePortalModuleReleased('embarqueViaPo');
  const store = useShipmentPoStore();
  const view = usePoReviewView();
  const failRead = usePoReadFailure();
  const { shipments } = useMyShipments();
  const [returning, setReturning] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      Object.entries(store).sort(([, a], [, b]) =>
        a.reference.localeCompare(b.reference),
      ),
    [store],
  );

  if (!released) {
    return (
      <p className="portal-small text-portal-neutral">
        Ligue o módulo “Novo embarque via PO” acima para usar estes controles.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="portal-small text-portal-neutral">
          Nenhum embarque na jornada por PO. Abra um em “Abrir novo embarque”, ou
          carregue os cenários abaixo.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([shipmentId, entry]) => (
            <ShipmentRow
              key={shipmentId}
              shipmentId={shipmentId}
              entry={entry}
              onReturn={() => setReturning(shipmentId)}
            />
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-border pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="po-fail-read" className="portal-body font-medium">
              Simular falha de leitura do PO
            </Label>
            <p className="portal-small text-portal-neutral">
              O anexo é guardado e o formulário abre vazio.
            </p>
          </div>
          <Switch
            id="po-fail-read"
            checked={failRead}
            onCheckedChange={setPoReadFailure}
            aria-label="Simular falha de leitura do PO"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="portal-small">Embarque em análise aparece como</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === 'selo' ? 'default' : 'outline'}
              onClick={() => setPoReviewView('selo')}
            >
              Selo na carteira
            </Button>
            <Button
              size="sm"
              variant={view === 'aba' ? 'default' : 'outline'}
              onClick={() => setPoReviewView('aba')}
            >
              Aba própria
            </Button>
          </div>
          <p className="portal-small text-portal-neutral">
            Telas 7 e 8 da spec. A escolha é do Orsi (Open Question 10); a spec
            propõe o selo.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            writeShipmentPoStore(
              buildPoScenarioStore(shipments.map((s) => s.referencia)),
            )
          }
        >
          Carregar cenários de demonstração
        </Button>
        {entries.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-portal-neutral"
            onClick={() => clearShipmentPoStore()}
          >
            Limpar a jornada por PO
          </Button>
        )}
      </div>
      <p className="portal-small text-portal-neutral">
        Os cenários criam um embarque em cada estado, com referências a partir de
        EMB-2026-0101. Nada é criado nem apagado no servidor.
      </p>

      {returning && (
        <ReturnDialog
          shipmentId={returning}
          reference={store[returning]?.reference ?? returning}
          onClose={() => setReturning(null)}
        />
      )}
    </div>
  );
}
