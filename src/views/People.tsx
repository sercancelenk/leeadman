import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { IcArrowRight, IcCheck, IcPencil, IcPlus, IcSave, IcTrash, IcUndo, IcX } from '../components/icons';
import { Button } from '../components/ui/Button';
import { useAppData } from '../AppDataContext';
import { distinctCategoriesForTeam, SUGGESTED_CATEGORIES } from '../lib/categories';
import { fromLocalDatetimeValue, formatShort, isPast, toLocalDatetimeValue } from '../lib/datetime';
import { kindLabel } from '../lib/labels';
import { teamLeader, teamMe, teamPeople as teamPeoplePath } from '../lib/teamPaths';
import { PATH_TEAMS } from '../lib/routes';
import type { GoalStatus, Item, ItemKind } from '../model';
import { GOAL_STATUS_OPTIONS, getLeaderPerson, getSelfPerson, isLeaderPerson, isSelfPerson, teamPeople } from '../model';

function goalStatusLabel(gs?: GoalStatus): string {
  return GOAL_STATUS_OPTIONS.find((o) => o.value === gs)?.label ?? '—';
}

export function TeamMePage() {
  const { teamId } = useParams();
  const { data } = useAppData();
  const self = teamId ? getSelfPerson(data, teamId) : undefined;
  if (!teamId) return <Navigate to={PATH_TEAMS} replace />;
  if (!self) return <Navigate to={PATH_TEAMS} replace />;
  return <PersonWorkspace personId={self.id} />;
}

export function TeamLeaderPage() {
  const { teamId } = useParams();
  const { data } = useAppData();
  const leader = teamId ? getLeaderPerson(data, teamId) : undefined;
  if (!teamId) return <Navigate to={PATH_TEAMS} replace />;
  if (!leader) return <Navigate to={PATH_TEAMS} replace />;
  return <PersonWorkspace personId={leader.id} />;
}

