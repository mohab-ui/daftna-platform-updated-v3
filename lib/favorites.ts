export type FavoriteResource = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;

  course_id: string | null;
  course_code: string | null;
  course_name: string | null;
  lecture_key: string | null;
  lecture_title: string | null;

  saved_at: string;
};

export const FAVORITES_KEY = "daftna:favorites:v1";
export const FAVORITES_CHANGED_EVENT = "daftna:favorites:changed";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readFavorites(): FavoriteResource[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<FavoriteResource[]>(window.localStorage.getItem(FAVORITES_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x) => x && typeof x.id === "string" && typeof x.title === "string");
}

export function writeFavorites(list: FavoriteResource[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = list.slice(0, 300);
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  } catch {}
}

export function isFavorite(resourceId: string): boolean {
  return readFavorites().some((f) => f.id === resourceId);
}

export function toggleFavorite(item: Omit<FavoriteResource, "saved_at">): boolean {
  const list = readFavorites();
  const idx = list.findIndex((f) => f.id === item.id);
  if (idx >= 0) {
    const next = list.filter((f) => f.id !== item.id);
    writeFavorites(next);
    return false;
  }
  const fav: FavoriteResource = { ...item, saved_at: new Date().toISOString() };
  const next = [fav, ...list];
  writeFavorites(next);
  return true;
}

export function removeFavorite(resourceId: string) {
  const list = readFavorites();
  const next = list.filter((f) => f.id !== resourceId);
  writeFavorites(next);
}

export function updateFavoriteMeta(
  resourceId: string,
  patch: Partial<Pick<FavoriteResource, "title" | "type" | "description" | "storage_path" | "external_url">>
) {
  if (typeof window === "undefined") return;
  const list = readFavorites();
  const idx = list.findIndex((f) => f.id === resourceId);
  if (idx < 0) return;

  const next = [...list];
  next[idx] = { ...next[idx], ...patch };
  writeFavorites(next);
}

export function clearFavorites() {
  writeFavorites([]);
}
