import { useEffect, Dispatch, SetStateAction } from 'react';
import { useSearchInput } from './use-search-input';

// Encapsulated variant of the search-input pattern used by the cotacao kanban:
// keeps a local input value (via useSearchInput) but two-way syncs with an
// external value and commits the debounced result to the parent through onCommit.
export function useDebouncedFilter(
  externalValue: string,
  onCommit: (v: string) => void,
  delay = 500,
): [string, Dispatch<SetStateAction<string>>] {
  // useSearchInput only honors externalValue on mount (useState initial arg);
  // this effect is what actually resyncs it on every later external change.
  const { inputValue, setInputValue, debouncedValue } = useSearchInput(externalValue, delay);

  useEffect(() => { setInputValue(externalValue); }, [externalValue]);

  useEffect(() => {
    if (debouncedValue !== externalValue) onCommit(debouncedValue);
  }, [debouncedValue, externalValue, onCommit]);

  return [inputValue, setInputValue];
}
