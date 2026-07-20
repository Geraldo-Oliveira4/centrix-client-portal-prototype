'use client';

import { useState } from 'react';
import { Check, Info, X } from 'lucide-react';
import {
  Combobox,
  MultiCombobox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';
import type { CreateEquipmentItem, CreateVolumeItem, Quotation, QuotationFieldValues, QuotationModal } from '@/types/quotation';
import { cn } from '@/lib/utils';
import { CardSection } from '@arboria-tech/arboria-ui';
import { EquipmentsTable } from './equipments-table';
import { VolumesTable } from './volumes-table';
import { getFieldVisibility } from '@/utils/quotation-fields';
import {
  AIRPORTS_DEPARTURE_OPTIONS,
  AIRPORTS_DESTINATION_OPTIONS,
  INCOTERM_OPTIONS,
  PORTS_DEPARTURE_OPTIONS,
  PORTS_DESTINATION_OPTIONS,
} from '@/constants';
import { EquipmentDialog } from './equipment-dialog';
import { VolumeDialog } from './volume-dialog';

interface ExtractionResultsGridProps {
  values: QuotationFieldValues;
  onChange: (field: keyof QuotationFieldValues, value: string | string[]) => void;
  readOnly?: boolean;
  confidenceScores?: Record<string, number> | null;
  /** Full quotation object — used to display equipment and volume line items */
  quotation?: Quotation;
  /** When provided, enables add/remove controls for FCL equipment line items */
  onEquipmentsUpdate?: (equipments: CreateEquipmentItem[]) => Promise<void>;
  /** When provided, enables add/remove controls for volume line items */
  onVolumesUpdate?: (volumes: CreateVolumeItem[]) => Promise<void>;
}

function isFilled(
  field: keyof QuotationFieldValues,
  values: QuotationFieldValues,
): boolean {
  const v = values[field];
  return v !== '' && v !== null && v !== undefined;
}

// Map completeness field key to form field key(s)
const COMPLETENESS_TO_FORM: Record<
  string,
  Array<keyof QuotationFieldValues>
> = {
  client_id: ['client_id'],
  origin: ['origin'],
  incoterm: ['incoterm'],
  insurance_required: ['insurance_required'],
  product: ['product'],
  stackability: ['stackability'],
  declared_value: ['declared_value'],
  service_type: ['service_type'],
  modal: ['modal'],
  desired_deadline: ['desired_deadline'],
};

function isCompletenessFilled(
  completenessKey: string,
  values: QuotationFieldValues,
): boolean {
  if (completenessKey === 'origin' && values.agente_define_local_coleta === 'true') return true;
  const fields = COMPLETENESS_TO_FORM[completenessKey] ?? [];
  return fields.every((f) => isFilled(f, values));
}

export function ExtractionResultsGrid({
  values,
  onChange,
  readOnly,
  confidenceScores,
  quotation,
  onEquipmentsUpdate,
  onVolumesUpdate,
}: ExtractionResultsGridProps) {
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false);
  const [editingVolumeIndex, setEditingVolumeIndex] = useState<number | null>(null);
  const {
    isFCL,
    isRoad,
    isExportation,
    showTipoEmbarque,
    showPorto,
    showAeroporto,
    showDestinationYard,
    showVolumeSection,
    showTemperatura,
    showUnNumber,
    showImoClass,
    showIncluirEntrega,
    showEnderecoEntrega,
    showNcm,
  } = getFieldVisibility(values);

  return (
    <>
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <p className="text-sm text-muted-foreground">
          Revise e corrija os campos abaixo. Campos com{' '}
          <span className="text-red-500 font-medium">X</span> precisam ser
          preenchidos.
        </p>
      )}

      <div className="grid grid-cols-3 gap-4 items-start">

        {/* ── Bloco 1: Embarque ── */}
        <CardSection
          number={1}
          title="Embarque"
          subtitle="Local de coleta e informações de transporte"
          innerClassName="p-3 flex flex-col gap-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <FieldCard
              label="Tipo de Serviço"
              filled={isCompletenessFilled('service_type', values)}
            >
              <Select
                value={values.service_type}
                onValueChange={(v) => onChange('service_type', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMPORTACAO">Importação</SelectItem>
                  <SelectItem value="EXPORTACAO">Exportação</SelectItem>
                </SelectContent>
              </Select>
            </FieldCard>

            <FieldCard
              label="Modal"
              filled={isCompletenessFilled('modal', values)}
              confidence={confidenceScores?.modal}
            >
              <Select
                value={values.modal}
                onValueChange={(v) => {
                  onChange('modal', v);
                  if (v !== 'MARITIMO') onChange('tipo_embarque', '');
                }}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARITIMO">Marítimo</SelectItem>
                  <SelectItem value="AEREO">Aéreo</SelectItem>
                  <SelectItem value="RODOVIARIO">Rodoviário</SelectItem>
                </SelectContent>
              </Select>
            </FieldCard>

            <ExtraField label="Tipo de Cotação">
              <Select
                value={values.tipo_cotacao}
                onValueChange={(v) => onChange('tipo_cotacao', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REAL">Real</SelectItem>
                  <SelectItem value="ESTIMATIVA">Estimativa</SelectItem>
                </SelectContent>
              </Select>
            </ExtraField>

            <ExtraField label="Data da Cotação">
              <Input
                className="h-8 text-sm"
                type="date"
                value={values.data_cotacao}
                onChange={(e) => onChange('data_cotacao', e.target.value)}
                disabled={readOnly}
              />
            </ExtraField>

            {showTipoEmbarque && (
              <FieldCard
                label="Tipo de Embarque"
                filled={values.tipo_embarque !== ''}
              >
                <Select
                  value={values.tipo_embarque}
                  onValueChange={(v) => onChange('tipo_embarque', v)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FCL">FCL</SelectItem>
                    <SelectItem value="LCL">LCL</SelectItem>
                    <SelectItem value="BREAK_BULK">Break Bulk</SelectItem>
                  </SelectContent>
                </Select>
              </FieldCard>
            )}

            <FieldCard
              label="Incoterm"
              filled={isCompletenessFilled('incoterm', values)}
              confidence={confidenceScores?.incoterm}
            >
              <Combobox
                value={values.incoterm}
                onValueChange={(v) => onChange('incoterm', v)}
                options={INCOTERM_OPTIONS}
                placeholder="Selecionar..."
                searchPlaceholder="Buscar incoterm..."
                disabled={readOnly}
                className="h-8 text-sm"
              />
            </FieldCard>

            <ExtraField label="PTAX Negociada">
              <Select
                value={values.ptax_negociada}
                onValueChange={(v) => onChange('ptax_negociada', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {['1%', '2%', '3%', '4%', '5%'].map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ExtraField>

            <ExtraField label="Fator de Escolha">
              <Select
                value={values.price_or_performance}
                onValueChange={(v) => onChange('price_or_performance', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRECO">Preço</SelectItem>
                  <SelectItem value="PERFORMANCE">Performance</SelectItem>
                </SelectContent>
              </Select>
            </ExtraField>

            <FieldCard
              label="Local de coleta"
              filled={isCompletenessFilled('origin', values)}
              confidence={confidenceScores?.origin}
            >
              <AgentDefineToggle
                checked={values.agente_define_local_coleta === 'true'}
                onChange={(v) => {
                  onChange('agente_define_local_coleta', v ? 'true' : 'false');
                  if (v) onChange('origin', '');
                }}
                disabled={readOnly}
              />
              <Input
                className="h-8 text-sm"
                placeholder="Ex: Shanghai, CN"
                value={values.origin}
                onChange={(e) => onChange('origin', e.target.value)}
                disabled={readOnly || values.agente_define_local_coleta === 'true'}
              />
            </FieldCard>

            {showPorto && (
              <>
                <ExtraField label={isRoad ? 'Fronteira de Embarque' : 'Porto de Embarque'}>
                  <AgentDefineToggle
                    checked={values.agente_define_porto_embarque === 'true'}
                    onChange={(v) => {
                      onChange('agente_define_porto_embarque', v ? 'true' : 'false');
                      if (v) onChange('porto_embarque', '');
                    }}
                    disabled={readOnly}
                  />
                  {isRoad ? (
                    <Input
                      className="h-8 text-sm"
                      placeholder="Ex: Foz do Iguaçu"
                      value={values.porto_embarque}
                      onChange={(e) => onChange('porto_embarque', e.target.value)}
                      disabled={readOnly || values.agente_define_porto_embarque === 'true'}
                    />
                  ) : (
                    <Combobox
                      value={values.porto_embarque}
                      onValueChange={(v) => onChange('porto_embarque', v)}
                      options={isExportation ? PORTS_DESTINATION_OPTIONS : PORTS_DEPARTURE_OPTIONS}
                      placeholder="Selecionar porto..."
                      searchPlaceholder={isExportation ? 'Buscar porto brasileiro...' : 'Buscar porto de origem...'}
                      disabled={readOnly || values.agente_define_porto_embarque === 'true'}
                      className="h-8 text-sm"
                    />
                  )}
                </ExtraField>

                <ExtraField label={isRoad ? 'Fronteira de Destino' : 'Porto de Destino'}>
                  <AgentDefineToggle
                    checked={values.agente_define_porto_destino === 'true'}
                    onChange={(v) => {
                      onChange('agente_define_porto_destino', v ? 'true' : 'false');
                      if (v) onChange('porto_destino', []);
                    }}
                    disabled={readOnly}
                  />
                  {isRoad ? (
                    <Input
                      className="h-8 text-sm"
                      placeholder="Ex: Ciudad del Este"
                      value={values.porto_destino[0] ?? ''}
                      onChange={(e) => onChange('porto_destino', e.target.value ? [e.target.value] : [])}
                      disabled={readOnly || values.agente_define_porto_destino === 'true'}
                    />
                  ) : (
                    <MultiCombobox
                      value={values.porto_destino}
                      onValueChange={(v) => onChange('porto_destino', v)}
                      options={isExportation ? PORTS_DEPARTURE_OPTIONS : PORTS_DESTINATION_OPTIONS}
                      placeholder="Selecionar portos..."
                      searchPlaceholder={isExportation ? 'Buscar porto de destino...' : 'Buscar porto brasileiro...'}
                      disabled={readOnly || values.agente_define_porto_destino === 'true'}
                    />
                  )}
                </ExtraField>
              </>
            )}

            {showAeroporto && (
              <>
                <ExtraField label="Aeroporto de Embarque">
                  <AgentDefineToggle
                    checked={values.agente_define_aeroporto_embarque === 'true'}
                    onChange={(v) => {
                      onChange('agente_define_aeroporto_embarque', v ? 'true' : 'false');
                      if (v) onChange('aeroporto_embarque', '');
                    }}
                    disabled={readOnly}
                  />
                  <Combobox
                    value={values.aeroporto_embarque}
                    onValueChange={(v) => onChange('aeroporto_embarque', v)}
                    options={isExportation ? AIRPORTS_DESTINATION_OPTIONS : AIRPORTS_DEPARTURE_OPTIONS}
                    placeholder="Selecionar aeroporto..."
                    searchPlaceholder="Buscar por código ou cidade..."
                    disabled={readOnly || values.agente_define_aeroporto_embarque === 'true'}
                    className="h-8 text-sm"
                  />
                </ExtraField>

                <ExtraField label="Aeroporto de Desembarque">
                  <AgentDefineToggle
                    checked={values.agente_define_aeroporto_destino === 'true'}
                    onChange={(v) => {
                      onChange('agente_define_aeroporto_destino', v ? 'true' : 'false');
                      if (v) onChange('aeroporto_destino', []);
                    }}
                    disabled={readOnly}
                  />
                  <MultiCombobox
                    value={values.aeroporto_destino}
                    onValueChange={(v) => onChange('aeroporto_destino', v)}
                    options={isExportation ? AIRPORTS_DEPARTURE_OPTIONS : AIRPORTS_DESTINATION_OPTIONS}
                    placeholder="Selecionar aeroporto(s)..."
                    searchPlaceholder="Buscar por código ou cidade..."
                    disabled={readOnly || values.agente_define_aeroporto_destino === 'true'}
                  />
                </ExtraField>
              </>
            )}

            {showIncluirEntrega && (
              <>
                <ExtraField label="Entrega porta-a-porta?">
                  <Select
                    value={values.incluir_entrega_destino_final}
                    onValueChange={(v) => {
                      onChange('incluir_entrega_destino_final', v);
                      if (v !== 'true') onChange('endereco_entrega_final', '');
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </ExtraField>

                {showEnderecoEntrega && (
                  <ExtraField label="Endereço de Entrega Final" className="col-span-2">
                    <Input
                      className="h-8 text-sm"
                      placeholder="Ex: Rua das Flores, 123..."
                      value={values.endereco_entrega_final}
                      onChange={(e) => onChange('endereco_entrega_final', e.target.value)}
                      disabled={readOnly}
                    />
                  </ExtraField>
                )}
              </>
            )}
          </div>
        </CardSection>

        {/* ── Bloco 2: Carga ── */}
        <CardSection
          number={2}
          title="Carga"
          subtitle="Produto, volumes e características da mercadoria"
          innerClassName="p-3 flex flex-col gap-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <FieldCard
              label="Produto / Mercadoria"
              filled={isCompletenessFilled('product', values)}
              confidence={confidenceScores?.product}
              className="col-span-2"
            >
              <Input
                className="h-8 text-sm"
                placeholder="Ex: Eletrônicos, Têxteis..."
                value={values.product}
                onChange={(e) => onChange('product', e.target.value)}
                disabled={readOnly}
              />
            </FieldCard>

            {showNcm && (
              <FieldCard
                label="NCM"
                filled={!!values.ncm}
                confidence={confidenceScores?.ncm}
                className="col-span-2"
              >
                <Input
                  className="h-8 text-sm"
                  placeholder="Ex: 8471.30.19"
                  value={values.ncm}
                  onChange={(e) => onChange('ncm', e.target.value)}
                  disabled={readOnly}
                />
              </FieldCard>
            )}

            <ExtraField label="Exportador" className="col-span-2">
              <Input
                className="h-8 text-sm"
                placeholder="Nome do exportador/shipper"
                value={values.exportador}
                onChange={(e) => onChange('exportador', e.target.value)}
                disabled={readOnly}
              />
            </ExtraField>

            <ExtraField label="País de Procedência">
              <Input
                className="h-8 text-sm"
                placeholder="Ex: China, Alemanha"
                value={values.pais_procedencia}
                onChange={(e) => onChange('pais_procedencia', e.target.value)}
                disabled={readOnly}
              />
            </ExtraField>

            <ExtraField label="Peso Taxado (kg)">
              <Input
                className="h-8 text-sm"
                type="number"
                placeholder="Ex: 1500"
                value={values.peso_taxado}
                onChange={(e) => onChange('peso_taxado', e.target.value)}
                disabled={readOnly}
              />
            </ExtraField>

            <FieldCard
              label="Empilhável"
              filled={isCompletenessFilled('stackability', values)}
              confidence={confidenceScores?.stackability}
            >
              <Select
                value={values.stackability}
                onValueChange={(v) => onChange('stackability', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </FieldCard>

            <ExtraField label="Carga Tombável">
              <Select
                value={values.carga_tombavel}
                onValueChange={(v) => onChange('carga_tombavel', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </ExtraField>

            <ExtraField label="Carga Perigosa" className="col-span-2">
              <Select
                value={values.carga_perigosa}
                onValueChange={(v) => onChange('carga_perigosa', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO">Não</SelectItem>
                  <SelectItem value="RA">RA (Restrita Aérea)</SelectItem>
                  <SelectItem value="IMO">IMO</SelectItem>
                </SelectContent>
              </Select>
            </ExtraField>

            {showUnNumber && (
              <ExtraField label="UN">
                <Input
                  className="h-8 text-sm"
                  placeholder="Ex: UN1263"
                  value={values.un_number}
                  onChange={(e) => onChange('un_number', e.target.value)}
                  disabled={readOnly}
                />
              </ExtraField>
            )}

            {showImoClass && (
              <ExtraField label="IMO (Classe)">
                <Input
                  className="h-8 text-sm"
                  placeholder="Ex: 3, 6.1, 8"
                  value={values.imo_class}
                  onChange={(e) => onChange('imo_class', e.target.value)}
                  disabled={readOnly}
                />
              </ExtraField>
            )}

            {showTemperatura && (
              <>
                <ExtraField label="Temperatura Mín (°C)">
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    placeholder="-20"
                    value={values.temperatura_min}
                    onChange={(e) => onChange('temperatura_min', e.target.value)}
                    disabled={readOnly}
                  />
                </ExtraField>
                <ExtraField label="Temperatura Máx (°C)">
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    placeholder="25"
                    value={values.temperatura_max}
                    onChange={(e) => onChange('temperatura_max', e.target.value)}
                    disabled={readOnly}
                  />
                </ExtraField>
              </>
            )}

          </div>

          <div className="grid grid-cols-2 gap-2">
            <FieldCard
              label="Valor da Carga"
              filled={isCompletenessFilled('declared_value', values)}
              confidence={confidenceScores?.declared_value}
            >
              <div className="flex gap-2">
                <Select
                  value={values.declared_value_currency || 'BRL'}
                  onValueChange={(v) => onChange('declared_value_currency', v)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 w-20 shrink-0 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="CLP">CLP</SelectItem>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-sm flex-1"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={values.declared_value}
                  onChange={(e) => onChange('declared_value', e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </FieldCard>

            <FieldCard
              label="Seguro Obrigatório"
              filled={isCompletenessFilled('insurance_required', values)}
              confidence={confidenceScores?.insurance_required}
            >
              <Select
                value={values.insurance_required}
                onValueChange={(v) => onChange('insurance_required', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </FieldCard>
          </div>

          {/* Equipment line items — FCL */}
          {quotation && isFCL && ((quotation.equipments?.length ?? 0) > 0 || onEquipmentsUpdate) && (
            <EquipmentsTable
              equipments={quotation.equipments ?? []}
              onAdd={
                onEquipmentsUpdate && !readOnly
                  ? () => {
                      setEditingEquipmentIndex(null);
                      setEquipmentDialogOpen(true);
                    }
                  : undefined
              }
              onEdit={
                onEquipmentsUpdate && !readOnly
                  ? (i) => {
                      setEditingEquipmentIndex(i);
                      setEquipmentDialogOpen(true);
                    }
                  : undefined
              }
              onDelete={
                onEquipmentsUpdate && !readOnly
                  ? (i) => {
                      const next = (quotation.equipments ?? [])
                        .filter((_, idx) => idx !== i)
                        .map((e) => ({
                          quantity: e.quantity,
                          tipo_container: e.tipo_container,
                          volume_m3: e.volume_m3 ?? undefined,
                          peso_bruto: e.peso_bruto ?? undefined,
                          peso_unidade: e.peso_unidade,
                        }));
                      onEquipmentsUpdate(next);
                    }
                  : undefined
              }
            />
          )}

          {quotation && showVolumeSection && ((quotation.volumes?.length ?? 0) > 0 || onVolumesUpdate) && (
            <VolumesTable
              volumes={quotation.volumes ?? []}
              modal={values.modal as QuotationModal | undefined}
              onAdd={
                onVolumesUpdate && !readOnly
                  ? () => {
                      setEditingVolumeIndex(null);
                      setVolumeDialogOpen(true);
                    }
                  : undefined
              }
              onEdit={
                onVolumesUpdate && !readOnly
                  ? (i) => {
                      setEditingVolumeIndex(i);
                      setVolumeDialogOpen(true);
                    }
                  : undefined
              }
              onDelete={
                onVolumesUpdate && !readOnly
                  ? (i) => {
                      const vols = quotation.volumes ?? [];
                      const next = vols
                        .filter((_, idx) => idx !== i)
                        .map((v) => ({
                          quantity: v.quantity,
                          embalagem: v.embalagem ?? undefined,
                          peso_bruto: v.peso_bruto ?? undefined,
                          peso_unidade: v.peso_unidade,
                          comprimento: v.comprimento ?? undefined,
                          largura: v.largura ?? undefined,
                          altura: v.altura ?? undefined,
                          dimensao_unidade: v.dimensao_unidade,
                          volume_m3: v.volume_m3 ?? undefined,
                          inspecao_iof: v.inspecao_iof ?? undefined,
                        }));
                      onVolumesUpdate(next);
                    }
                  : undefined
              }
            />
          )}
        </CardSection>

        {/* ── Bloco 3: Observacoes ── */}
        <CardSection
          number={3}
          title="Observações"
          subtitle="Prazos, condições e informações adicionais"
          innerClassName="p-3 flex flex-col gap-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <FieldCard
              label="Prazo de Retorno"
              filled={isCompletenessFilled('desired_deadline', values)}
              confidence={confidenceScores?.desired_deadline}
              className="col-span-2"
            >
              <Input
                className="h-8 text-sm"
                type="datetime-local"
                value={values.desired_deadline}
                onChange={(e) => onChange('desired_deadline', e.target.value)}
                disabled={readOnly}
              />
            </FieldCard>

            <ExtraField label="Data de prontidão">
              <Input
                className="h-8 text-sm"
                type="date"
                value={values.data_prontidao}
                onChange={(e) => onChange('data_prontidao', e.target.value)}
                disabled={readOnly}
              />
            </ExtraField>

            <ExtraField label="Data de chegada solicitada pelo cliente">
              <Input
                className="h-8 text-sm"
                type="date"
                value={values.data_limite_necessidade}
                onChange={(e) => onChange('data_limite_necessidade', e.target.value)}
                disabled={readOnly}
              />
            </ExtraField>

            {showDestinationYard && (
              <ExtraField label="Recinto de Destino">
                <Input
                  className="h-8 text-sm"
                  placeholder="Ex: Recinto Santos"
                  value={values.destination_yard}
                  onChange={(e) => onChange('destination_yard', e.target.value)}
                  disabled={readOnly}
                />
              </ExtraField>
            )}

            <ExtraField label="Referência do Cliente" className="col-span-2">
              <Input
                className="h-8 text-sm"
                placeholder="Ex: PO-12345"
                value={values.client_reference}
                onChange={(e) => onChange('client_reference', e.target.value)}
                disabled={readOnly}
              />
            </ExtraField>

            <div className="flex flex-col gap-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Input
                className="h-8 text-sm"
                placeholder="Observações adicionais..."
                value={values.observations}
                onChange={(e) => onChange('observations', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
        </CardSection>
      </div>
    </div>

    {onEquipmentsUpdate && (() => {
      const eqs = quotation?.equipments ?? [];
      const editingEq = editingEquipmentIndex !== null ? eqs[editingEquipmentIndex] : undefined;
      const equipmentInitialValues: import('@/types/quotation').CreateEquipmentItem | undefined = editingEq
        ? {
            quantity: editingEq.quantity,
            tipo_container: editingEq.tipo_container,
            volume_m3: editingEq.volume_m3 ?? undefined,
            peso_bruto: editingEq.peso_bruto ?? undefined,
            peso_unidade: editingEq.peso_unidade,
          }
        : undefined;
      return (
        <EquipmentDialog
          open={equipmentDialogOpen}
          onOpenChange={(open) => {
            setEquipmentDialogOpen(open);
            if (!open) setEditingEquipmentIndex(null);
          }}
          initialValues={equipmentInitialValues}
          onAdd={(item) => {
            const next =
              editingEquipmentIndex !== null
                ? eqs.map((e, i) =>
                    i === editingEquipmentIndex
                      ? item
                      : {
                          quantity: e.quantity,
                          tipo_container: e.tipo_container,
                          volume_m3: e.volume_m3 ?? undefined,
                          peso_bruto: e.peso_bruto ?? undefined,
                          peso_unidade: e.peso_unidade,
                        }
                  )
                : [
                    ...eqs.map((e) => ({
                      quantity: e.quantity,
                      tipo_container: e.tipo_container,
                      volume_m3: e.volume_m3 ?? undefined,
                      peso_bruto: e.peso_bruto ?? undefined,
                      peso_unidade: e.peso_unidade,
                    })),
                    item,
                  ];
            onEquipmentsUpdate(next);
            setEditingEquipmentIndex(null);
          }}
        />
      );
    })()}

    {onVolumesUpdate && (() => {
      const vols = quotation?.volumes ?? [];
      const editingVol = editingVolumeIndex !== null ? vols[editingVolumeIndex] : undefined;
      const initialValues: CreateVolumeItem | undefined = editingVol
        ? {
            quantity: editingVol.quantity,
            embalagem: editingVol.embalagem ?? undefined,
            peso_bruto: editingVol.peso_bruto ?? undefined,
            peso_unidade: editingVol.peso_unidade,
            comprimento: editingVol.comprimento ?? undefined,
            largura: editingVol.largura ?? undefined,
            altura: editingVol.altura ?? undefined,
            dimensao_unidade: editingVol.dimensao_unidade,
            volume_m3: editingVol.volume_m3 ?? undefined,
            inspecao_iof: editingVol.inspecao_iof ?? undefined,
          }
        : undefined;
      return (
        <VolumeDialog
          open={volumeDialogOpen}
          onOpenChange={(open) => {
            setVolumeDialogOpen(open);
            if (!open) setEditingVolumeIndex(null);
          }}
          modal={values.modal as never}
          initialValues={initialValues}
          onAdd={(item) => {
            const next =
              editingVolumeIndex !== null
                ? vols.map((v, i) =>
                    i === editingVolumeIndex
                      ? item
                      : {
                          quantity: v.quantity,
                          embalagem: v.embalagem ?? undefined,
                          peso_bruto: v.peso_bruto ?? undefined,
                          peso_unidade: v.peso_unidade,
                          comprimento: v.comprimento ?? undefined,
                          largura: v.largura ?? undefined,
                          altura: v.altura ?? undefined,
                          dimensao_unidade: v.dimensao_unidade,
                          volume_m3: v.volume_m3 ?? undefined,
                          inspecao_iof: v.inspecao_iof ?? undefined,
                        }
                  )
                : [
                    ...vols.map((v) => ({
                      quantity: v.quantity,
                      embalagem: v.embalagem ?? undefined,
                      peso_bruto: v.peso_bruto ?? undefined,
                      peso_unidade: v.peso_unidade,
                      comprimento: v.comprimento ?? undefined,
                      largura: v.largura ?? undefined,
                      altura: v.altura ?? undefined,
                      dimensao_unidade: v.dimensao_unidade,
                      volume_m3: v.volume_m3 ?? undefined,
                      inspecao_iof: v.inspecao_iof ?? undefined,
                    })),
                    item,
                  ];
            onVolumesUpdate(next);
            setEditingVolumeIndex(null);
          }}
        />
      );
    })()}
  </>
  );
}

// ── Sub-components ──

interface FieldCardProps {
  label: string;
  filled: boolean;
  confidence?: number | null;
  className?: string;
  children: React.ReactNode;
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400';
  if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-500 dark:text-red-400';
}

function FieldCard({ label, filled, confidence, className, children }: FieldCardProps) {
  return (
    <div
      className={cn(
        'border rounded-md p-2.5 flex flex-col gap-1.5 transition-colors',
        filled
          ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10'
          : 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <Label className="text-xs font-medium leading-tight">{label}</Label>
        <div className="flex items-center gap-1.5 shrink-0">
          {confidence != null && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'text-[10px] font-semibold cursor-help flex items-center gap-0.5',
                      confidenceColor(confidence),
                    )}
                  >
                    {Math.round(confidence * 100)}%
                    <Info className="w-3 h-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Taxa de confiança da IA neste campo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {filled ? (
            <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function ExtraField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AgentDefineToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="scale-75 origin-left"
      />
      <span className="text-[10px] text-muted-foreground">Deixar que agentes decidam</span>
    </div>
  );
}
