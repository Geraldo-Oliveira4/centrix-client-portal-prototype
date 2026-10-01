'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Copy, Download, FileUp, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  CSV_TEMPLATE_FULL,
  CSV_TEMPLATE_SHORT,
  csvErrorReport,
  importAccessCsv,
  parseAccessCsv,
  type CsvParseResult,
} from '../../../_shared/demo/access-csv';
import { CLIENT_KIND_LABELS, applyWaveToCompany } from '../../../_shared/demo/access-model';
import { readAccessState, useAccessState, writeAccessState } from '../../../_shared/demo/use-access';
import { useGlobalModuleFlags } from '../../../_shared/demo/use-feature-flags';

const templateHref = (csv: string) => `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${csv}`)}`;

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado.`);
  } catch {
    toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
  }
}

export function ImportTab() {
  const state = useAccessState();
  const global = useGlobalModuleFlags();
  const [text, setText] = useState('');
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const check = (csv: string) => {
    setText(csv);
    setResult(csv.trim() ? parseAccessCsv(csv, state) : null);
  };

  const readFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => check(String(reader.result ?? ''));
    reader.onerror = () => toast.error('Não foi possível ler o arquivo.');
    reader.readAsText(file, 'utf-8');
  };

  const valid = result?.rows.filter((r) => r.ok).length ?? 0;
  const invalid = (result?.rows.length ?? 0) - valid;
  const report = result ? csvErrorReport(result.rows) : '';

  const doImport = () => {
    if (!result) return;
    // Revalida contra o estado de AGORA: outra aba pode ter mudado a lista.
    const fresh = readAccessState();
    const reparsed = parseAccessCsv(text, fresh);
    const out = importAccessCsv(fresh, reparsed.rows, new Date().toISOString(), (company, wave) =>
      applyWaveToCompany(company, global, wave),
    );
    writeAccessState(out.state);
    toast.success(
      `${out.addedContacts} contato(s) importado(s) em ${out.createdCompanies} empresa(s) nova(s). Ninguém foi convidado ainda.`,
    );
    setResult(parseAccessCsv(text, out.state));
  };

  return (
    <div className="space-y-6">
      <section className="portal-card space-y-4 p-4 sm:p-6">
        <h2 className="portal-h3">1. Baixe ou copie o modelo</h2>
        <p className="portal-body text-portal-neutral">
          Uma linha por pessoa. A mesma empresa em várias linhas vira uma empresa com vários contatos. O
          formato curto (cliente, e-mail, nome) também é aceito; tipo, onda, responsável e demonstração são
          opcionais. Tipo aceita “{CLIENT_KIND_LABELS.freitas}” ou “{CLIENT_KIND_LABELS.saas}”; onda, de 0 a 3.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <a href={templateHref(CSV_TEMPLATE_FULL)} download="modelo-acessos-completo.csv">
              <Download className="mr-1.5 h-5 w-5" /> Modelo completo
            </a>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <a href={templateHref(CSV_TEMPLATE_SHORT)} download="modelo-acessos-curto.csv">
              <Download className="mr-1.5 h-5 w-5" /> Modelo curto
            </a>
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => copy(CSV_TEMPLATE_FULL, 'Modelo')}>
            <Copy className="mr-1.5 h-5 w-5" /> Copiar modelo
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => check(CSV_TEMPLATE_FULL + '\nEmpresa Sem Email,,,,Pessoa Teste,email-invalido\n,,,,Sem Empresa,sem.empresa@teste.example\nMetalúrgica Aurora Ltda.,,,,Repetida,ana.souza@aurora-metal.example')}>
            Usar exemplo com erros
          </Button>
        </div>
      </section>

      <section className="portal-card space-y-4 p-4 sm:p-6">
        <h2 className="portal-h3">2. Envie o arquivo ou cole o conteúdo</h2>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          id="csv-arquivo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = '';
          }}
        />
        <Button variant="outline" className="min-h-11" onClick={() => fileInput.current?.click()}>
          <FileUp className="mr-1.5 h-5 w-5" /> Selecionar CSV
        </Button>
        {fileName && <p className="portal-small text-portal-neutral">Arquivo: {fileName}</p>}
        <div className="space-y-2">
          <Label htmlFor="csv-texto">Conteúdo</Label>
          <Textarea
            id="csv-texto"
            rows={6}
            value={text}
            onChange={(e) => check(e.target.value)}
            className="font-mono text-xs"
            placeholder="empresa,cnpj,tipo_cliente,onda,nome,email,responsavel,demo"
          />
        </div>
      </section>

      {result && (
        <section className="portal-card space-y-4 p-4 sm:p-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="portal-h3">3. Confira linha a linha</h2>
            {result.format && (
              <span className="portal-small text-portal-neutral">Formato {result.format}</span>
            )}
          </div>
          {result.fileError ? (
            <p className="portal-body text-portal-danger-ink">{result.fileError}</p>
          ) : (
            <>
              <p className="portal-body">
                <span className="font-medium text-portal-success-ink">{valid} válida(s)</span> ·{' '}
                <span className={cn('font-medium', invalid ? 'text-portal-danger-ink' : 'text-portal-neutral')}>
                  {invalid} com erro
                </span>
                . Só as válidas entram; as outras ficam no relatório.
              </p>
              <div className="overflow-x-auto">
                <table className="portal-small w-full min-w-[40rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-portal-neutral">
                      <th className="py-2 pr-3 font-medium">Linha</th>
                      <th className="py-2 pr-3 font-medium">Empresa</th>
                      <th className="py-2 pr-3 font-medium">Pessoa</th>
                      <th className="py-2 pr-3 font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.line} className="border-b border-border align-top">
                        <td className="py-2 pr-3">{row.line}</td>
                        <td className="py-2 pr-3">{row.data.company || '—'}</td>
                        <td className="py-2 pr-3">
                          {row.data.name || '—'}
                          <span className="block break-all text-portal-neutral">{row.data.email || '—'}</span>
                        </td>
                        <td className="py-2 pr-3">
                          {row.ok ? (
                            <span className="inline-flex items-center gap-1 text-portal-success-ink">
                              <CheckCircle2 className="h-4 w-4" /> Pronta
                            </span>
                          ) : (
                            <span className="inline-flex items-start gap-1 text-portal-danger-ink">
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {row.errors.join(' ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" disabled={!valid} onClick={doImport}>
                  Importar {valid} linha(s) válida(s)
                </Button>
                {invalid > 0 && (
                  <Button variant="outline" className="min-h-11" onClick={() => copy(report, 'Relatório de erros')}>
                    <Copy className="mr-1.5 h-5 w-5" /> Copiar relatório de erros
                  </Button>
                )}
              </div>
              {invalid > 0 && (
                <pre className="portal-small overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3">
                  {report}
                </pre>
              )}
              <p className="portal-small text-portal-neutral">
                Importar cria os contatos como “Não convidado”. Convidar é uma ação à parte, na aba Empresas — e
                aqui é simulada: nenhum e-mail sai deste navegador.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
