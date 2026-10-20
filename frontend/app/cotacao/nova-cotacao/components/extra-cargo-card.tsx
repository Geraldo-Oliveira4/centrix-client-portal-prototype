'use client';

// Cartão "Carga N" (N >= 2) da Nova cotação do portal — feedback do Vitor,
// 20/10/2026. Só existe com `ManualForm multiCargo`; a tela do analista não o
// renderiza.
//
// Mesmos campos da carga 1, na mesma ordem e com os mesmos rótulos, mas em
// estado controlado (não react-hook-form): a carga 1 continua sendo os campos
// que o formulário sempre teve, e o que é novo fica fora do caminho do analista.
// As regras de bloqueio NÃO moram aqui — elas vêm do mesmo `evaluateHardblocks`
// via `quotation-cargos.ts`, e este cartão só mostra o motivo embaixo do campo.

import { Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/ui';
import type { QuotationModal } from '@/types/quotation';
import {
  cargoField,
  type ExtraCargo,
} from '@/app/portal/_shared/demo/quotation-cargos';
import { FieldBlockHint, FieldCollapse, fieldAnchor } from './field-blocks';
import { VolumesTable } from './volumes-table';

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CNY', 'ARS', 'CLP', 'MXN', 'CHF'];

export function ExtraCargoCard({
  number,
  cargo,
  onChange,
  onRemove,
  hardblockMode,
  showNcm,
  showVolumes,
  modal,
  onAddVolume,
  onEditVolume,
  onDeleteVolume,
}: {
  /** 2..N — a carga 1 é o próprio formulário. */
  number: number;
  cargo: ExtraCargo;
  onChange: (patch: Partial<ExtraCargo>) => void;
  onRemove: () => void;
  /** Cotação V2: Sim/Não explícito para carga perigosa, NCM condicional. */
  hardblockMode: boolean;
  showNcm: boolean;
  showVolumes: boolean;
  modal?: QuotationModal;
  onAddVolume: () => void;
  onEditVolume: (index: number) => void;
  onDeleteVolume: (index: number) => void;
}) {
  const id = (field: string) => fieldAnchor(cargoField(number, field));
  const input = (field: string) => `${id(field)}-input`;
  const dangerousActive =
    cargo.carga_perigosa === 'RA' || cargo.carga_perigosa === 'IMO';
  const dangerousAnswer =
    cargo.carga_perigosa === 'NAO'
      ? 'nao'
      : dangerousActive || cargo.perigosa_declarada
        ? 'sim'
        : '';
  const showUn = dangerousActive || (hardblockMode && cargo.perigosa_declarada);
  const title = `Carga ${number}`;

  return (
    <article
      aria-labelledby={`${id('titulo')}`}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 id={id('titulo')} className="portal-h3">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-portal-neutral"
          aria-label={`Remover ${title}`}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remover
        </Button>
      </header>

      <div id={id('product')} className="flex flex-col gap-2">
        <Label htmlFor={input('product')}>Produto / Mercadoria</Label>
        <Input
          id={input('product')}
          placeholder="Ex: Eletrônicos, Têxteis..."
          value={cargo.product}
          onChange={(e) => onChange({ product: e.target.value })}
        />
        <FieldBlockHint field={cargoField(number, 'product')} />
      </div>

      {hardblockMode && (
        <FieldCollapse open={showNcm} closedOffset="-mt-4">
          <div id={id('ncm')} className="flex flex-col gap-2">
            <Label htmlFor={input('ncm')}>NCM</Label>
            <Input
              id={input('ncm')}
              inputMode="numeric"
              placeholder="Ex: 8517.62.77"
              value={cargo.ncm}
              onChange={(e) => onChange({ ncm: e.target.value })}
            />
            <FieldBlockHint field={cargoField(number, 'ncm')} />
          </div>
        </FieldCollapse>
      )}

      <div id={id('carga_perigosa')} className="flex flex-col gap-2">
        {hardblockMode ? (
          <>
            <Label htmlFor={input('carga_perigosa')}>Carga perigosa</Label>
            <Select
              value={dangerousAnswer}
              onValueChange={(answer) =>
                answer === 'nao'
                  ? onChange({
                      carga_perigosa: 'NAO',
                      perigosa_declarada: false,
                      un_number: '',
                      imo_class: '',
                    })
                  : onChange({
                      perigosa_declarada: true,
                      carga_perigosa:
                        cargo.carga_perigosa === 'NAO' ? '' : cargo.carga_perigosa,
                    })
              }
            >
              <SelectTrigger id={input('carga_perigosa')}>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Switch
              id={input('carga_perigosa')}
              checked={dangerousActive}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? { carga_perigosa: 'RA' }
                    : { carga_perigosa: 'NAO', un_number: '', imo_class: '' },
                )
              }
            />
            <Label htmlFor={input('carga_perigosa')}>Carga Perigosa</Label>
          </div>
        )}
        <FieldBlockHint field={cargoField(number, 'carga_perigosa')} />
        {(hardblockMode ? dangerousAnswer === 'sim' : dangerousActive) && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={input('classe')}>Classificação</Label>
              <Select
                value={dangerousActive ? cargo.carga_perigosa : ''}
                onValueChange={(value) =>
                  onChange({ carga_perigosa: value as ExtraCargo['carga_perigosa'] })
                }
              >
                <SelectTrigger id={input('classe')}>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RA">RA — Radioativo</SelectItem>
                  <SelectItem value="IMO">IMO — Perigoso (IMDG)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showUn && (
              <div id={id('un_number')} className="flex flex-col gap-2">
                <Label htmlFor={input('un_number')}>UN</Label>
                <Input
                  id={input('un_number')}
                  placeholder="Ex: UN1263"
                  value={cargo.un_number}
                  onChange={(e) => onChange({ un_number: e.target.value })}
                />
                <FieldBlockHint field={cargoField(number, 'un_number')} />
              </div>
            )}
            {cargo.carga_perigosa === 'IMO' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={input('imo_class')}>IMO (Classe)</Label>
                <Input
                  id={input('imo_class')}
                  placeholder="Ex: 3, 6.1, 8"
                  value={cargo.imo_class}
                  onChange={(e) => onChange({ imo_class: e.target.value })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['stackability', 'Empilhável'],
            ['carga_tombavel', 'Carga Tombável'],
          ] as const
        ).map(([field, label]) => (
          <div key={field} id={id(field)} className="flex flex-col gap-2">
            <Label htmlFor={input(field)}>{label}</Label>
            <Select
              value={cargo[field]}
              onValueChange={(value) =>
                onChange({ [field]: value as '' | 'true' | 'false' })
              }
            >
              <SelectTrigger id={input(field)}>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
              </SelectContent>
            </Select>
            <FieldBlockHint field={cargoField(number, field)} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Switch
            id={input('refrigerada')}
            checked={cargo.refrigerada}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? { refrigerada: true }
                  : { refrigerada: false, temperatura_min: '', temperatura_max: '' },
              )
            }
          />
          <Label htmlFor={input('refrigerada')}>Carga Refrigerada</Label>
        </div>
        {cargo.refrigerada && (
          <div className="grid grid-cols-2 gap-2">
            <div id={id('temperatura_min')} className="flex flex-col gap-2">
              <Label htmlFor={input('temperatura_min')}>Temp. Mín (°C)</Label>
              <Input
                id={input('temperatura_min')}
                type="number"
                placeholder="Mín"
                value={cargo.temperatura_min}
                onChange={(e) => onChange({ temperatura_min: e.target.value })}
              />
              <FieldBlockHint field={cargoField(number, 'temperatura_min')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={input('temperatura_max')}>Temp. Máx (°C)</Label>
              <Input
                id={input('temperatura_max')}
                type="number"
                placeholder="Máx"
                value={cargo.temperatura_max}
                onChange={(e) => onChange({ temperatura_max: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {showVolumes && (
        <VolumesTable
          volumes={cargo.volumes}
          modal={modal}
          onAdd={onAddVolume}
          onEdit={onEditVolume}
          onDelete={onDeleteVolume}
        />
      )}

      <div id={id('declared_value')} className="flex flex-col gap-2">
        <Label htmlFor={input('declared_value')}>Valor da Carga</Label>
        <div className="flex gap-2">
          <Select
            value={cargo.declared_value_currency}
            onValueChange={(value) => onChange({ declared_value_currency: value })}
          >
            <SelectTrigger className="w-24 shrink-0" aria-label={`Moeda do valor da ${title}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id={input('declared_value')}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            className="flex-1"
            value={cargo.declared_value}
            onChange={(e) => onChange({ declared_value: e.target.value })}
          />
        </div>
        <FieldBlockHint field={cargoField(number, 'declared_value')} />
      </div>
    </article>
  );
}
