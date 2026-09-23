import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomeData } from '../types';
import { mergeHome } from './merge';
import { homeCache } from './storage';
import { HomeNotFound, loadHome, saveHome } from './supabase';

export type SyncStatus = 'loading' | 'synced' | 'saving' | 'offline' | 'error' | 'notfound';

const SAVE_DEBOUNCE = 700;
const POLL_EVERY = 20_000;
const RETRY_AFTER = 5_000;

/**
 * Holds one apartment document and keeps it in sync with Supabase.
 * Edits apply locally at once (and to a localStorage copy), are saved after a short debounce with
 * an optimistic version check, and on a conflict the remote copy is merged in and saved again.
 */
export function useHome(code: string) {
  const cached = homeCache.get(code);
  const [data, setData] = useState<HomeData | null>(cached?.data ?? null);
  const [status, setStatus] = useState<SyncStatus>('loading');

  const dataRef = useRef<HomeData | null>(cached?.data ?? null);
  const versionRef = useRef(cached?.version ?? 0);
  const dirtyRef = useRef(cached?.dirty ?? false);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commit = useCallback(
    (next: HomeData, version: number, dirty: boolean) => {
      dataRef.current = next;
      versionRef.current = version;
      dirtyRef.current = dirty;
      setData(next);
      homeCache.set(code, { data: next, version, dirty });
    },
    [code],
  );

  const failed = useCallback((e: unknown) => {
    if (e instanceof HomeNotFound) setStatus('notfound');
    else setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
  }, []);

  const flushRef = useRef<() => Promise<void>>(async () => {});
  const schedule = useCallback((delay: number) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushRef.current(), delay);
  }, []);

  const flush = useCallback(async () => {
    if (savingRef.current || !dirtyRef.current || !dataRef.current) return;
    savingRef.current = true;
    setStatus('saving');
    try {
      for (let attempt = 0; attempt < 5 && dirtyRef.current; attempt++) {
        const snapshot = dataRef.current!;
        const v = await saveHome(code, snapshot, versionRef.current);
        if (v >= 0) {
          // Anything edited while the request was in flight is still unsaved.
          commit(dataRef.current!, v, dataRef.current !== snapshot);
          continue;
        }
        const remote = await loadHome(code);
        commit(mergeHome(dataRef.current!, remote.data), remote.version, true);
      }
      setStatus(dirtyRef.current ? 'saving' : 'synced');
      if (dirtyRef.current) schedule(SAVE_DEBOUNCE);
    } catch (e) {
      failed(e);
      schedule(RETRY_AFTER);
    } finally {
      savingRef.current = false;
    }
  }, [code, commit, failed, schedule]);
  flushRef.current = flush;

  const pull = useCallback(async () => {
    if (savingRef.current) return;
    const before = dataRef.current;
    try {
      const remote = await loadHome(code);
      if (savingRef.current) return;
      const local = dataRef.current;
      if (local && (dirtyRef.current || local !== before)) {
        commit(mergeHome(local, remote.data), remote.version, true);
        schedule(0);
        return;
      }
      if (!local || remote.version > versionRef.current) commit(remote.data, remote.version, false);
      setStatus('synced');
    } catch (e) {
      failed(e);
    }
  }, [code, commit, failed, schedule]);

  useEffect(() => {
    void pull();
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      if (dirtyRef.current) void flushRef.current();
      else void pull();
    };
    const poll = setInterval(onWake, POLL_EVERY);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    return () => {
      clearInterval(poll);
      clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [pull]);

  const update = useCallback(
    (fn: (d: HomeData) => HomeData) => {
      if (!dataRef.current) return;
      commit(fn(dataRef.current), versionRef.current, true);
      setStatus('saving');
      schedule(SAVE_DEBOUNCE);
    },
    [commit, schedule],
  );

  return { data, status, update, retry: pull };
}
