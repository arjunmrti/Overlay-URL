import { useEffect, useMemo, useState } from 'react';
import { ListMusic, Music2 } from 'lucide-react';
import { getClientId } from './spotify/auth';
import { demoNowPlaying, demoQueue } from './demoData';
import { useCoverColor } from './useCoverColor';
import { useSpotifyPlayback } from './spotify/useSpotifyPlayback';

const DEFAULT_ACCENT = '#9db4ff';

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mode = params.get('mode') ?? 'full';
  const accentParam = /^#[0-9a-fA-F]{6}$/.test(params.get('accent') ?? '') ? params.get('accent')! : null;
  const queueLimit = Math.min(8, Math.max(1, Number(params.get('count') ?? 8)));
  const compact = params.get('compact') === '1';
  const hideWhenIdle = params.get('idle') === 'hide';

  // Demo jika diminta (?demo=1) atau Client ID belum diatur.
  const isDemo = params.get('demo') === '1' || getClientId() === null;

  // --- Demo ---
  const demoDuration = Number(params.get('duration') ?? 259);
  const [demoElapsed, setDemoElapsed] = useState(Number(params.get('elapsed') ?? 58));
  useEffect(() => {
    if (!isDemo || params.get('static') === '1') return;
    const timer = window.setInterval(() => {
      setDemoElapsed((current) => (current >= demoDuration ? 0 : current + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isDemo, demoDuration, params]);

  // --- Live Spotify ---
  const live = useSpotifyPlayback(!isDemo);

  const nowTrack: { title: string; artist: string; cover: string } | null = isDemo
    ? {
        title: params.get('title') ?? demoNowPlaying.title,
        artist: params.get('artist') ?? demoNowPlaying.artist,
        cover: demoNowPlaying.cover,
      }
    : (live.player?.track ?? null);
  const cover = nowTrack?.cover ?? '';
  const extractedAccent = useCoverColor(isDemo ? '' : cover, DEFAULT_ACCENT);
  const accent = accentParam ?? (isDemo ? demoNowPlaying.accent : extractedAccent);
  const isPlaying = isDemo ? true : (live.player?.isPlaying ?? false);
  const elapsed = isDemo ? demoElapsed : live.elapsedSec;
  const duration = isDemo ? demoDuration : (live.player?.durationMs ?? 0) / 1000;
  const queueItems = (isDemo ? demoQueue : live.queue).slice(0, queueLimit);
  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  const showNowPlaying = mode !== 'queue';
  const showQueue = mode !== 'now-playing';
  const rootClass = `overlay ${compact ? 'overlay--compact' : ''}`;
  const rootStyle = { '--accent': accent } as React.CSSProperties;

  // Belum login / sedang cek / error: tampilkan kartu status, bukan overlay kosong.
  if (!isDemo && live.phase === 'checking') {
    return <main className={rootClass} style={rootStyle} />;
  }
  if (!isDemo && live.phase === 'signed-out') {
    return (
      <main className={rootClass} style={rootStyle}>
        <section className="glass status-card" aria-label="Hubungkan Spotify">
          <div className="status-title">Spotify belum terhubung</div>
          {live.message && <div className="status-note">{live.message}</div>}
          <button className="connect-button" type="button" onClick={() => void live.connect()}>
            Hubungkan Spotify
          </button>
        </section>
      </main>
    );
  }
  if (!isDemo && hideWhenIdle && !nowTrack) {
    return <main className={rootClass} style={rootStyle} />;
  }

  return (
    <main className={rootClass} style={rootStyle}>
      {showNowPlaying && (
        <section className="now-playing" aria-label="Now playing">
          <div className="cover-stage">
            {cover && (
              <div key={`glow-${cover}`} className="cover-glow" style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />
            )}
            <div className="cover-frame">
              {cover ? (
                <img key={cover} className="main-cover" src={cover} alt="Album artwork" />
              ) : (
                <div className="cover-placeholder" aria-hidden="true">
                  <Music2 size={42} strokeWidth={1.5} />
                </div>
              )}
            </div>
          </div>

          <div className="glass track-card">
            <div className="eyebrow">
              <span className={`eq ${isPlaying ? '' : 'eq--paused'}`} aria-hidden="true">
                <i /><i /><i />
              </span>
              <span>{isPlaying ? 'NOW PLAYING' : nowTrack ? 'PAUSED' : 'IDLE'}</span>
            </div>
            <div className="track-title" title={nowTrack?.title}>
              {nowTrack?.title ?? 'Tidak ada lagu diputar'}
            </div>
            <div className="track-artist" title={nowTrack?.artist}>
              {nowTrack ? nowTrack.artist : 'Putar sesuatu di Spotify'}
            </div>
          </div>

          <div className="glass progress-card" aria-label="Playback progress">
            <span className="time time--elapsed">{formatTime(elapsed)}</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="time time--duration">{formatTime(duration)}</span>
          </div>
          {!isDemo && live.message && <div className="status-note status-note--inline">{live.message}</div>}
        </section>
      )}

      {showQueue && (
        <section className="glass queue-card" aria-label="Spotify queue">
          <header className="queue-header">
            <div className="queue-heading">
              <ListMusic size={12} strokeWidth={2.2} />
              <span>UP NEXT</span>
            </div>
            {queueItems.length > 0 && <span className="queue-count">{queueItems.length}</span>}
          </header>
          {queueItems.length === 0 ? (
            <div className="queue-empty">
              {!isDemo && live.queueBlocked ? 'Antrean tidak bisa diakses' : 'Antrean kosong'}
            </div>
          ) : (
            <ol className="queue-list">
              {queueItems.map((track, index) => (
                <li className="queue-item" key={`${track.id}-${index}`}>
                  <span className="queue-number">{index + 1}</span>
                  {track.cover ? (
                    <img className="queue-cover" src={track.cover} alt="" />
                  ) : (
                    <span className="queue-cover" aria-hidden="true" />
                  )}
                  <div className="queue-copy">
                    <div className="queue-title" title={track.title}>{track.title}</div>
                    <div className="queue-artist" title={track.artist}>{track.artist}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </main>
  );
}
