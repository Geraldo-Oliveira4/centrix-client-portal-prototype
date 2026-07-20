# 🎯 Setup Rápido - Sistema de Mock Seletivo

## ✅ Como Funciona Agora

### Antes (Problema)

```env
NEXT_PUBLIC_USE_MOCK_DATA=true  ❌ Mockava TUDO (inclusive login!)
```

### Agora (Solução)

```env
# Funcionalidades EXISTENTES sempre usam API REAL
✅ Login / Registro / Auth
✅ Gerenciamento de Usuários
✅ Logs do sistema
✅ Pré-registro

# Funcionalidades NOVAS usam MOCK (ainda sem backend)
NEXT_PUBLIC_MOCK_DASHBOARD=true      # Dashboard stats, pipeline
NEXT_PUBLIC_MOCK_EXTRACTIONS=true    # Extrações, upload, queue
NEXT_PUBLIC_MOCK_ANALYTICS=true      # Clusters, compare, benchmark
```

## 🚀 Quick Start

### 1. Configure o `.env`

```bash
# Já configurado! Apenas verifique:
NEXT_PUBLIC_API=https://centrix-func-dev.azurewebsites.net/api
NEXT_PUBLIC_MOCK_DASHBOARD=true
NEXT_PUBLIC_MOCK_EXTRACTIONS=true
NEXT_PUBLIC_MOCK_ANALYTICS=true
```

### 2. Reinicie o servidor

```bash
npm run dev
```

### 3. Teste o fluxo completo

1. **Login** → http://localhost:3000/login (API REAL ✅)
2. **Home** → http://localhost:3000/home (MOCK DASHBOARD 🔧)
3. **Users** → http://localhost:3000/users (API REAL ✅)

## 📊 O Que Você Vai Ver

### Na Home Page

- Badge "🔧 Modo Mock Ativo" (mostra que dashboard está em mock)
- Todos os widgets funcionando com dados realistas
- 45 extrações mockadas, pipeline, atividades, etc.

### Console do Navegador

```
[MOCK MODE] Using mock data for: dashboard
```

### Funcionalidades Reais

- Login funciona normalmente
- Gerenciamento de usuários funciona
- Logs funcionam
- Pré-registro funciona

## 🔄 Quando Backend Estiver Pronto

Desative mock feature por feature:

```env
# Dashboard backend pronto
NEXT_PUBLIC_MOCK_DASHBOARD=false

# Extractions ainda não
NEXT_PUBLIC_MOCK_EXTRACTIONS=true

# Analytics ainda não
NEXT_PUBLIC_MOCK_ANALYTICS=true
```

## 🎨 Benefícios

✅ **Desenvolvimento paralelo**: Frontend avança sem esperar backend
✅ **Teste de UI**: Validar componentes com dados realistas
✅ **Edge cases**: Testar cenários diferentes (listas vazias, erros)
✅ **Demo**: Mostrar protótipos funcionais
✅ **Sem conflito**: Login e auth continuam funcionando normalmente

## 📖 Documentação Completa

Ver `MOCK_DATA_GUIDE.md` para documentação detalhada.
