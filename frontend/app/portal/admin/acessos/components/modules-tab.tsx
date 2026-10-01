'use client';

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import {
  EMPTY_COMPANY_FILTER,
  WAVE_NUMBERS,
  appendLog,
  applyWaveToCompany,
  clearCompanyModule,
  filterCompanies,
  flagLabel,
  isException,
  previewWave,
  resolveCompanyFlags,
  setCompanyModule,
  type AccessCompany,
  type CompanyFilter,
  type WaveNumber,
} from '../../../_shared/demo/access-model';
import {
  PORTAL_MODULES,
  PORTAL_MODULE_LABELS,
  type PortalModule,
} from '../../../_shared/demo/feature-flags';
import {
  updateAccessState,
  useAccessState,
} from '../../../_shared/demo/use-access';
import {
  setPortalModuleFlag,
  useGlobalModuleFlags,
} from '../../../_shared/demo/use-feature-flags';
import { CompanyFilterBar, DemoSeal, KindBadge } from './shared';

const list = (modules: PortalModule[]) =>
  modules.map((m) => PORTAL_MODULE_LABELS[m]).join(', ');

export function ModulesTab() {
  const state = useAccessState();
  const global = useGlobalModuleFlags();
  const [filter, setFilter] = useState<CompanyFilter>(EMPTY_COMPANY_FILTER);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingWave, setPendingWave] = useState<WaveNumber | null>(null);
  const now = useMemo(() => new Date(), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const companies = filterCompanies(state.companies, filter, now);
  const visibleSelected = selected.filter((id) =>
    companies.some((c) => c.id === id),
  );
  const preview =
    pendingWave === null
      ? null
      : previewWave(state.companies, visibleSelected, global, pendingWave);

  const setCell = (
    company: AccessCompany,
    module: PortalModule,
    released: boolean,
  ) => {
    const at = new Date().toISOString();
    updateAccessState((s) => {
      const before = company.exceptions[module];
      const next = {
        ...s,
        companies: s.companies.map((c) =>
          c.id === company.id
            ? setCompanyModule(c, global, module, released)
            : c,
        ),
      };
      const after = next.companies.find((c) => c.id === company.id)!.exceptions[
        module
      ];
      return appendLog(next, {
        at,
        companyId: company.id,
        companyName: company.name,
        what: `Módulo ${PORTAL_MODULE_LABELS[module]}`,
        from: flagLabel(before),
        to: flagLabel(after),
      });
    });
  };

  const resetCell = (company: AccessCompany, module: PortalModule) => {
    const at = new Date().toISOString();
    updateAccessState((s) =>
      appendLog(
        {
          ...s,
          companies: s.companies.map((c) =>
            c.id === company.id ? clearCompanyModule(c, module) : c,
          ),
        },
        {
          at,
          companyId: company.id,
          companyName: company.name,
          what: `Módulo ${PORTAL_MODULE_LABELS[module]}: voltar ao padrão`,
          from: flagLabel(company.exceptions[module]),
          to: 'padrão',
        },
      ),
    );
  };

  const setGlobal = (module: PortalModule, released: boolean) => {
    setPortalModuleFlag(global, module, released);
    const at = new Date().toISOString();
    updateAccessState((s) =>
      appendLog(s, {
        at,
        companyId: '*',
        companyName: 'Padrão global',
        what: `Módulo ${PORTAL_MODULE_LABELS[module]}`,
        from: global[module] ? 'ligado' : 'desligado',
        to: released ? 'ligado' : 'desligado',
      }),
    );
  };

  const confirmWave = () => {
    if (pendingWave === null) return;
    const wave = pendingWave;
    const at = new Date().toISOString();
    updateAccessState((s) => {
      let next = s;
      for (const id of visibleSelected) {
        const company = next.companies.find((c) => c.id === id);
        if (!company) continue;
        next = {
          ...next,
          companies: next.companies.map((c) =>
            c.id === id ? applyWaveToCompany(c, global, wave) : c,
          ),
        };
        next = appendLog(next, {
          at,
          companyId: company.id,
          companyName: company.name,
          what: 'Onda aplicada',
          from: company.wave === null ? 'sem onda' : `onda ${company.wave}`,
          to: `onda ${wave}`,
        });
      }
      return next;
    });
    toast.success(
      `Onda ${wave} aplicada a ${visibleSelected.length} empresa(s).`,
    );
    setPendingWave(null);
  };

  const allChecked =
    companies.length > 0 && companies.every((c) => selected.includes(c.id));

  return (
    <div className="space-y-6">
      <CompanyFilterBar value={filter} onChange={setFilter} />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4">
        <span className="portal-body font-medium">
          {visibleSelected.length} empresa(s) selecionada(s)
        </span>
        <span className="portal-small text-portal-neutral">Aplicar onda:</span>
        {WAVE_NUMBERS.map((wave) => (
          <Button
            key={wave}
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9"
            disabled={!visibleSelected.length}
            onClick={() => setPendingWave(wave)}
          >
            Onda {wave}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="portal-small w-full min-w-[58rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-portal-neutral">
              <th className="w-10 p-3">
                <Checkbox
                  aria-label="Selecionar todas as empresas visíveis"
                  checked={allChecked}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? companies.map((c) => c.id) : [])
                  }
                />
              </th>
              <th className="p-3 font-medium">Empresa</th>
              {PORTAL_MODULES.map((module) => (
                <th key={module} className="p-3 text-center font-medium">
                  {PORTAL_MODULE_LABELS[module]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b-2 border-border bg-muted/40">
              <td className="p-3" />
              <td className="p-3">
                <p className="portal-body font-medium">Padrão global</p>
                <p className="text-portal-neutral">
                  Vale para toda empresa sem exceção
                </p>
              </td>
              {PORTAL_MODULES.map((module) => (
                <td key={module} className="p-3 text-center">
                  <Switch
                    aria-label={`Padrão global: ${PORTAL_MODULE_LABELS[module]}`}
                    checked={global[module]}
                    onCheckedChange={(checked) => setGlobal(module, checked)}
                  />
                </td>
              ))}
            </tr>
            {companies.map((company) => {
              const resolved = resolveCompanyFlags(global, company);
              return (
                <tr
                  key={company.id}
                  className="border-b border-border align-top"
                >
                  <td className="p-3">
                    <Checkbox
                      aria-label={`Selecionar ${company.name}`}
                      checked={selected.includes(company.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked
                            ? [...prev, company.id]
                            : prev.filter((id) => id !== company.id),
                        )
                      }
                    />
                  </td>
                  <td className="p-3">
                    <p className="portal-body font-medium">{company.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <KindBadge kind={company.kind} />
                      <span className="text-portal-neutral">
                        {company.wave === null
                          ? 'Sem onda'
                          : `Onda ${company.wave}`}
                      </span>
                      {company.demo && <DemoSeal />}
                    </div>
                  </td>
                  {PORTAL_MODULES.map((module) => {
                    const exception = isException(global, company, module);
                    return (
                      <td
                        key={module}
                        className={cn(
                          'p-3 text-center',
                          exception &&
                            'bg-portal-warning/10 outline outline-1 -outline-offset-4 outline-portal-warning',
                        )}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Switch
                            aria-label={`${company.name}: ${PORTAL_MODULE_LABELS[module]}`}
                            checked={resolved[module]}
                            onCheckedChange={(checked) =>
                              setCell(company, module, checked)
                            }
                          />
                          {exception ? (
                            <>
                              <span className="font-medium text-portal-warning-ink">
                                exceção
                              </span>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-brand-indigo underline underline-offset-2"
                                onClick={() => resetCell(company, module)}
                                aria-label={`Voltar ao padrão: ${company.name}, ${PORTAL_MODULE_LABELS[module]}`}
                              >
                                <RotateCcw className="h-4 w-4" /> padrão
                              </button>
                            </>
                          ) : (
                            <span className="text-portal-neutral">padrão</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="portal-small text-portal-neutral">
        Célula marcada como “exceção” foge do padrão global para aquela empresa.
        Mudar o padrão global não apaga exceções; uma exceção igual ao novo
        padrão deixa de aparecer como exceção.
      </p>

      <AlertDialog
        open={pendingWave !== null}
        onOpenChange={(open) => !open && setPendingWave(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Aplicar onda {pendingWave} a {preview?.companies ?? 0} empresa(s)?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {preview && preview.changing === 0 ? (
                  <p>
                    Nenhuma das empresas selecionadas muda de módulo: todas já
                    estão nessa onda.
                  </p>
                ) : (
                  <>
                    <p>{preview?.changing} empresa(s) mudam de módulo.</p>
                    {preview && preview.turnOn.length > 0 && (
                      <p>Ligam: {list(preview.turnOn)}.</p>
                    )}
                    {preview && preview.turnOff.length > 0 && (
                      <p>Desligam: {list(preview.turnOff)}.</p>
                    )}
                  </>
                )}
                <p>
                  Simulado: a tela do cliente passa a esconder os módulos
                  desligados. No produto real, o servidor recusaria as chamadas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmWave}>
              Aplicar onda {pendingWave}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
