# Guia de Mock Data - Centrix Frontend

Este guia explica como usar o sistema de dados mockados para desenvolvimento e testes do frontend.

## 🎯 Objetivo

Permitir o desenvolvimento e teste do frontend sem depender do backend, usando dados mockados que simulam respostas reais da API.

## 🔧 Como Ativar/Desativar

### ⚡ Mock Seletivo por Feature (Recomendado)

O sistema permite ativar mock **apenas para features ainda não implementadas** no backend, enquanto mantém funcionalidades existentes (auth, users, logs) usando a API real.

Edite o arquivo `.env`:

```env
# API real (sempre ativo)
NEXT_PUBLIC_API=https://centrix-func-dev.azurewebsites.net/api

# Mock apenas para features novas (ainda sem backend)
NEXT_PUBLIC_MOCK_EXTRACTIONS=true   # Extrações, upload, queue
NEXT_PUBLIC_MOCK_DASHBOARD=true     # Dashboard stats, pipeline
NEXT_PUBLIC_MOCK_ANALYTICS=true     # Clusters, compare, benchmark
```

**Funcionalidades que SEMPRE usam API real:**

- ✅ Login / Registro / Reset de senha
- ✅ Gerenciamento de usuários
- ✅ Logs do sistema
- ✅ Pré-registro de usuários
- ✅ Configs

### Desativar Mock (tudo via API real)

```env
NEXT_PUBLIC_MOCK_EXTRACTIONS=false
NEXT_PUBLIC_MOCK_DASHBOARD=false
NEXT_PUBLIC_MOCK_ANALYTICS=false
```

Ou remova as variáveis completamente.

## 📁 Arquivos do Sistema de Mock

### 1. `/lib/mock-data.ts`

Contém todos os dados mockados para os diferentes endpoints:

- `mockDashboardStats` - Estatísticas do dashboard
- `mockPipelineStatus` - Status do pipeline de processamento
- `mockExtractionsResponse` - Lista de extrações
- `mockExtractionDetail` - Detalhes de uma extração
- `mockQueueResponse` - Fila de processamento
- `mockSearchResponse` - Resultados de busca
- `mockCommentsResponse` - Comentários
- `mockChangelogResponse` - Histórico de mudanças
- `mockClustersResponse` - Clusters para analytics
- `mockComparisonResponse` - Comparação de contratos
- `mockBenchmarkResponse` - Benchmark de contrato

### 2. `/lib/use-mock.ts`

Utilitários para trabalhar com mock data:

- `useMockData()` - Hook que retorna se o modo mock está ativo
- `withMock(mockFn, realFn)` - Helper para executar mock ou função real

## 💻 Como Usar em Componentes

### Opção 1: Uso Direto com Feature Específica (Recomendado)

```tsx
'use client';

import { useMockData } from '@/lib/use-mock';
import { mockDashboardStats } from '@/lib/mock-data';

export default function DashboardPage() {
  // Mock APENAS para dashboard (não afeta auth, users, logs)
  const isMockMode = useMockData('dashboard');

  // Use dados mockados se ativo para esta feature
  const stats = isMockMode ? mockDashboardStats : null;

  // Render usando stats
  return <div>...</div>;
}
```

**Features disponíveis:**

- `'extractions'` - Extrações, upload, queue, search
- `'dashboard'` - Dashboard stats, pipeline
- `'analytics'` - Clusters, compare, benchmark

### Opção 2: Com Hooks Customizados

```tsx
import useSWR from 'swr';
import { withMock } from '@/lib/use-mock';
import { mockHandlers } from '@/lib/mock-data';
import base_api from '@/lib/axios-config';

export const useDashboard = () => {
  const fetcher = async () => {
    // withMock agora recebe a feature como primeiro parâmetro
    return await withMock(
      'dashboard',
      () => mockHandlers.getDashboardStats(),
      () => base_api.get('/dashboard/stats').then((r) => r.data),
    );
  };

  const { data, error } = useSWR('/dashboard/stats', fetcher);

  return {
    data,
    isLoading: !error && !data,
    isError: error,
  };
};
```

### Opção 3: Condicional no Componente (Desenvolvimento Rápido)

```tsx
'use client';

import { useMockData } from '@/lib/use-mock';
import { mockDashboardStats, mockPipelineStatus } from '@/lib/mock-data';

export default function DashboardPage() {
  // Mock apenas para dashboard
  const isMockMode = useMockData('dashboard');

  // Dados finais
  const stats = isMockMode ? mockDashboardStats : null;
  const pipeline = isMockMode ? mockPipelineStatus : null;

  // Quando backend estiver pronto:
  // const { stats, pipeline } = useDashboard();

  return <div>...</div>;
}
```

## 📝 Exemplo Completo: Home Page

A home page (`/app/home/page.tsx`) já está implementada usando mock seletivo:

```tsx
// Mock APENAS para dashboard (não afeta login, users, logs)
const isMockMode = useMockData('dashboard');
const stats = isMockMode ? mockDashboardStats : null;
const pipeline = isMockMode ? mockPipelineStatus : null;
```

Quando `NEXT_PUBLIC_MOCK_DASHBOARD=true`:

- ✅ Exibe um badge "🔧 Modo Mock Ativo"
- ✅ Dashboard usa dados mockados
- ✅ Login, users, logs continuam usando API real
- ✅ Não faz chamadas à API real para dashboard

