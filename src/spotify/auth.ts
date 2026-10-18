// Spotify Authorization Code + PKCE, murni di browser. Tidak butuh server dan
// tidak ada client secret. Token disimpan di localStorage milik Browser Source OBS.

const SCOPES = ['user-read-playback-state', 'user-read-currently-playing'].join(' ');
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

const KEYS = {
  tokens: 'spotique.tokens',
  verifier: 'spotique.pkce.verifier',
  state: 'spotique.pkce.state',
  returnSearch: 'spotique.pkce.returnSearch',
  clientId: 'spotique.clientId',
} as const;

type StoredTokens = { accessToken: string; refreshToken: string; expiresAt: number };

export class AuthError extends Error {
  readonly fatal: boolean;
  constructor(message: string, fatal: boolean) {
    super(message);
    this.name = 'AuthError';
    this.fatal = fatal;
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage tidak tersedia */
  }
}
function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage tidak tersedia */
  }
}

function loadTokens(): StoredTokens | null {
  const raw = read(KEYS.tokens);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<StoredTokens>;
    if (typeof t.accessToken === 'string' && typeof t.refreshToken === 'string' && typeof t.expiresAt === 'number') {
      return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt };
    }
  } catch {
    /* JSON rusak, dianggap belum login */
  }
  return null;
}
function saveTokens(tokens: StoredTokens) {
  write(KEYS.tokens, JSON.stringify(tokens));
}

export function hasTokens(): boolean {
  return loadTokens() !== null;
}
export function logout() {
  remove(KEYS.tokens);
}
/** Paksa refresh pada panggilan berikutnya (dipakai saat API membalas 401). */
export function invalidateAccessToken() {
  const t = loadTokens();
  if (t) saveTokens({ ...t, expiresAt: 0 });
}

/** Prioritas: ?client_id= di URL, lalu env VITE_SPOTIFY_CLIENT_ID, lalu yang tersimpan. */
export function getClientId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get('client_id')?.trim();
  if (fromUrl) return fromUrl;
  const fromEnv = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  return read(KEYS.clientId);
}

/** Harus PERSIS sama dengan Redirect URI yang didaftarkan di Spotify Dashboard. */
export function getRedirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function sha256Base64Url(plain: string): Promise<string> {
  if (!crypto.subtle) {
    throw new Error('Login Spotify butuh HTTPS (atau 127.0.0.1 saat development).');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
  let binary = '';
  new Uint8Array(digest).forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function startLogin(clientId: string): Promise<void> {
  const verifier = randomString(96);
  const state = randomString(24);
  const challenge = await sha256Base64Url(verifier);

  write(KEYS.verifier, verifier);
  write(KEYS.state, state);
  write(KEYS.returnSearch, window.location.search);
  write(KEYS.clientId, clientId);

  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  }).toString();
  window.location.assign(url.toString());
}

async function requestTokens(body: Record<string, string>, fallbackRefresh?: string): Promise<StoredTokens> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
  } catch {
    throw new AuthError('Tidak bisa menjangkau Spotify.', false);
  }
  if (!res.ok) {
    // 400/401 = code/refresh token tidak valid lagi, harus login ulang.
    throw new AuthError(`Token ditolak Spotify (${res.status}).`, res.status === 400 || res.status === 401);
  }
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const refreshToken = json.refresh_token ?? fallbackRefresh;
  if (!refreshToken) throw new AuthError('Refresh token tidak diterima.', true);
  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000 - 60_000,
  };
}

export type CallbackResult = { status: 'none' } | { status: 'ok' } | { status: 'error'; message: string };

async function runCallback(): Promise<CallbackResult> {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (params.get('logout') === '1') {
    logout();
    params.delete('logout');
    const rest = params.toString();
    window.history.replaceState(null, '', `${url.pathname}${rest ? `?${rest}` : ''}`);
  }

  const code = params.get('code');
  const error = params.get('error');
  const state = params.get('state');
  if (!code && !error) return { status: 'none' };

  const expectedState = read(KEYS.state);
  const verifier = read(KEYS.verifier);
  const clientId = read(KEYS.clientId);
  const returnSearch = read(KEYS.returnSearch) ?? '';
  remove(KEYS.state);
  remove(KEYS.verifier);
  remove(KEYS.returnSearch);

  // Kembalikan URL ke parameter overlay semula (bersihkan ?code=...).
  window.history.replaceState(null, '', `${url.pathname}${returnSearch}`);

  if (error) {
    return { status: 'error', message: error === 'access_denied' ? 'Akses ditolak di Spotify.' : `Spotify: ${error}` };
  }
  if (!code || !verifier || !clientId || !state || state !== expectedState) {
    return { status: 'error', message: 'Sesi login tidak valid, coba hubungkan lagi.' };
  }

  try {
    const tokens = await requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    });
    saveTokens(tokens);
    return { status: 'ok' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Gagal menukar kode login.' };
  }
}

let callbackPromise: Promise<CallbackResult> | null = null;
/** Aman dipanggil berulang (React StrictMode menjalankan effect dua kali). */
export function handleAuthCallback(): Promise<CallbackResult> {
  callbackPromise ??= runCallback();
  return callbackPromise;
}

let refreshing: Promise<string | null> | null = null;

async function doRefresh(tokens: StoredTokens): Promise<string | null> {
  const clientId = read(KEYS.clientId) ?? getClientId();
  if (!clientId) {
    logout();
    return null;
  }
  try {
    const next = await requestTokens(
      { grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: clientId },
      tokens.refreshToken,
    );
    saveTokens(next);
    return next.accessToken;
  } catch (e) {
    if (e instanceof AuthError && e.fatal) {
      logout();
      return null;
    }
    throw e;
  }
}

/** Mengembalikan access token valid, atau null jika harus login ulang. */
export async function getAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;
  if (tokens.expiresAt > Date.now()) return tokens.accessToken;
  refreshing ??= doRefresh(tokens).finally(() => {
    refreshing = null;
  });
  return refreshing;
}
