import { useCallback, useEffect, useState } from 'react';
import { ApiError, describeStatusLog, fetchDebugInfo, fetchPlayer, fetchQueue } from './api';
import type { OverlayTrack, PlayerState } from './api';
import { getAccessToken, getClientId, handleAuthCallback, hasTokens, invalidateAccessToken, startLogin } from './auth';

// Progress dihaluskan secara lokal, jadi polling tidak perlu rapat. Batas rate limit Spotify
// berlaku per app (semua tab/aplikasi yang membuka overlay berbagi jatah yang sama).
const POLL_PLAYING_MS = 5000;
const POLL_IDLE_MS = 10_000;
const QUEUE_REFRESH_MS = 20_000;
const DEBUG_REFRESH_MS = 30_000;
const RATE_LIMIT_BACKOFF_S = [15, 30, 60, 120];

export type AuthPhase = 'checking' | 'signed-out' | 'signed-in';

export function useSpotifyPlayback(enabled: boolean, poll = true, debug = false) {
  const [phase, setPhase] = useState<AuthPhase>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [queue, setQueue] = useState<OverlayTrack[]>([]);
  const [queueBlocked, setQueueBlocked] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [debugText, setDebugText] = useState<string | null>(null);

  // 1) Proses redirect balik dari Spotify (kalau ada), lalu tentukan status login.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void handleAuthCallback().then((result) => {
      if (cancelled) return;
      if (result.status === 'error') setMessage(result.message);
      setPhase(hasTokens() ? 'signed-in' : 'signed-out');
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // 2) Polling player + queue selama sudah login.
  useEffect(() => {
    if (!enabled || !poll || phase !== 'signed-in') return;
    let cancelled = false;
    let timer = 0;
    let lastTrackId: string | null | undefined;
    let lastQueueAt = 0;
    let lastDebugAt = 0;
    let rateStep = 0;
    let errorStep = 0;

    const tick = async () => {
      let delay = POLL_PLAYING_MS;
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        if (!token) {
          setPhase('signed-out');
          return;
        }

        const state = await fetchPlayer(token);
        if (cancelled) return;
        setPlayer(state);
        setMessage(null);
        rateStep = 0;
        errorStep = 0;
        if (!state?.isPlaying) {
          delay = POLL_IDLE_MS;
        } else if (state.durationMs > 0) {
          // Poll tepat setelah lagu selesai agar pergantian lagu cepat terdeteksi.
          const remaining = state.durationMs - state.progressMs + 400;
          delay = Math.max(1500, Math.min(POLL_PLAYING_MS, remaining));
        }

        const trackId = state?.track?.id ?? null;
        if (!trackId) {
          setQueue([]);
        } else if (trackId !== lastTrackId || Date.now() - lastQueueAt > QUEUE_REFRESH_MS) {
          lastTrackId = trackId;
          lastQueueAt = Date.now();
          try {
            const items = await fetchQueue(token);
            if (cancelled) return;
            setQueue(items);
            setQueueBlocked(false);
          } catch (e) {
            if (e instanceof ApiError && e.status === 403) setQueueBlocked(true);
            else throw e;
          }
        }

        if (debug && Date.now() - lastDebugAt > DEBUG_REFRESH_MS) {
          lastDebugAt = Date.now();
          const info = await fetchDebugInfo(token);
          if (!cancelled) setDebugText(info);
        }
      } catch (e) {
        if (debug && !cancelled) setDebugText(`Error: ${e instanceof Error ? e.message : String(e)}\n${describeStatusLog()}`);
        if (e instanceof ApiError && e.status === 429) {
          const wait = e.retryAfter
            ? e.retryAfter + 1
            : RATE_LIMIT_BACKOFF_S[Math.min(rateStep, RATE_LIMIT_BACKOFF_S.length - 1)];
          rateStep += 1;
          delay = wait * 1000;
          setMessage(`Spotify membatasi request, mencoba lagi ${wait} detik lagi.`);
        } else if (e instanceof ApiError && e.status === 401 && errorStep < 3) {
          invalidateAccessToken();
          errorStep += 1;
          delay = 1500;
        } else {
          errorStep += 1;
          setMessage(e instanceof Error ? e.message : 'Gagal mengambil data Spotify.');
          delay = Math.min(60_000, POLL_PLAYING_MS * 2 ** Math.min(errorStep, 4));
        }
      }
      if (!cancelled) timer = window.setTimeout(() => void tick(), delay);
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, poll, debug, phase]);

  // 3) Interpolasi progress di antara dua polling.
  const playing = player?.isPlaying ?? false;
  useEffect(() => {
    if (!enabled || !playing) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [enabled, playing]);

  const connect = useCallback(async () => {
    const clientId = getClientId();
    if (!clientId) {
      setMessage('Client ID Spotify belum diatur.');
      return;
    }
    try {
      await startLogin(clientId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal memulai login Spotify.');
    }
  }, []);

  let elapsedSec = 0;
  if (player) {
    const drift = player.isPlaying ? Math.max(0, now - player.fetchedAt) : 0;
    elapsedSec = Math.min(player.durationMs, player.progressMs + drift) / 1000;
  }

  return { phase, message, player, queue, queueBlocked, elapsedSec, connect, debugText };
}
