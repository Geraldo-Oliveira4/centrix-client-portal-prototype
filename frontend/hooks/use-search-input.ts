import { useState } from 'react';
import { useDebounce } from './use-debounce';

// Standard search-input pattern for kanban filters: `inputValue` drives the
// controlled <Input> (instant, keeps focus) while `debouncedValue` is what the
// SWR key should depend on, so typing never refetches per keystroke. Any new
// kanban (cotacao, embarques, PO, ...) should build its search on top of this.
export function useSearchInput(initialValue = '', delay = 500) {
  const [inputValue, setInputValue] = useState(initialValue);
  const debouncedValue = useDebounce(inputValue, delay);
  return { inputValue, setInputValue, debouncedValue };
}
