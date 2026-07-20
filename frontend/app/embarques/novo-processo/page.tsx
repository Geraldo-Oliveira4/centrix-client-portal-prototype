'use client';

import { PageTitle } from '@arboria-tech/arboria-ui';
import { NovoProcessoForm } from './components/novo-processo-form';

export default function NovoProcessoPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Novo Embarque" />
      <NovoProcessoForm />
    </div>
  );
}
