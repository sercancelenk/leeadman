import type { ItemKind } from '../model';

const labels: Record<ItemKind, string> = {
  task: 'Görev',
  note: 'Not',
  goal: 'Hedef',
  document: 'Doküman',
};

export function kindLabel(k: ItemKind): string {
  return labels[k] ?? k;
}
