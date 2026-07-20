import type { ComboboxOption } from '@/components/ui';

export const INCOTERM_OPTIONS: ComboboxOption[] = [
  { value: 'EXW', label: 'EXW - Ex Works' },
  { value: 'FCA', label: 'FCA - Free Carrier' },
  { value: 'FAS', label: 'FAS - Free Alongside Ship' },
  { value: 'CPT', label: 'CPT - Carriage Paid To' },
  { value: 'CIP', label: 'CIP - Carriage And Insurance Paid To' },
  { value: 'DAP', label: 'DAP - Delivered At Place' },
  { value: 'DPU', label: 'DPU - Delivered At Place Unloaded' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
  { value: 'FOB', label: 'FOB - Free On Board' },
  { value: 'CFR', label: 'CFR - Cost And Freight' },
  { value: 'CIF', label: 'CIF - Cost Insurance And Freight' },
];
