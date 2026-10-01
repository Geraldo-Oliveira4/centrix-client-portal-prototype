'use client';

// /portal/admin/acessos — a gestão de acessos da FREITAS, simulada dentro do
// portal só porque o protótipo não tem Centrix interno (PLANO-PROMPT3.md).
//
// O CLIENTE FINAL NUNCA CHEGA AQUI: nenhum menu ou link do portal aponta para
// esta rota, ela é `noindex` (admin/layout.tsx), e sem o modo de demonstração
// ligado nesta aba (`?demo=1` / Ctrl+Shift+D) ela devolve o MESMO 404 de uma
// URL inexistente. A porta é o botão do painel de demonstração.

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { PagePortalHeader } from '../../_shared/page-header';
import { useDemoPanel } from '../../_shared/demo/use-demo-panel';
import { CompaniesTab } from './components/companies-tab';
import { ImportTab } from './components/import-tab';
import { LogTab } from './components/log-tab';
import { ModulesTab } from './components/modules-tab';

export default function AccessManagementPage() {
  const { enabled } = useDemoPanel();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return null;
  if (!enabled) notFound();

  return (
    <div className="space-y-8">
      <div
        role="note"
        className="portal-small rounded-lg border border-dashed border-portal-neutral bg-card px-4 py-3 text-portal-neutral"
      >
        Tela da Freitas simulada — no produto real ela fica no Centrix interno. Só aparece com o modo de
        demonstração ligado; o cliente não tem acesso a ela.
      </div>
      <PagePortalHeader
        title="Gestão de acessos"
        subtitle="Empresas, contatos, convites e módulos liberados por cliente. Tudo fica neste navegador."
      />
      <div
        role="note"
        className="flex gap-3 rounded-lg border border-portal-warning/40 bg-portal-warning/10 px-4 py-3"
      >
        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-portal-warning-ink" />
        <p className="portal-body text-portal-warning-ink">
          No produto real a flag fica no servidor e o backend recusa chamada de módulo desligado; aqui só esconde
          a tela.
        </p>
      </div>

      <Tabs defaultValue="empresas" className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="h-auto">
            <TabsTrigger value="empresas" className="min-h-11">Empresas</TabsTrigger>
            <TabsTrigger value="importar" className="min-h-11">Importar CSV</TabsTrigger>
            <TabsTrigger value="modulos" className="min-h-11">Módulos</TabsTrigger>
            <TabsTrigger value="registro" className="min-h-11">Registro</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="empresas">
          <CompaniesTab />
        </TabsContent>
        <TabsContent value="importar">
          <ImportTab />
        </TabsContent>
        <TabsContent value="modulos">
          <ModulesTab />
        </TabsContent>
        <TabsContent value="registro">
          <LogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
