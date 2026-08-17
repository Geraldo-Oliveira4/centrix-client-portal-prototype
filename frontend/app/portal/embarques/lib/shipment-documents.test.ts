// Unit test do dossiê do embarque. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// Duas coisas aqui erram em silêncio se ninguém olhar: um documento aparecendo
// antes da etapa que o gera (BL num embarque que nem saiu da origem) e uma data
// de upload no futuro — a única data da tela que o cliente consegue provar que
// está errada só de olhar o calendário.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLocalDocumentActions,
  buildShipmentDocuments,
  formatFileSize,
  pendingClientDocuments,
} from './shipment-documents.ts';
import { buildTimelineSteps } from './timeline-steps.ts';

const REAL_STEPS = [
  { key: 'solicitado', label: 'Solicitado', description: '' },
  { key: 'aguardando_prontidao', label: 'Aguardando prontidão', description: '' },
  { key: 'coletado', label: 'Coletado', description: '' },
  { key: 'analise_booking', label: 'Em análise de booking', description: '' },
  { key: 'embarcado', label: 'Embarcado', description: '' },
];

const NOW = new Date('2026-08-20T00:00:00Z');
const CREATED = '2026-08-01T00:00:00Z';

const docsFor = ({ estado = 'solicitado', isException = false, milestone = null } = {}) =>
  buildShipmentDocuments({
    referencia: 'EMB-2026-0001',
    createdAt: CREATED,
    steps: buildTimelineSteps({
      estado,
      realSteps: REAL_STEPS,
      isException,
      milestone,
    }),
    now: NOW,
  });

const types = (documents) => documents.map((d) => d.type);
const byType = (documents, type) => documents.find((d) => d.type === type);

test('embarque recém-aberto só cobra o que o importador deve', () => {
  const documents = docsFor({ estado: 'solicitado' });
  assert.deepEqual(types(documents).sort(), ['INVOICE', 'PACKING_LIST']);
  documents.forEach((d) => {
    assert.equal(d.status, 'pendente');
    assert.equal(d.fileName, null);
    assert.equal(d.uploadedAt, null);
    assert.equal(d.sizeBytes, null);
  });
});

test('o BL não existe antes de a carga embarcar', () => {
  assert.equal(byType(docsFor({ estado: 'coletado' }), 'BL'), undefined);
  assert.ok(byType(docsFor({ estado: 'embarcado' }), 'BL'));
});

test('documento da Freitas nasce em análise e fecha quando a etapa passa', () => {
  const emTransito = docsFor({ estado: 'embarcado', milestone: 'OCEAN_TRANSIT' });
  assert.equal(byType(emTransito, 'BL').status, 'em_analise');

  const chegou = docsFor({ estado: 'embarcado', milestone: 'ARRIVAL' });
  assert.equal(byType(chegou, 'BL').status, 'aprovado');
});

test('documento entregue pelo cliente sai da fila de pendências', () => {
  const documents = docsFor({ estado: 'analise_booking' });
  assert.equal(byType(documents, 'INVOICE').status, 'aprovado');
  assert.deepEqual(
    pendingClientDocuments(documents).map((d) => d.type),
    [],
  );
});

test('o pendente do cliente é o que a etapa cobra — e só o dele', () => {
  const documents = docsFor({ estado: 'embarcado', milestone: 'OCEAN_TRANSIT' });
  const pending = pendingClientDocuments(documents);
  assert.deepEqual(types(pending), ['CERTIFICADO_ORIGEM']);
  assert.equal(pending[0].requiredForStep, 'chegada');
  // A etapa cobrada tem de existir na linha, senão o gatilho não tem onde cair.
  assert.ok(REAL_STEPS.concat([{ key: 'chegada' }]).some((s) => s.key === 'chegada'));
});

test('nenhuma data de upload é futura', () => {
  const documents = docsFor({ estado: 'embarcado', milestone: 'AVAILABLE' });
  documents.forEach((d) => {
    if (!d.uploadedAt) return;
    assert.ok(new Date(d.uploadedAt) <= NOW, `${d.type} tem data futura`);
    assert.ok(new Date(d.uploadedAt) >= new Date(CREATED));
  });
});

test('exceção congela a linha sem esconder os documentos do cliente', () => {
  const documents = docsFor({ estado: 'postergado', isException: true });
  assert.deepEqual(types(documents).sort(), ['INVOICE', 'PACKING_LIST']);
  assert.equal(documents.every((d) => d.status === 'pendente'), true);
});

