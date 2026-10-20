// Várias cargas numa cotação (feedback do Vitor, 20/10/2026; regra confirmada
// pelo Mauro: uma cotação = um embarque, com N cargas, e cada carga com N
// volumes).
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`. O único import de fora
// é TIPO (apagado antes do runner do Node).
//
// O QUE É POR CARGA E O QUE É DO EMBARQUE. Por carga: produto, NCM, carga
// perigosa (+UN/IMO), empilhável, tombável, refrigerada (+temperaturas), valor
// da carga (+moeda) e volumes. Do embarque: rota, incoterm, datas, PO,
// observações, equipamentos FCL e seguro obrigatório (este último é ambíguo e
// ficou onde estava; ver docs/spec-cotacao-multiplas-cargas.md).
//
// A CARGA 1 SÃO OS CAMPOS QUE O FORMULÁRIO JÁ TINHA. As cargas 2..N vivem ao
// lado, nesta forma, e só existem no portal. Por isso a regra de cada carga
// extra NÃO é reescrita aqui: a carga entra num snapshot igual ao do formulário
// e passa pela MESMA `evaluateHardblocks`. Uma segunda lista de regras para as
// cargas extras divergiria da primeira na primeira regra acrescentada a ela.
//
// O backend de hoje não conhece cargas. O que vai na criação é a carga 1 nos
// campos de sempre, o produto composto ("Peças + 2 outras cargas") e TODOS os
// volumes somados; a lista completa fica no snapshot da revisão. O formato que
// o backend precisaria receber está em `cargoPayload` e no spec.

import type { CreateVolumeItem } from '../../../../types/quotation.ts';
import type { FormSnapshot } from './quotation-form-snapshot.ts';
import type {
  Hardblock,
  HardblockItem,
  HardblockReport,
} from './quotation-hardblocks.ts';

/** Uma carga além da primeira. Valores crus, no mesmo código do formulário. */
export interface ExtraCargo {
  /** Estável entre renders e remoções (key do React, âncora do campo). */
  id: string;
  product: string;
  ncm: string;
  /** '' = não respondido; 'NAO' | 'RA' | 'IMO' como no formulário. */
  carga_perigosa: '' | 'NAO' | 'RA' | 'IMO';
  /** "Sim" sem classificação ainda: o estado que o enum não guarda. */
  perigosa_declarada: boolean;
  un_number: string;
  imo_class: string;
  stackability: '' | 'true' | 'false';
  carga_tombavel: '' | 'true' | 'false';
  refrigerada: boolean;
  temperatura_min: string;
  temperatura_max: string;
  declared_value: string;
  declared_value_currency: string;
  volumes: CreateVolumeItem[];
}

export function emptyCargo(id: string): ExtraCargo {
  return {
    id,
    product: '',
    ncm: '',
    carga_perigosa: '',
    perigosa_declarada: false,
    un_number: '',
    imo_class: '',
    stackability: '',
    carga_tombavel: '',
    refrigerada: false,
    temperatura_min: '',
    temperatura_max: '',
    declared_value: '',
    declared_value_currency: 'BRL',
    volumes: [],
  };
}

/** Os itens da lista do Orsi que são da CARGA, não do embarque. */
export const CARGO_HARDBLOCK_ITEMS: readonly HardblockItem[] = [
  'product',
  'ncm',
  'carga_perigosa',
  'un_number',
  'stackability',
  'carga_tombavel',
  'temperatura_min',
  'declared_value',
];

/**
 * O nome do campo de uma carga extra (número 2..N). Vira a âncora do campo
 * (`campo-carga2_product`) e a chave do motivo embaixo dele.
 */
export function cargoField(cargoNumber: number, field: string): string {
  return `carga${cargoNumber}_${field}`;
}

export function cargoLabel(label: string, cargoNumber: number): string {
  return `${label} (Carga ${cargoNumber})`;
}

/** O snapshot da carga extra: o do embarque com os campos dela por cima. */
export function cargoSnapshot(
  shipment: FormSnapshot,
  cargo: ExtraCargo,
): FormSnapshot {
  const dangerous =
    cargo.carga_perigosa || (cargo.perigosa_declarada ? 'SIM' : '');
  return {
    ...shipment,
    product: cargo.product.trim(),
    ncm: cargo.ncm.trim(),
    carga_perigosa: dangerous,
    un_number: cargo.un_number.trim(),
    imo_class: cargo.imo_class.trim(),
    stackability: cargo.stackability,
    carga_tombavel: cargo.carga_tombavel,
    carga_refrigerada: cargo.refrigerada ? 'true' : 'false',
    temperatura_min: cargo.refrigerada ? cargo.temperatura_min.trim() : '',
    temperatura_max: cargo.refrigerada ? cargo.temperatura_max.trim() : '',
    declared_value: cargo.declared_value.trim(),
    declared_value_currency: cargo.declared_value_currency,
  };
}

/**
 * O relatório do formulário com as cargas extras.
 *
 * - Sem carga extra, devolve o relatório como veio: nada muda para quem tem
 *   uma carga só.
 * - Com carga extra, todo item de carga ganha "(Carga N)" no rótulo — inclusive
 *   os da carga 1, senão "Produto" ao lado de "Produto (Carga 2)" leria como
 *   um campo do embarque.
 * - Os itens das cargas extras entram depois dos da carga 1 e antes do PO, que
 *   é a ordem em que o cliente encontra os campos na tela.
 *
 * `evaluate` é a `evaluateHardblocks` (injetada para este módulo não depender
 * do VALOR de outro arquivo; o teste passa a real).
 */
export function hardblocksWithCargos(
  report: HardblockReport,
  shipment: FormSnapshot,
  cargos: readonly ExtraCargo[],
  evaluate: (snapshot: FormSnapshot) => HardblockReport,
): HardblockReport {
  if (cargos.length === 0) return report;
  const isCargo = (block: Hardblock) =>
    CARGO_HARDBLOCK_ITEMS.includes(block.item);

  const first = report.blocks.map((block) =>
    isCargo(block) ? { ...block, label: cargoLabel(block.label, 1) } : block,
  );
  const extras = cargos.flatMap((cargo, index) => {
    const number = index + 2;
    return evaluate(cargoSnapshot(shipment, cargo))
      .blocks.filter(isCargo)
      .map((block) => ({
        ...block,
        field: cargoField(number, block.field),
        label: cargoLabel(block.label, number),
      }));
  });

  const reference = first.findIndex((block) => block.item === 'client_reference');
  const at = reference === -1 ? first.length : reference;
  return {
    applies: report.applies,
    blocks: [...first.slice(0, at), ...extras, ...first.slice(at)],
  };
}

/**
 * "1 carga · 2 volumes", "3 cargas · 5 volumes", "2 cargas · sem volumes".
 * `null` omite a parte: no FCL o formulário não pede volume (pede equipamento),
 * e "sem volumes" ali leria como esquecimento.
 */
export function cargoCountSummary(
  cargoCount: number,
  volumeCount: number | null,
  equipmentCount: number | null = null,
): string {
  const parts = [`${cargoCount} ${cargoCount === 1 ? 'carga' : 'cargas'}`];
  if (volumeCount != null) {
    parts.push(
      volumeCount === 0
        ? 'sem volumes'
        : `${volumeCount} ${volumeCount === 1 ? 'volume' : 'volumes'}`,
    );
  }
  if (equipmentCount != null) {
    parts.push(`${equipmentCount} ${equipmentCount === 1 ? 'equipamento' : 'equipamentos'}`);
  }
  return parts.join(' · ');
}

/** Volumes de uma lista, pela quantidade de cada linha (linha sem quantidade = 1). */
export function countVolumes(volumes: readonly CreateVolumeItem[]): number {
  return volumes.reduce((sum, line) => sum + (line.quantity || 1), 0);
}

/**
 * O texto do campo `product` que o backend de hoje recebe. As telas seguintes
 * (cartão do Kanban, detalhe, histórico) leem esse campo, e com ele elas já
 * dizem que há mais de uma carga sem precisar mudar.
 */
export function combinedProductLabel(products: readonly string[]): string {
  const named = products.map((p) => p.trim());
  const first = named[0] || 'Carga sem descrição';
  const others = named.length - 1;
  if (others <= 0) return named[0] ?? '';
  return `${first} + ${others} ${others === 1 ? 'outra carga' : 'outras cargas'}`;
}

/**
 * Uma linha por carga extra, para o snapshot da revisão
 * ("Carga 2: Rolamentos · 3 volumes · USD 4.000").
 */
export function extraCargoLines(cargos: readonly ExtraCargo[]): string[] {
  return cargos.map((cargo, index) => {
    const parts = [cargo.product.trim() || 'sem descrição'];
    const volumes = countVolumes(cargo.volumes);
    if (volumes > 0) parts.push(`${volumes} ${volumes === 1 ? 'volume' : 'volumes'}`);
    if (cargo.declared_value.trim()) {
      parts.push(`${cargo.declared_value_currency} ${cargo.declared_value.trim()}`);
    }
    return `Carga ${index + 2}: ${parts.join(' · ')}`;
  });
}

/** Uma carga no formato que o backend precisaria receber (spec). */
export interface CargoPayload {
  product: string;
  ncm?: string;
  carga_perigosa?: 'NAO' | 'RA' | 'IMO';
  un_number?: string;
  imo_class?: string;
  stackability?: boolean;
  carga_tombavel?: boolean;
  temperatura_min?: number;
  temperatura_max?: number;
  declared_value?: number;
  declared_value_currency?: string;
  volumes: CreateVolumeItem[];
}

function bool(value: string): boolean | undefined {
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

function num(value: string, parse: (raw: string) => number): number | undefined {
  if (!value.trim()) return undefined;
  const n = parse(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A lista `cargos` do spec, a partir das cargas extras (a carga 1 entra pelo
 * mesmo formato, montada por quem chama a partir dos campos do formulário).
 * `parseAmount` é injetado pelo mesmo motivo de `evaluate` acima.
 */
export function cargoPayload(
  cargo: ExtraCargo,
  parseAmount: (raw: string) => number,
): CargoPayload {
  const out: CargoPayload = {
    product: cargo.product.trim(),
    volumes: cargo.volumes,
  };
  if (cargo.ncm.trim()) out.ncm = cargo.ncm.trim();
  if (cargo.carga_perigosa) out.carga_perigosa = cargo.carga_perigosa;
  if (cargo.un_number.trim()) out.un_number = cargo.un_number.trim();
  if (cargo.imo_class.trim()) out.imo_class = cargo.imo_class.trim();
  const stack = bool(cargo.stackability);
  if (stack !== undefined) out.stackability = stack;
  const tip = bool(cargo.carga_tombavel);
  if (tip !== undefined) out.carga_tombavel = tip;
  if (cargo.refrigerada) {
    const min = num(cargo.temperatura_min, (r) => Number(r.replace(',', '.')));
    const max = num(cargo.temperatura_max, (r) => Number(r.replace(',', '.')));
    if (min !== undefined) out.temperatura_min = min;
    if (max !== undefined) out.temperatura_max = max;
  }
  const value = num(cargo.declared_value, parseAmount);
  if (value !== undefined) {
    out.declared_value = value;
    out.declared_value_currency = cargo.declared_value_currency;
  }
  return out;
}
