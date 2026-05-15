import type { TeamStatus } from '../model';

const labels: Record<TeamStatus, string> = {
  active: 'Aktif',
  paused: 'Beklemede',
  archived: 'Arşiv',
};

export function teamStatusLabel(s: TeamStatus | undefined): string {
  return labels[s ?? 'active'] ?? labels.active;
}

export const TEAM_STATUS_OPTIONS: { value: TeamStatus; label: string }[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Beklemede' },
  { value: 'archived', label: 'Arşiv' },
];
