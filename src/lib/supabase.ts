import { createClient } from '@supabase/supabase-js';
import type { HomeData } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

const client = supabaseConfigured
  ? createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function db() {
  if (!client) throw new Error('Supabase לא מוגדר (VITE_SUPABASE_URL / VITE_SUPABASE_KEY)');
  return client;
}

export class HomeNotFound extends Error {}

// A stalled request would otherwise block saving indefinitely.
const timeout = () => AbortSignal.timeout(15_000);

export async function createHome(code: string, data: HomeData): Promise<number> {
  const { data: version, error } = await db().rpc('hp_create_home', { p_code: code, p_data: data }).abortSignal(timeout());
  if (error) throw new Error(error.message);
  return version as number;
}

export async function loadHome(code: string): Promise<{ data: HomeData; version: number }> {
  const { data, error } = await db().rpc('hp_load_home', { p_code: code }).abortSignal(timeout());
  if (error) throw new Error(error.message);
  const row = (data as { data: HomeData; version: number }[] | null)?.[0];
  if (!row) throw new HomeNotFound('not_found');
  return row;
}

/** Returns the new version, or -1 when someone else saved first. */
export async function saveHome(code: string, data: HomeData, expectedVersion: number): Promise<number> {
  const { data: version, error } = await db().rpc('hp_save_home', {
    p_code: code,
    p_data: data,
    p_expected_version: expectedVersion,
  }).abortSignal(timeout());
  if (error) throw new Error(error.message);
  return version as number;
}
