const API = 'https://api.spotify.com/v1';

export type OverlayTrack = {
  id: string;
  title: string;
  artist: string;
  cover: string;
};

export type PlayerState = {
  track: OverlayTrack | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  /** Date.now() saat data ini diterima, dipakai untuk interpolasi progress. */
  fetchedAt: number;
};

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type RawImage = { url: string; width: number | null; height: number | null };
type RawItem = {
  id: string;
  name: string;
  type: 'track' | 'episode';
  duration_ms: number;
  artists?: { name: string }[];
  album?: { images: RawImage[] };
  show?: { name: string; images: RawImage[] };
  images?: RawImage[];
};
type RawPlayer = { is_playing: boolean; progress_ms: number | null; item: RawItem | null };
type RawQueue = { currently_playing: RawItem | null; queue: RawItem[] };

async function spotifyGet<T>(path: string, token: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError('Jaringan tidak tersedia.', 0);
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    const retry = Number(res.headers.get('Retry-After'));
    throw new ApiError(`Spotify API ${res.status}`, res.status, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

/** Ambil gambar terkecil yang masih >= target px, kalau tidak ada ambil yang terbesar. */
function pickImage(images: RawImage[] | undefined, target: number): string {
  if (!images || images.length === 0) return '';
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const fit = [...sorted].reverse().find((img) => (img.width ?? 0) >= target);
  return (fit ?? sorted[0]).url;
}

function mapItem(item: RawItem, coverTarget: number): OverlayTrack {
  const isEpisode = item.type === 'episode';
  const artist = isEpisode ? (item.show?.name ?? '') : (item.artists ?? []).map((a) => a.name).join(', ');
  const images = isEpisode ? (item.images ?? item.show?.images) : item.album?.images;
  return { id: item.id, title: item.name, artist, cover: pickImage(images, coverTarget) };
}

/** Lagu yang sedang diputar. null = tidak ada perangkat aktif / tidak ada yang diputar. */
export async function fetchPlayer(token: string): Promise<PlayerState | null> {
  const raw = await spotifyGet<RawPlayer>('/me/player?additional_types=episode', token);
  if (!raw) return null;
  return {
    track: raw.item ? mapItem(raw.item, 640) : null,
    isPlaying: raw.is_playing,
    progressMs: raw.progress_ms ?? 0,
    durationMs: raw.item?.duration_ms ?? 0,
    fetchedAt: Date.now(),
  };
}

/** Antrean berikutnya (Spotify mengembalikan maksimal sekitar 20 item). */
export async function fetchQueue(token: string): Promise<OverlayTrack[]> {
  const raw = await spotifyGet<RawQueue>('/me/player/queue', token);
  return (raw?.queue ?? []).map((item) => mapItem(item, 64));
}
