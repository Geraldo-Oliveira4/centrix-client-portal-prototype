import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from './use-debounce';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions<TValues, TPayload> {
  id: string | null;
  values: TValues | null;
  buildPayload: (values: TValues) => TPayload;
  save: (id: string, payload: TPayload, silent: boolean) => Promise<unknown | null>;
  onSaved?: () => void;
  enabled?: boolean;
  debounceMs?: number;
}

// Generic debounced autosave: fires `save(id, buildPayload(values), true)` whenever
// `values` settles after `debounceMs` and differs from the last known-saved value.
// The first value received after mount (or after a null->value transition, e.g.
// data still loading) only seeds the baseline — it never triggers a save. Call
// `markAsSaved(values)` explicitly whenever fresh values arrive from the server
// (e.g. after the initial fetch) to avoid re-saving what was just received.
export function useAutosave<TValues, TPayload>({
  id,
  values,
  buildPayload,
  save,
  onSaved,
  enabled = true,
  debounceMs = 2000,
}: UseAutosaveOptions<TValues, TPayload>) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const baselineRef = useRef<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedValues = useDebounce(values, debounceMs);

  useEffect(() => {
    if (!id || debouncedValues === null || !enabled) return;

    const currentJson = JSON.stringify(debouncedValues);

    if (baselineRef.current === null) {
      // First values received — establish baseline without saving
      baselineRef.current = currentJson;
      return;
    }

    if (currentJson === baselineRef.current) return;

    setStatus('saving');
    const payload = buildPayload(debouncedValues);

    save(id, payload, true).then((result) => {
      if (result) {
        baselineRef.current = currentJson;
        setStatus('saved');
        onSaved?.();
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus('idle'), 5000);
      }
    });
  }, [debouncedValues, id, enabled, buildPayload, save, onSaved]);

  // Call this after receiving fresh data from the server to prevent re-saving it
  const markAsSaved = useCallback((values: TValues) => {
    baselineRef.current = JSON.stringify(values);
    setStatus('idle');
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  return { autoSaveStatus: status, markAsSaved };
}
