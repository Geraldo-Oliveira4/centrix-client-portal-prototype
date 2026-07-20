import { ColumnDef } from '@tanstack/react-table';

// Estendendo o tipo ColumnMeta para incluir nossos campos personalizados
export type CustomColumnMeta = {
  mobileHeader?: React.ReactNode;
  mobileHidden?: boolean;
  filterComponent?: React.ComponentType<{
    column: any; // Tipagem completa seria muito extensa aqui
  }>;
};

// Helper type para criar colunas com nossa meta personalizada
export type CustomColumnDef<TData, TValue = unknown> = ColumnDef<
  TData,
  TValue
> & {
  meta?: CustomColumnMeta;
};
