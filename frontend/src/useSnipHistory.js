import { useCallback, useEffect, useRef, useState } from 'react';
import { addToHistory, HISTORY_KEY, loadHistory } from './snipHistory.js';

export default function useSnipHistory() {
  const [history, setHistory] = useState(loadHistory);
  const currentItems = useRef(history.items);

  const save = useCallback((items) => {
    // Write only on history changes, never on typing or animation frames.
    let issue = null;
    try {
      if (items.length) window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
      else window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      issue = items.length ? 'save' : 'clear';
    }
    currentItems.current = items;
    setHistory({ items, issue });
  }, []);

  const remember = useCallback((link) => {
    save(addToHistory(currentItems.current, link));
  }, [save]);
  const remove = useCallback((shortUrl) => {
    save(currentItems.current.filter(item => item.shortUrl !== shortUrl));
  }, [save]);
  const clear = useCallback(() => save([]), [save]);

  useEffect(() => {
    function synchronize(event) {
      // The storage event is delivered to other tabs on the same origin.
      try {
        if (event.storageArea !== window.localStorage || (event.key !== HISTORY_KEY && event.key !== null)) return;
      } catch { return; }
      const next = loadHistory();
      currentItems.current = next.items;
      setHistory(next);
    }
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);

  return { ...history, remember, remove, clear };
}