export function People() {
  const { teamId } = useParams();
  const { data, addPerson, removePerson } = useAppData();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');

  const team = teamId ? data.teams.find((t) => t.id === teamId) : undefined;
  const self = teamId ? getSelfPerson(data, teamId) : undefined;
  const members = useMemo(() => (teamId ? teamPeople(data, teamId) : []), [data, teamId]);

  if (!teamId || !team) return <Navigate to={PATH_TEAMS} replace />;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Ekip üyeleri · {team.name}</h1>
        <p className="muted">Her kişinin alanında görevler, hedefler, yapılandırılmış notlar ve ayrı bir serbest not alanı vardır.</p>
      </header>

      <section className="card">
        <h2 className="card__title">Kendim</h2>
        <p className="muted small">Bu ekipte senin alanın; diğer ekiplerde de ayrı bir &quot;Kendim&quot; kaydın otomatik oluşturulur.</p>
        {self ? (
          <Link
            className="btn btn--primary btn--icon"
            to={teamMe(teamId)}
            title="Kendim alanına git"
            aria-label="Kendim alanına git"
          >
            <span className="btn__icon">
              <IcArrowRight size={17} />
            </span>
          </Link>
        ) : (
          <p className="muted">Kendi kaydı bulunamadı (veri onarımı gerekir).</p>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Liderim</h2>
        <p className="muted small">
          Üst liderinle ilgili hedefler, geri bildirimler ve notlar burada tutulur (ekip üyelerinden ayrı bir alan). Kendi serüvenini de kategorilerle işaretleyebilirsin.
        </p>
        <Link
          className="btn btn--primary btn--icon"
          to={teamLeader(teamId)}
          title="Liderim alanına git"
          aria-label="Liderim alanına git"
        >
          <span className="btn__icon">
            <IcArrowRight size={17} />
          </span>
        </Link>
      </section>

      <section className="card">
        <h2 className="card__title">Kişi ekle</h2>
        <form
          className="row"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!name.trim()) return;
            addPerson(teamId, name.trim(), title.trim() || undefined);
            setName('');
            setTitle('');
          }}
        >
          <input className="input" placeholder="Ad" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input input--grow"
            placeholder="Rol (isteğe bağlı)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="submit" variant="primary" icon={<IcPlus size={18} />}>
            Ekle
          </Button>
        </form>
      </section>

      <section className="card">
        <h2 className="card__title">Kişiler</h2>
        {members.length === 0 ? (
          <p className="muted">Henüz ekip üyesi yok.</p>
        ) : (
          <div className="tiles">
            {members.map((p) => (
              <div key={p.id} className="tile">
                <Link to={`${teamPeoplePath(teamId)}/${p.id}`} className="tile__link">
                  <div className="tile__name">{p.name}</div>
                  {p.title ? <div className="muted small">{p.title}</div> : <div className="muted small">Alan aç</div>}
                </Link>
                <Button type="button" variant="danger" size="sm" icon={<IcTrash size={16} />} onClick={() => removePerson(p.id)}>
                  Sil
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function PersonRoute() {
  const { personId, teamId } = useParams();
  const { data } = useAppData();
  if (!teamId || !personId) return <Navigate to={PATH_TEAMS} replace />;
  const p = data.people.find((x) => x.id === personId);
  if (!p || p.teamId !== teamId) return <Navigate to={teamPeoplePath(teamId)} replace />;
  if (isSelfPerson(p)) return <Navigate to={teamMe(teamId)} replace />;
  if (isLeaderPerson(p)) return <Navigate to={teamLeader(teamId)} replace />;
  return <PersonWorkspace personId={personId} />;
}

export function PersonWorkspace({ personId }: { personId: string }) {
  const { teamId } = useParams();
  const { data, updatePerson, addItem, updateItem, toggleItemDone, removeItem } = useAppData();
  const person = data.people.find((p) => p.id === personId);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [scratchpad, setScratchpad] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => data.items.filter((i) => i.personId === personId), [data.items, personId]);

  const categoryHints = useMemo(() => {
    if (!teamId) return [...SUGGESTED_CATEGORIES];
    return [...new Set([...SUGGESTED_CATEGORIES, ...distinctCategoriesForTeam(data, teamId)])];
  }, [data, teamId]);

  useEffect(() => {
    if (!person) {
      setName('');
      setTitle('');
      setScratchpad('');
      return;
    }
    setName(person.name);
    setTitle(person.title ?? '');
    setScratchpad(person.scratchpad ?? '');
  }, [person?.id, person?.name, person?.title, person?.scratchpad]);

  if (!teamId) {
    return (
      <div className="page">
        <p className="muted">Ekip bağlamı yok.</p>
        <Link to={PATH_TEAMS}>Ekipler</Link>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="page">
        <p>Kişi bulunamadı.</p>
        <Link to={teamPeoplePath(teamId)}>Ekip listesine dön</Link>
      </div>
    );
  }

  const isSelf = isSelfPerson(person);
  const isLeader = isLeaderPerson(person);

  return (
    <div className="page">
      <header className="page-head">
        <div className="row row--between">
          <div>
            <h1>{person.name}</h1>
            <p className="muted">
              {isLeader
                ? 'Üst liderinle ilişki: beklentiler, hedefler, görüşme notları ve serüven kayıtlarını burada topla.'
                : isSelf
                  ? 'Bu ekipteki kişisel liderlik alanın: görevler, notlar, hedefler ve linkler. İsteğe bağlı kategori ile serüvenini ayırabilirsin.'
                  : 'Bu kişiyle ilgili tüm takip içeriğini tek yerde tut.'}
            </p>
          </div>
          <Link className="btn btn--ghost" to={teamPeoplePath(teamId)}>
            Ekip listesi
          </Link>
        </div>
      </header>

      <section className="card">
        <h2 className="card__title">Profil</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!person) return;
            updatePerson(person.id, {
              name: name.trim() || person.name,
              title,
              scratchpad,
            });
          }}
        >
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="İsim" />
          <input
            className="input input--grow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rol / not"
          />
          <Button type="submit" variant="primary" icon={<IcSave size={18} />}>
            Kaydet
          </Button>
        </form>
        {isSelf ? (
          <p className="muted small" style={{ marginTop: 8 }}>
            &quot;Kendim&quot; etiketini bu ekip için özelleştirebilirsin.
          </p>
        ) : isLeader ? (
          <p className="muted small" style={{ marginTop: 8 }}>
            &quot;Liderim&quot; adını gerçek isimle değiştirebilirsin; kayıtlar aynı alanda kalır.
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2 className="card__title">Not alanı</h2>
        <p className="muted small">
          Serbest metin: 1:1 taslakları, akış notları, paylaşılacak düşünceler. Kaydet ile profil ile birlikte yazılır.
        </p>
        <textarea
          className="textarea"
          rows={8}
          placeholder="Buraya yaz…"
          value={scratchpad}
          onChange={(e) => setScratchpad(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <Button type="button" variant="secondary" icon={<IcSave size={17} />} onClick={() => person && updatePerson(person.id, { scratchpad })}>
            Notu kaydet
          </Button>
        </div>
      </section>

      <KindSection
        title="Görevler"
        kind="task"
        categoryHints={categoryHints}
        teamId={teamId}
        items={items}
        openId={openId}
        setOpenId={setOpenId}
        onAdd={(fields) => addItem(personId, 'task', fields)}
        onUpdate={updateItem}
        onToggle={toggleItemDone}
        onRemove={removeItem}
      />
      <KindSection
        title="Hedefler"
        kind="goal"
        categoryHints={categoryHints}
        teamId={teamId}
        items={items}
        openId={openId}
        setOpenId={setOpenId}
        onAdd={(fields) => addItem(personId, 'goal', fields)}
        onUpdate={updateItem}
        onToggle={toggleItemDone}
        onRemove={removeItem}
      />
      <KindSection
        title="Notlar (yapılandırılmış)"
        kind="note"
        categoryHints={categoryHints}
        teamId={teamId}
        items={items}
        openId={openId}
        setOpenId={setOpenId}
        onAdd={(fields) => addItem(personId, 'note', fields)}
        onUpdate={updateItem}
        onToggle={toggleItemDone}
        onRemove={removeItem}
      />
      <KindSection
        title="Dokümanlar"
        kind="document"
        categoryHints={categoryHints}
        teamId={teamId}
        items={items}
        openId={openId}
        setOpenId={setOpenId}
        onAdd={(fields) => addItem(personId, 'document', fields)}
        onUpdate={updateItem}
        onToggle={toggleItemDone}
        onRemove={removeItem}
      />
    </div>
  );
}

function KindSection({
  title,
  kind,
  categoryHints,
  teamId,
  items,
  openId,
  setOpenId,
  onAdd,
  onUpdate,
  onToggle,
  onRemove,
}: {
  title: string;
  kind: ItemKind;
  categoryHints: string[];
  teamId: string;
  items: Item[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onAdd: (
    fields: Partial<Pick<Item, 'title' | 'body' | 'dueAt' | 'startAt' | 'remindAt' | 'url' | 'category' | 'goalStatus'>>,
  ) => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<Item, 'title' | 'body' | 'dueAt' | 'startAt' | 'remindAt' | 'url' | 'done' | 'category' | 'goalStatus'>>,
  ) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const list = useMemo(() => items.filter((i) => i.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items, kind]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftStartAt, setDraftStartAt] = useState('');
  const [draftDueAt, setDraftDueAt] = useState('');
  const [draftGoalStatus, setDraftGoalStatus] = useState<GoalStatus>('planned');
  const listId = `cat-${teamId}-${kind}`;

  return (
    <section className="card">
      <div className="row row--between">
        <h2 className="card__title">
          {title} <span className="pill">{list.length}</span>
        </h2>
      </div>

      <form
        className={kind === 'goal' ? 'kind-form kind-form--goal' : 'row'}
        style={{ marginBottom: 12, flexDirection: kind === 'goal' ? 'column' : undefined, alignItems: 'stretch' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!draftTitle.trim() && kind !== 'document') return;
          if (kind === 'document' && !draftTitle.trim() && !draftUrl.trim()) return;
          if (kind === 'document') {
            onAdd({ title: draftTitle.trim() || 'Doküman', url: draftUrl.trim(), category: draftCategory.trim() || undefined });
          } else if (kind === 'goal') {
            onAdd({
              title: draftTitle.trim(),
              category: draftCategory.trim() || undefined,
              startAt: draftStartAt ? fromLocalDatetimeValue(draftStartAt) : undefined,
              dueAt: draftDueAt ? fromLocalDatetimeValue(draftDueAt) : undefined,
              goalStatus: draftGoalStatus,
            });
          } else {
            onAdd({ title: draftTitle.trim(), category: draftCategory.trim() || undefined });
          }
          setDraftTitle('');
          setDraftUrl('');
          setDraftCategory('');
          setDraftStartAt('');
          setDraftDueAt('');
          setDraftGoalStatus('planned');
        }}
      >
        {kind === 'goal' ? (
          <label className="field" style={{ marginTop: 0 }}>
            <span>Hedef (geniş metin)</span>
            <textarea
              className="textarea textarea--goal-title"
              rows={4}
              placeholder="Hedefini ayrıntılı yaz…"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          </label>
        ) : (
          <input
            className="input input--grow"
            placeholder={kind === 'document' ? 'Başlık (isteğe bağlı)' : 'Başlık'}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
          />
        )}
        <div className="row" style={{ flexWrap: 'wrap', marginTop: kind === 'goal' ? 8 : 0 }}>
          <input
            className="input"
            style={{ minWidth: 130 }}
            placeholder="Kategori (isteğe bağlı)"
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            list={listId}
          />
          <datalist id={listId}>
            {categoryHints.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {kind === 'goal' ? (
            <>
              <label className="field" style={{ minWidth: 200 }}>
                <span className="small">Başlangıç</span>
                <input type="datetime-local" className="input" value={draftStartAt} onChange={(e) => setDraftStartAt(e.target.value)} />
              </label>
              <label className="field" style={{ minWidth: 200 }}>
                <span className="small">Bitiş (deadline)</span>
                <input type="datetime-local" className="input" value={draftDueAt} onChange={(e) => setDraftDueAt(e.target.value)} />
              </label>
              <label className="field" style={{ minWidth: 160 }}>
                <span className="small">Durum</span>
                <select className="select" value={draftGoalStatus} onChange={(e) => setDraftGoalStatus(e.target.value as GoalStatus)}>
                  {GOAL_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          {kind === 'document' ? (
            <input className="input input--grow" placeholder="https://…" value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} />
          ) : null}
          <Button type="submit" variant="primary" icon={<IcPlus size={18} />}>
            Ekle
          </Button>
        </div>
      </form>

      {list.length === 0 ? (
        <p className="muted">Kayıt yok.</p>
      ) : (
        <ul className="list">
          {list.map((it) => (
            <li key={it.id} className="list__block">
              <div className="row row--between">
                <div>
                  <div className={`list__title${kind === 'goal' ? ' list__title--multiline' : ''}`}>
                    {it.kind === 'document' && it.url ? (
                      <a href={it.url} target="_blank" rel="noreferrer">
                        {it.title || it.url}
                      </a>
                    ) : (
                      it.title
                    )}{' '}
                    {it.done ? <span className="pill pill--ok">tamam</span> : null}
                    {it.kind === 'goal' ? <span className="pill">{goalStatusLabel(it.goalStatus)}</span> : null}
                  </div>
                  <div className="muted small">
                    {kindLabel(it.kind)}
                    {it.category ? ` · ${it.category}` : ''}
                    {it.kind === 'goal' && it.startAt ? ` · başlangıç ${formatShort(it.startAt)}` : ''}
                    {it.dueAt ? ` · bitiş ${formatShort(it.dueAt)}` : ''}
                    {it.dueAt && isPast(it.dueAt) && !it.done ? ' · gecikmiş' : ''}
                    {it.remindAt ? ` · hatırlat ${formatShort(it.remindAt)}` : ''}
                  </div>
                </div>
                <div className="row">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={openId === it.id ? <IcX size={16} /> : <IcPencil size={16} />}
                    onClick={() => setOpenId(openId === it.id ? null : it.id)}
                  >
                    {openId === it.id ? 'Kapat' : 'Düzenle'}
                  </Button>
                  {it.kind === 'task' || it.kind === 'goal' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={it.done ? <IcUndo size={16} /> : <IcCheck size={16} />}
                      onClick={() => onToggle(it.id)}
                    >
                      {it.done ? 'Aç' : 'Tamam'}
                    </Button>
                  ) : null}
                  <Button type="button" variant="danger" size="sm" icon={<IcTrash size={16} />} onClick={() => onRemove(it.id)}>
                    Sil
                  </Button>
                </div>
              </div>

              {openId === it.id ? (
                <div className="editor">
                  <label className="field">
                    <span>{it.kind === 'goal' ? 'Hedef metni' : 'Başlık'}</span>
                    {it.kind === 'goal' ? (
                      <textarea
                        className="textarea textarea--goal-title"
                        rows={5}
                        defaultValue={it.title}
                        key={`t-${it.id}-${it.updatedAt}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== it.title) onUpdate(it.id, { title: v });
                        }}
                      />
                    ) : (
                      <input
                        className="input"
                        defaultValue={it.title}
                        key={`t-${it.id}-${it.updatedAt}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== it.title) onUpdate(it.id, { title: v });
                        }}
                      />
                    )}
                  </label>
                  {it.kind === 'document' ? (
                    <label className="field">
                      <span>Adres</span>
                      <input
                        className="input"
                        defaultValue={it.url ?? ''}
                        key={`u-${it.id}-${it.updatedAt}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (it.url ?? '')) onUpdate(it.id, { url: v });
                        }}
                      />
                    </label>
                  ) : null}
                  <label className="field">
                    <span>Kategori (isteğe bağlı)</span>
                    <input
                      className="input"
                      defaultValue={it.category ?? ''}
                      key={`c-${it.id}-${it.updatedAt}`}
                      list={`${listId}-edit-${it.id}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (it.category ?? '')) onUpdate(it.id, { category: v });
                      }}
                    />
                    <datalist id={`${listId}-edit-${it.id}`}>
                      {categoryHints.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </label>
                  {it.kind === 'goal' ? (
                    <label className="field">
                      <span>Durum</span>
                      <select
                        className="select"
                        defaultValue={it.goalStatus ?? 'planned'}
                        key={`gs-${it.id}-${it.updatedAt}-${it.goalStatus ?? ''}`}
                        onChange={(e) => onUpdate(it.id, { goalStatus: e.target.value as GoalStatus })}
                      >
                        {GOAL_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="field">
                    <span>İçerik</span>
                    <textarea
                      className="textarea"
                      defaultValue={it.body}
                      key={`b-${it.id}-${it.updatedAt}`}
                      rows={5}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== it.body) onUpdate(it.id, { body: v });
                      }}
                    />
                  </label>
                  {it.kind === 'goal' ? (
                    <label className="field">
                      <span>Başlangıç</span>
                      <input
                        type="datetime-local"
                        className="input"
                        defaultValue={toLocalDatetimeValue(it.startAt)}
                        key={`s-${it.id}-${it.updatedAt}`}
                        onBlur={(e) => onUpdate(it.id, { startAt: fromLocalDatetimeValue(e.target.value) })}
                      />
                    </label>
                  ) : null}
                  {it.kind === 'task' || it.kind === 'goal' ? (
                    <label className="field">
                      <span>{it.kind === 'goal' ? 'Bitiş (deadline)' : 'Bitiş zamanı'}</span>
                      <input
                        type="datetime-local"
                        className="input"
                        defaultValue={toLocalDatetimeValue(it.dueAt)}
                        key={`d-${it.id}-${it.updatedAt}`}
                        onBlur={(e) => onUpdate(it.id, { dueAt: fromLocalDatetimeValue(e.target.value) })}
                      />
                    </label>
                  ) : null}
                  <label className="field">
                    <span>Hatırlatıcı (masaüstü bildirimi)</span>
                    <input
                      type="datetime-local"
                      className="input"
                      defaultValue={toLocalDatetimeValue(it.remindAt)}
                      key={`r-${it.id}-${it.updatedAt}`}
                      onBlur={(e) => onUpdate(it.id, { remindAt: fromLocalDatetimeValue(e.target.value) })}
                    />
                  </label>
                </div>
              ) : it.body ? (
                <pre className="pre">{it.body}</pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