test('pendências primeiro: a lista abre no que trava o embarque', () => {
  const documents = docsFor({ estado: 'embarcado', milestone: 'OCEAN_TRANSIT' });
  assert.equal(documents[0].status, 'pendente');
});

test('mesmo embarque, mesmo arquivo: nada é sorteado em tempo de render', () => {
  const a = byType(docsFor({ estado: 'embarcado' }), 'DRAFT_BL');
  const b = byType(docsFor({ estado: 'embarcado' }), 'DRAFT_BL');
  assert.equal(a.sizeBytes, b.sizeBytes);
  assert.equal(a.fileName, 'draft-bl-EMB-2026-0001.pdf');
});

// --- Efeito local do modal (fake-success) ------------------------------------
//
// É a transição de estado que o modal dispara. Fica testada aqui, e não no
// componente, porque o modal é casca: ele chama `onConfirm` e quem move o
// documento é esta função. Um erro aqui não estoura na tela — ele deixa a faixa
// de ação pedindo o arquivo que a lista logo abaixo já mostra como enviado.

const applied = (documents, overrides = {}) =>
  applyLocalDocumentActions({
    documents,
    referencia: 'EMB-2026-0001',
    submittedIds: [],
    bookingApproved: false,
    now: NOW,
    ...overrides,
  });

test('enviar avança UM degrau: pendente -> em análise, nunca direto para aprovado', () => {
  const documents = docsFor({ estado: 'solicitado' });
  const invoice = byType(documents, 'INVOICE');
  assert.equal(invoice.status, 'pendente');

  const after = applied(documents, { submittedIds: [invoice.id] });
  const sent = byType(after, 'INVOICE');
  assert.equal(sent.status, 'em_analise');
  // Quem valida é a Freitas; o clique do próprio cliente não aprova o arquivo
  // dele — é a etapa que dá nome à Aprovação Documental.
  assert.notEqual(sent.status, 'aprovado');
  // Passa a ter arquivo: sem isso a linha ficaria "Em análise" sem nada em análise.
  assert.equal(sent.fileName, 'invoice-EMB-2026-0001.pdf');
  assert.equal(sent.uploadedAt, NOW.toISOString());
  assert.ok(sent.sizeBytes > 0);
});

test('documento enviado sai da fila de pendências — a faixa de ação some junto', () => {
  const documents = docsFor({ estado: 'solicitado' });
  assert.equal(pendingClientDocuments(documents).length, 2);

  const after = applied(documents, {
    submittedIds: documents.map((d) => d.id),
  });
  assert.deepEqual(pendingClientDocuments(after), []);
});

test('só o documento clicado muda, e a lista se reordena com ele', () => {
  const documents = docsFor({ estado: 'solicitado' });
  const invoice = byType(documents, 'INVOICE');
  const after = applied(documents, { submittedIds: [invoice.id] });

  assert.equal(byType(after, 'PACKING_LIST').status, 'pendente');
  // Pendências primeiro: o que ainda falta sobe, o enviado desce.
  assert.equal(after[0].type, 'PACKING_LIST');
  assert.equal(after.length, documents.length);
});

test('aprovar booking fecha o booking confirmado, e não toca em mais nada', () => {
  const documents = docsFor({ estado: 'analise_booking' });
  assert.equal(byType(documents, 'BOOKING_CONFIRMATION').status, 'em_analise');

  const after = applied(documents, { bookingApproved: true });
  assert.equal(byType(after, 'BOOKING_CONFIRMATION').status, 'aprovado');
  // Nenhum outro tipo muda de status por causa da aprovação de booking.
  documents
    .filter((d) => d.type !== 'BOOKING_CONFIRMATION')
    .forEach((d) => assert.equal(byType(after, d.type).status, d.status));
});

test('sem clique nenhum a lista é a mesma referência — nada de re-render à toa', () => {
  const documents = docsFor({ estado: 'analise_booking' });
  assert.equal(applied(documents), documents);
});

test('id desconhecido e documento já entregue não fabricam mudança', () => {
  const documents = docsFor({ estado: 'analise_booking' });
  const invoice = byType(documents, 'INVOICE');
  assert.equal(invoice.status, 'aprovado');

  const after = applied(documents, {
    submittedIds: [invoice.id, 'EMB-2026-0001:NAO_EXISTE'],
  });
  assert.equal(byType(after, 'INVOICE').status, 'aprovado');
  assert.equal(after.length, documents.length);
});

test('tamanho de arquivo legível nas duas ordens de grandeza', () => {
  assert.equal(formatFileSize(840_000), '840 KB');
  assert.equal(formatFileSize(1_240_000), '1,2 MB');
});
