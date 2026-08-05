'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ALL_ALERT_TYPES,
  type AlertType,
} from '../embarques/lib/shipment-alerts';

/**
 * Preferência de "quais alertas quero receber", compartilhada por Meus
 * Embarques > Alertas e Minhas Preferências > Notificações.
 *
 * Existe como módulo único porque as duas telas editam A MESMA coisa: duas
 * cópias da leitura/escrita do localStorage divergiriam no primeiro tipo novo
 * de alerta, e o cliente veria um switch ligado numa tela e desligado na outra.
 *
 * POR QUE localStorage E NÃO BANCO: o feed de alertas do portal é ilustrativo,
 * montado no frontend sobre os embarques que o cliente já tem
 * (`lib/shipment-alerts.ts`). Não existe serviço que dispare e-mail ou push a
 * partir desta escolha. Persistir no backend daria a entender que a Freitas
 * passa a notificar conforme o switch, o que não acontece — quando o disparo
 * real existir, o que muda é a fonte destas quatro chaves, não a tela.
 *
 * A chave é versionada: uma lista salva antes de "Risco de demurrage/detention"
 * existir nomeia só os três primeiros tipos, e restaurá-la deixaria o único
 * alerta com custo financeiro desligado sem o cliente saber. Bump de novo se um
 * tipo futuro não puder herdar opt-out antigo.
 */
export const ALERT_TYPES_STORAGE_KEY = 'portal:shipment-alerts:types:v2';

export function useAlertTypePreferences() {
  // Semeado depois do mount (nunca no initial state) para o HTML do servidor e
  // o do cliente baterem: no servidor não existe localStorage.
  const [enabledList, setEnabledList] = useState<AlertType[]>(ALL_ALERT_TYPES);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ALERT_TYPES_STORAGE_KEY);
      if (stored) setEnabledList(JSON.parse(stored));
    } catch {
      // storage corrompido ou indisponível — o padrão (todos ligados) vale
    }
  }, []);

  const enabledTypes = useMemo(() => new Set(enabledList), [enabledList]);

  const toggleType = useCallback((type: AlertType) => {
    setEnabledList((current) => {
      const next = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      try {
        localStorage.setItem(ALERT_TYPES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignora falha de escrita: a sessão atual continua consistente
      }
      return next;
    });
  }, []);

  return { enabledList, enabledTypes, toggleType };
}
