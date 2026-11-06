import { useEffect, useMemo, useRef, useState } from 'react';
import { ListMusic, Music2 } from 'lucide-react';
import { getClientId } from './spotify/auth';
import { demoNowPlaying, demoQueue } from './demoData';
import { useCoverColor } from './useCoverColor';
import SetupCard from './SetupCard';
import { useSpotifyPlayback } from './spotify/useSpotifyPlayback';

const DEFAULT_ACCENT = '#9db4ff';

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function MarqueeTitle({ text }: { text: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = textRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      const nextDistance = Math.max(0, Math.ceil(content.scrollWidth - viewport.clientWidth));
      setDistance((current) => current === nextDistance ? current : nextDistance);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [text]);

  const duration = Math.min(24, Math.max(10, distance / 12));
  const marqueeStyle = distance > 0
    ? ({
        '--marquee-distance': `${distance}px`,
        '--marquee-duration': `${duration}s`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      ref={viewportRef}
      className={`wide-title ${distance > 0 ? 'wide-title--marquee' : ''}`}
      style={marqueeStyle}
      title={text}
    >
      <span ref={textRef} className="wide-title-text">{text}</span>
    </div>
  );
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mode = params.get('mode') ?? 'full';
  const accentParam = /^#[0-9a-fA-F]{6}$/.test(params.get('accent') ?? '') ? params.get('accent')! : null;
  const queueLimit = Math.min(8, Math.max(1, Number(params.get('count') ?? 8)));
  const compact = params.get('compact') === '1';
  const hideWhenIdle = params.get('idle') === 'hide';
  const wide = params.get('layout') === 'wide'; // layout horizontal 653×176

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
  const setupMode = params.get('setup') === '1';
  const debugMode = params.get('debug') === '1';
  const live = useSpotifyPlayback(!isDemo, !setupMode, debugMode);

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
  const rootClass = `overlay ${compact ? 'overlay--compact' : ''} ${wide ? 'overlay--wide' : ''}`;
  const statusLabel = isPlaying ? 'NOW PLAYING' : nowTrack ? 'PAUSED' : 'IDLE';
  const rootStyle = { '--accent': accent } as React.CSSProperties;

  // Belum login / sudah check / error: tampilkan kartu status, bukan overlay kosong.
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
  if (!isDemo && setupMode && live.phase === 'signed-in') {
    return (
      <main className="overlay" style={rootStyle}>
        <SetupCard />
      </main>
    );
  }
  if (!isDemo && hideWhenIdle && !nowTrack) {
    return <main className={rootClass} style={rootStyle} />;
  }

  const coverNode = (
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
  );

  const queueRows = queueItems.map((track, index) => (
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
  ));

  const queueEmptyText = !isDemo && live.queueBlocked ? 'Antrean tidak bisa diakses' : 'Antrean kosong';

  // --- Layout horizontal: cover | informasi + progress | antrean ---
  if (wide) {
    return (
      <main className={rootClass} style={rootStyle}>
        <section className="glass wide-card" aria-label="Spotify now playing">
          <div className="wide-cover">{coverNode}</div>
          <div className="wide-info">
            <div className="pill">
              <span className={`eq ${isPlaying ? '' : 'eq--paused'}`} aria-hidden="true">
                <i /><i /><i />
              </span>
              <span>{statusLabel}</span>
            </div>

            <div className="wide-text">
              <MarqueeTitle text={nowTrack?.title ?? 'Tidak ada lagu diputar'} />
              <div className="wide-artist" title={nowTrack?.artist}>{nowTrack ? nowTrack.artist : 'Putar sesuatu di Spotify'}</div>
              {!isDemo && live.message && <div className="status-note wide-note">{live.message}</div>}
            </div>

            <div className="wide-progress" aria-label="Playback progress">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="wide-times">
                <span className="time time--elapsed">{formatTime(elapsed)}</span>
                <span className="time time--duration">{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          <div className="wide-divider" aria-hidden="true" />

          <aside className="wide-queue" aria-label="Spotify queue">
            <header className="queue-header">
              <div className="queue-heading">
                <ListMusic size={15} strokeWidth={2.2} />
                <span>UP NEXT</span>
              </div>
              {queueItems.length > 0 && <span className="queue-count">{queueItems.length}</span>}
            </header>
            {queueItems.length === 0 ? <div className="queue-empty">{queueEmptyText}</div> : <ol className="wide-queue-list">{queueRows}</ol>}
          </aside>
        </section>

        {!isDemo && debugMode && live.debugText && <pre className="debug-box">{live.debugText}</pre>}
      </main>
    );
  }

  return (
    <main className={rootClass} style={rootStyle}>
      {showNowPlaying && (
        <section className="now-playing" aria-label="Now playing">
          {coverNode}

          <div className="glass track-card">
            <div className="eyebrow">
              <span className={`eq ${isPlaying ? '' : 'eq--paused'}`} aria-hidden="true">
                <i /><i /><i />
              </span>
              <span>{statusLabel}</span>
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
          {queueItems.length === 0 ? <div className="queue-empty">{queueEmptyText}</div> : <ol className="queue-list">{queueRows}</ol>}
        </section>
      )}

      {!isDemo && debugMode && live.debugText && <pre className="debug-box">{live.debugText}</pre>}
    </main>
  );
}
