import { useMemo, useRef, useState } from 'react';
import { createSessionLink } from './spotify/auth';

export default function SetupCard() {
  const link = useMemo(() => createSessionLink(), []);
  const [copied, setCopied] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      areaRef.current?.focus();
      areaRef.current?.select();
      setCopied(false);
    }
  };

  return (
    <section className="glass status-card" aria-label="Link untuk aplikasi streaming">
      <div className="status-title">Spotify terhubung</div>
      <div className="status-note">
        Salin link di bawah, lalu tempel sebagai URL Link Source di TikTok LIVE Studio.
        Link ini berisi akses ke akun Spotify-mu, jadi perlakukan seperti password dan jangan dibagikan atau di-screenshot.
      </div>
      <textarea ref={areaRef} className="setup-link" readOnly rows={6} value={link ?? 'Sesi belum tersedia.'} onFocus={(e) => e.currentTarget.select()} />
      <button className="connect-button" type="button" onClick={() => void copy()} disabled={!link}>
        {copied ? 'Tersalin' : 'Salin link'}
      </button>
    </section>
  );
}
