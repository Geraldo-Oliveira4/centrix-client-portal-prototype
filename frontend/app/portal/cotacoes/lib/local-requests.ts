'use client';
import { useEffect, useState } from 'react';
import { upsertRequest, type LocalRequest } from './repeat-model';
const eventName = 'centrix-local-requests';
const key = (clientId: string) => `centrix-repeat-requests-v1:${clientId}`;
function read(clientId: string): LocalRequest[] {
  const rows = JSON.parse(localStorage.getItem(key(clientId)) || '[]');
  if (
    !Array.isArray(rows) ||
    rows.some(
      (row) =>
        !row?.id ||
        !row.sourceId ||
        !row.quote?.manualDraft ||
        !Array.isArray(row.agents),
    )
  )
    throw new Error('invalid drafts');
  return rows;
}
export function saveLocalRequest(clientId: string, request: LocalRequest) {
  const rows = upsertRequest(read(clientId), request);
  localStorage.setItem(key(clientId), JSON.stringify(rows));
  window.dispatchEvent(new Event(eventName));
}
export function useLocalRequests(clientId?: string) {
  const [rows, setRows] = useState<LocalRequest[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setRows([]);
    setLoaded(false);
    if (!clientId) return;
    const load = () => {
      try {
        setRows(read(clientId));
        setError('');
      } catch {
        setError(
          'Não foi possível recuperar os rascunhos locais. Nenhum dado salvo será substituído.',
        );
      }
      setLoaded(true);
    };
    load();
    window.addEventListener('storage', load);
    window.addEventListener(eventName, load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(eventName, load);
    };
  }, [clientId]);
  return { rows, error, loaded };
}
