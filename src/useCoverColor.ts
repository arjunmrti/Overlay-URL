import { useEffect, useState } from 'react';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function extract(img: HTMLImageElement, fallback: string): string {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0, g = 0, b = 0, w = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l < 0.12 || l > 0.92) continue;
    const weight = (s * s + 0.02) * (1 - Math.abs(l - 0.5));
    r += data[i] * weight;
    g += data[i + 1] * weight;
    b += data[i + 2] * weight;
    w += weight;
  }
  if (w <= 0) return fallback;
  const [h, s] = rgbToHsl(r / w, g / w, b / w);
  if (s < 0.12) return '#e8ecf4'; // cover hampir hitam-putih
  return hslToHex(h, Math.min(0.9, Math.max(0.55, s)), 0.66);
}

/**
 * Warna aksen dari cover. Memakai Image terpisah dengan crossOrigin agar <img> yang tampil
 * tidak ikut gagal kalau server gambar tidak mengirim header CORS (fallback ke warna default).
 */
export function useCoverColor(url: string, fallback: string): string {
  const [color, setColor] = useState(fallback);
  useEffect(() => {
    if (!url) {
      setColor(fallback);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        setColor(extract(img, fallback));
      } catch {
        setColor(fallback);
      }
    };
    img.onerror = () => {
      if (!cancelled) setColor(fallback);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url, fallback]);
  return color;
}
