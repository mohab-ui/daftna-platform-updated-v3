export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pct(correct: number, total: number) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

export function fmtDate(ts: string | null | undefined) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}
