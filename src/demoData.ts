import type { OverlayTrack } from './spotify/api';

// Cover demo dibuat secara prosedural (SVG gradient), tidak ada file gambar.
type CoverSpec = { from: string; to: string; glow: string; variant: number };

function makeCover({ from, to, glow, variant }: CoverSpec): string {
  const shapes = [
    `<circle cx="215" cy="85" r="95" fill="${glow}" opacity=".55"/><circle cx="70" cy="235" r="120" fill="${to}" opacity=".6"/>`,
    `<rect x="-40" y="150" width="400" height="110" fill="${glow}" opacity=".45" transform="rotate(-18 150 200)"/><circle cx="210" cy="95" r="55" fill="#fff" opacity=".22"/>`,
    `<circle cx="150" cy="150" r="105" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/><circle cx="150" cy="150" r="70" fill="${glow}" opacity=".5"/>`,
    `<path d="M0 210 Q75 150 150 200 T300 170 V300 H0Z" fill="${glow}" opacity=".5"/><path d="M0 245 Q90 200 170 240 T300 215 V300 H0Z" fill="${to}" opacity=".6"/>`,
  ];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="300" height="300" fill="url(#g)"/>${shapes[variant % shapes.length]}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const demoNowPlaying = {
  title: 'Velvet Horizon',
  artist: 'Luna Avenue',
  cover: makeCover({ from: '#5b3df5', to: '#e0489b', glow: '#ffb86b', variant: 0 }),
  accent: '#c9a6ff',
};

const q = (id: string, title: string, artist: string, spec: CoverSpec): OverlayTrack => ({
  id,
  title,
  artist,
  cover: makeCover(spec),
});

export const demoQueue: OverlayTrack[] = [
  q('d1', 'Neon Afterglow', 'Kairo & The Static', { from: '#0f9fb0', to: '#1b2a6b', glow: '#7ef0e0', variant: 1 }),
  q('d2', 'Slow Tide', 'Marlow Quinn', { from: '#2f6fe0', to: '#0d1f4d', glow: '#8cc2ff', variant: 3 }),
  q('d3', 'Paper Satellites', 'Odessa Fields', { from: '#f08a3c', to: '#a8325e', glow: '#ffd37a', variant: 2 }),
  q('d4', 'Glass Cathedral', 'Northern Lights Club', { from: '#4a3fb0', to: '#161337', glow: '#b6a8ff', variant: 0 }),
  q('d5', 'Sunday in Slow Motion', 'Wren Alder', { from: '#f4a58a', to: '#c96a7c', glow: '#ffe2c2', variant: 3 }),
  q('d6', 'Echoes of a Quiet Street', 'Juniper Hale', { from: '#3f9b6a', to: '#14382c', glow: '#b4f0c8', variant: 1 }),
  q('d7', 'Late Bloom', 'Soleil Park', { from: '#d2467a', to: '#5a1840', glow: '#ff9fc2', variant: 2 }),
  q('d8', 'Afterimage', 'The Meridian Set', { from: '#5f6b7d', to: '#1e242e', glow: '#c3cddc', variant: 0 }),
];
