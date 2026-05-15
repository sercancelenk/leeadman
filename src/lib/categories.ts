import type { AppData } from '../model';

/** Hızlı seçim önerileri (zorunlu değil; serbest metin de yazılabilir) */
export const SUGGESTED_CATEGORIES = ['Serüven', 'Operasyon', 'Ekip', 'Paydaş', 'Kişisel gelişim', 'Liderlik'];

export function distinctCategoriesForTeam(data: AppData, teamId: string): string[] {
  const personIds = new Set(data.people.filter((p) => p.teamId === teamId).map((p) => p.id));
  const set = new Set<string>();
  for (const it of data.items) {
    if (!personIds.has(it.personId)) continue;
    const c = it.category?.trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
}
