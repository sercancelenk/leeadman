import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../AppDataContext';
import { kindLabel } from '../lib/labels';
import { PATH_AGENDA, PATH_HOME, PATH_PROFILE, PATH_SETTINGS, PATH_TEAMS, PATH_TODOS } from '../lib/routes';
import { teamBase, teamPeople, teamPerson } from '../lib/teamPaths';
import type { Item, Person, Team, TodoItem } from '../model';
import { IcArrowRight, IcCalendar, IcFolder, IcHome, IcListTodo, IcSettings, IcUser, IcUsers } from './icons';

type Command = {
  id: string;
  group: 'Navigate' | 'Teams' | 'People' | 'Items' | 'To-dos';
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
};

/**
 * Global ⌘K palette. Listens for Cmd/Ctrl+K and fuzzy-searches across
 * navigation targets, teams, people, items and to-dos.
 *
 * Implementation notes:
 *  - Mounted at the root so the keyboard shortcut works from any page.
 *  - When closed, renders nothing (zero overhead while idle).
 *  - Filtering is plain substring (case-insensitive) for predictability.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const navigate = useNavigate();
  const { data } = useAppData();

  const commands = useMemo<Command[]>(() => buildCommands(data, navigate), [data, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 50);
    const matches: Command[] = [];
    for (const c of commands) {
      const hay = `${c.label} ${c.group} ${c.hint ?? ''}`.toLowerCase();
      if (hay.includes(q)) matches.push(c);
    }
    return matches.slice(0, 50);
  }, [commands, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isModK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  const groups = groupBy(filtered, (c) => c.group);

  function runAt(idx: number) {
    const c = filtered[idx];
    if (!c) return;
    c.run();
    setOpen(false);
  }

  return (
    <div className="cmdp" role="dialog" aria-modal="true" aria-label="Command palette" onClick={() => setOpen(false)}>
      <div className="cmdp__panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmdp__input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="cmdp__input"
            placeholder="Search teams, people, tasks, notes…  (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runAt(cursor);
              }
            }}
          />
          <span className="cmdp__kbd">↵</span>
        </div>
        <div className="cmdp__results" role="listbox">
          {filtered.length === 0 ? (
            <div className="cmdp__empty">No matches.</div>
          ) : (
            groups.map(([group, list]) => (
              <div className="cmdp__group" key={group}>
                <div className="cmdp__group-label">{group}</div>
                {list.map((c) => {
                  const idx = filtered.indexOf(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={idx === cursor}
                      className={`cmdp__row${idx === cursor ? ' cmdp__row--active' : ''}`}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => runAt(idx)}
                    >
                      <span className="cmdp__icon">{c.icon}</span>
                      <span className="cmdp__label">{c.label}</span>
                      {c.hint ? <span className="cmdp__hint">{c.hint}</span> : null}
                      <IcArrowRight size={14} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="cmdp__footer muted small">
          <span>↑↓ to navigate</span>
          <span>↵ to select</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}

function buildCommands(
  data: ReturnType<typeof useAppData>['data'],
  navigate: ReturnType<typeof useNavigate>,
): Command[] {
  const cmds: Command[] = [
    {
      id: 'nav-home',
      group: 'Navigate',
      label: 'Go to Home',
      icon: <IcHome size={16} />,
      run: () => navigate(PATH_HOME),
    },
    {
      id: 'nav-teams',
      group: 'Navigate',
      label: 'Go to Teams',
      icon: <IcFolder size={16} />,
      run: () => navigate(PATH_TEAMS),
    },
    {
      id: 'nav-todos',
      group: 'Navigate',
      label: 'Go to To-dos',
      icon: <IcListTodo size={16} />,
      run: () => navigate(PATH_TODOS),
    },
    {
      id: 'nav-agenda',
      group: 'Navigate',
      label: 'Go to Agenda',
      icon: <IcCalendar size={16} />,
      run: () => navigate(PATH_AGENDA),
    },
    {
      id: 'nav-profile',
      group: 'Navigate',
      label: 'Go to Profile',
      icon: <IcUser size={16} />,
      run: () => navigate(PATH_PROFILE),
    },
    {
      id: 'nav-settings',
      group: 'Navigate',
      label: 'Go to Settings',
      icon: <IcSettings size={16} />,
      run: () => navigate(PATH_SETTINGS),
    },
  ];

  for (const t of data.teams as Team[]) {
    cmds.push({
      id: `team-${t.id}`,
      group: 'Teams',
      label: t.name,
      hint: 'Open team',
      icon: <IcFolder size={16} />,
      run: () => navigate(teamBase(t.id)),
    });
    cmds.push({
      id: `team-people-${t.id}`,
      group: 'Teams',
      label: `${t.name} · People`,
      icon: <IcUsers size={16} />,
      run: () => navigate(teamPeople(t.id)),
    });
  }

  for (const p of data.people as Person[]) {
    const team = data.teams.find((t) => t.id === p.teamId);
    cmds.push({
      id: `person-${p.id}`,
      group: 'People',
      label: p.name,
      hint: team ? team.name : undefined,
      icon: <IcUser size={16} />,
      run: () => navigate(teamPerson(p.teamId, p.id)),
    });
  }

  for (const it of data.items as Item[]) {
    if (!it.title) continue;
    const person = data.people.find((p) => p.id === it.personId);
    const team = person ? data.teams.find((t) => t.id === person.teamId) : undefined;
    if (!person || !team) continue;
    cmds.push({
      id: `item-${it.id}`,
      group: 'Items',
      label: it.title,
      hint: `${kindLabel(it.kind)} · ${team.name} · ${person.name}`,
      icon: <IcListTodo size={16} />,
      run: () => navigate(teamPerson(team.id, person.id)),
    });
  }

  for (const t of data.todoItems as TodoItem[]) {
    if (!t.title) continue;
    cmds.push({
      id: `todo-${t.id}`,
      group: 'To-dos',
      label: t.title,
      hint: t.done ? 'Done' : 'Open',
      icon: <IcListTodo size={16} />,
      run: () => navigate(PATH_TODOS),
    });
  }

  return cmds;
}

function groupBy<T, K extends string>(items: T[], key: (item: T) => K): [K, T[]][] {
  const map = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return Array.from(map.entries());
}
