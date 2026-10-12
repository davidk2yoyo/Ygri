// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

// supabase-js only treats 502/503/504 as retryable when renewing the session token. A 429
// (rate limit) is handled as a definitive failure and the stored session is deleted, which
// logs the user out. We turn rate-limit/server errors on the refresh call into a network-style
// error (the library keeps the session and retries) and pause refresh calls for a minute after
// a 429 so we don't keep hammering the limit.
let refreshPausedUntil = 0;
const isRefreshCall = (input) => {
  const u = typeof input === 'string' ? input : input?.url || '';
  return u.includes('/auth/v1/token') && u.includes('grant_type=refresh_token');
};
const resilientFetch = async (input, init) => {
  const refresh = isRefreshCall(input);
  if (refresh && Date.now() < refreshPausedUntil) throw new TypeError('Token refresh paused after rate limit');
  const res = await fetch(input, init);
  if (refresh && (res.status === 429 || res.status >= 500)) {
    if (res.status === 429) refreshPausedUntil = Date.now() + 60_000;
    throw new TypeError(`Token refresh unavailable (${res.status}), will retry`);
  }
  return res;
};

export const supabase = createClient(url, anon, {
  global: { fetch: resilientFetch },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