## 🔄 Adicionando Novos Dados Mockados

1. Abra `/lib/mock-data.ts`
2. Adicione seus dados mockados seguindo as interfaces TypeScript:

```typescript
export const mockMyNewData: MyNewType = {
  field1: 'value1',
  field2: 123,
  // ... seguindo o type MyNewType
};

// Adicione ao objeto mockHandlers
export const mockHandlers = {
  // ... handlers existentes
  getMyNewData: async () => {
    await mockDelay();
    return mockMyNewData;
  },
};
```

## 🎨 Personalizando Delay de Network

Por padrão, há um delay de 300ms para simular latência de rede. Para alterar:

```typescript
// Em mock-data.ts
export const mockDelay = (
  ms: number = 500, // Aumentar para 500ms
) => new Promise((resolve) => setTimeout(resolve, ms));
```

Ou desabilitar completamente:

```typescript
export const mockDelay = (ms: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));
```

## 🧪 Testando Diferentes Cenários

Você pode criar múltiplos conjuntos de dados mockados para testar cenários diferentes:

```typescript
// mock-data.ts
export const mockDashboardStatsEmpty: DashboardStats = {
  totalExtractions: 0,
  totalDocuments: 0,
  // ... todos zeros
};

export const mockDashboardStatsError: DashboardStats = {
  // ... dados que simulam erro
};
```

E alternar entre eles no componente:

```tsx
const stats = isMockMode
  ? mockDashboardStatsEmpty // ou mockDashboardStatsError
  : realData.stats;
```

## 🚀 Workflow de Desenvolvimento Recomendado

1. **Início**: Ative mock apenas para features novas

   ```env
   NEXT_PUBLIC_MOCK_DASHBOARD=true
   NEXT_PUBLIC_MOCK_EXTRACTIONS=true
   ```

2. **Desenvolvimento**:

   - Funcionalidades novas (dashboard, extrações) usam mock
   - Funcionalidades existentes (login, users) usam API real
   - Você pode fazer login normalmente e ver dashboard mockado

3. **Ajustes**: Modifique dados mockados para testar edge cases

4. **Integração**: Desative mock feature por feature conforme backend fica pronto

   ```env
   NEXT_PUBLIC_MOCK_DASHBOARD=false  # Backend de dashboard pronto
   NEXT_PUBLIC_MOCK_EXTRACTIONS=true # Backend de extractions ainda não
   ```

5. **Produção**: Certifique-se que todos os mocks estão desativados

## ⚠️ Notas Importantes

- ✅ **Mock é seletivo**: Apenas features marcadas usam mock
- ✅ **Auth sempre real**: Login, registro, sessão sempre usam API real
- ✅ **Pode combinar**: Dashboard mockado + login real funciona perfeitamente
- **Nunca commite** `.env` com flags de mock para produção
- Mock data é apenas para **desenvolvimento/testes**
- Mantenha mock data **atualizado** com as interfaces TypeScript
- Use mock data para **testar edge cases** (listas vazias, erros, etc.)

## 🔍 Debug

Se o mock não estiver funcionando:

1. Verifique se `.env` tem a flag da feature ativa:
   ```env
   NEXT_PUBLIC_MOCK_DASHBOARD=true
   ```
2. Reinicie o servidor Next.js (`npm run dev`)
3. Verifique o console do navegador para:
   ```
   [MOCK MODE] Using mock data for: dashboard
   ```
4. Confirme que `useMockData('dashboard')` retorna `true`

**Importante:** Se você quer testar a home com dados mockados, mas ainda fazer login real:

- ✅ `NEXT_PUBLIC_MOCK_DASHBOARD=true` - Dashboard usa mock
- ✅ Auth/login continua funcionando normalmente
- ✅ Você faz login com credenciais reais e vê dashboard mockado

## 📊 Dados Mockados Disponíveis

| Endpoint                     | Mock Handler                         | Tipo de Retorno       |
| ---------------------------- | ------------------------------------ | --------------------- |
| `/dashboard/stats`           | `mockHandlers.getDashboardStats()`   | `DashboardStats`      |
| `/dashboard/pipeline`        | `mockHandlers.getPipelineStatus()`   | `PipelineStatus`      |
| `/extractions`               | `mockHandlers.getExtractions()`      | `ExtractionsResponse` |
| `/extractions/:id`           | `mockHandlers.getExtractionDetail()` | `Extraction`          |
| `/extractions/queue`         | `mockHandlers.getQueue()`            | `QueueResponse`       |
| `/search?q=...`              | `mockHandlers.search()`              | `SearchResponse`      |
| `/extractions/:id/comments`  | `mockHandlers.getComments()`         | `CommentsResponse`    |
| `/extractions/:id/changelog` | `mockHandlers.getChangelog()`        | `ChangelogResponse`   |
| `/analytics/clusters`        | `mockHandlers.getClusters()`         | `ClustersResponse`    |
| `/analytics/compare`         | `mockHandlers.getComparison()`       | `ComparisonResponse`  |
| `/analytics/benchmarks/:id`  | `mockHandlers.getBenchmark()`        | `BenchmarkResponse`   |

---

**Desenvolvido para facilitar o desenvolvimento frontend sem dependências de backend! 🚀**
