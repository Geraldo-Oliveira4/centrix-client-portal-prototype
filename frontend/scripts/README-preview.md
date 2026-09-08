# Prévia local — Meus Embarques

Cenários fictícios para revisão visual. Nenhuma conexão ao banco do projeto.
A API aceita somente GET/OPTIONS e recalcula datas ao iniciar.

1. Em `frontend/.env.local`: `NEXT_PUBLIC_API=http://localhost:8011`.
2. Em um terminal, dentro de `frontend`: `npm run preview:api`.
3. Em outro terminal: `npm run dev -- --port 3011 --hostname 127.0.0.1`.
4. Abrir http://localhost:3011/portal/embarques.

Esta API cobre lista/detalhe de embarques, cotações vinculadas e identidade demo.
Os demais módulos e operações de escrita precisam do backend completo.

Validação: `npm run test:unit` e `npx tsc --noEmit --incremental false`.
