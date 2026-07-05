"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Card, PriorityBadge } from "@/components/cockpit/ui";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  TASK_BUCKET_LABEL,
  TASK_BUCKET_ORDER,
  fmtDay,
  taskBucket,
  type TaskPriority,
  type TeamCategory,
  type TeamMember,
  type TeamTask,
} from "@/lib/team/types";
import { createTask, deleteTask, toggleTask } from "@/lib/team/actions";

const PRIORITIES: TaskPriority[] = ["hoch", "mittel", "niedrig"];

export function TeamTasksClient({
  initial,
  members,
  today,
}: {
  initial: TeamTask[];
  members: TeamMember[];
  today: string;
}) {
  const [tasks, setTasks] = useState<TeamTask[]>(initial);
  // Nach revalidatePath liefert der Server frische Props → State nachziehen.
  useEffect(() => setTasks(initial), [initial]);

  const [filter, setFilter] = useState<TeamCategory | "alle">("alle");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tmpId = useRef(0);

  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today);
  const [prio, setPrio] = useState<TaskPriority>("mittel");
  const [category, setCategory] = useState<TeamCategory>("sales");
  const [assignee, setAssignee] = useState<string>("");

  const memberName = (id: string | null) => {
    const m = members.find((x) => x.id === id);
    if (!m) return null;
    const name = m.display_name?.trim().split(/\s+/)[0] || "—";
    return `${m.avatar_emoji ?? ""} ${name}`.trim();
  };

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setError(null);
    const optimistic: TeamTask = {
      id: `tmp-${++tmpId.current}`,
      org_id: "",
      title: t,
      due_date: due || null,
      priority: prio,
      category,
      done: false,
      assigned_to: assignee || null,
      created_at: "",
      updated_at: "",
    };
    const before = tasks;
    setTasks((prev) => [optimistic, ...prev]);
    setTitle("");
    startTransition(async () => {
      const res = await createTask({
        title: t,
        due_date: due || null,
        priority: prio,
        category,
        assigned_to: assignee || null,
      });
      if (!res.ok) {
        setError(res.error);
        setTasks(before);
      }
    });
  }

  function toggle(task: TeamTask) {
    if (task.id.startsWith("tmp-")) return;
    const before = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    setError(null);
    startTransition(async () => {
      const res = await toggleTask(task.id, !task.done);
      if (!res.ok) {
        setError(res.error);
        setTasks(before);
      }
    });
  }

  function remove(task: TeamTask) {
    if (task.id.startsWith("tmp-")) return;
    const before = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setError(null);
    startTransition(async () => {
      const res = await deleteTask(task.id);
      if (!res.ok) {
        setError(res.error);
        setTasks(before);
      }
    });
  }

  const visible = filter === "alle" ? tasks : tasks.filter((t) => t.category === filter);
  const open = visible.filter((t) => !t.done);
  const doneTasks = visible.filter((t) => t.done);

  return (
    <div className="space-y-6">
      {/* Neue Aufgabe */}
      <Card className="p-4">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[220px]">
            <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
              Neue Aufgabe
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Instagram-Kampagne planen"
              className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
              Fällig
            </span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
              Priorität
            </span>
            <select
              value={prio}
              onChange={(e) => setPrio(e.target.value as TaskPriority)}
              className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p === "hoch" ? "Hoch" : p === "mittel" ? "Mittel" : "Niedrig"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
              Bereich
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TeamCategory)}
              className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
              Zuständig
            </span>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
            >
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.avatar_emoji ?? ""} {m.display_name ?? "—"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="rounded-md bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending ? "Speichern…" : "Hinzufügen"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-[color:var(--color-accent)]">{error}</p>}
      </Card>

      {/* Bereichs-Filter */}
      <div className="flex flex-wrap gap-2">
        {(["alle", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              filter === c
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                : "border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
            }`}
          >
            {c === "alle" ? "Alle" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* Offene Aufgaben nach Fälligkeit */}
      <Card className="p-4">
        {TASK_BUCKET_ORDER.map((bucket) => {
          const list = open
            .filter((t) => taskBucket(t.due_date, today) === bucket)
            .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
          if (list.length === 0) return null;
          return (
            <div key={bucket} className="mb-4 last:mb-0">
              <h2
                className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                  bucket === "ueberfaellig"
                    ? "text-[color:var(--color-accent)]"
                    : "text-[color:var(--color-muted)]"
                }`}
              >
                {TASK_BUCKET_LABEL[bucket]} ({list.length})
              </h2>
              <div className="divide-y divide-[color:var(--color-border)]">
                {list.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    assignee={memberName(t.assigned_to)}
                    onToggle={() => toggle(t)}
                    onDelete={() => remove(t)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {open.length === 0 && (
          <p className="text-sm text-[color:var(--color-muted)]">Keine offenen Aufgaben. 🎉</p>
        )}
      </Card>

      {/* Erledigt */}
      {doneTasks.length > 0 && (
        <Card className="p-4 opacity-60">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
            Erledigt ({doneTasks.length})
          </h2>
          <div className="divide-y divide-[color:var(--color-border)]">
            {doneTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                assignee={memberName(t.assigned_to)}
                onToggle={() => toggle(t)}
                onDelete={() => remove(t)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function TaskRow({
  task,
  assignee,
  onToggle,
  onDelete,
}: {
  task: TeamTask;
  assignee: string | null;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <button
        onClick={onToggle}
        aria-label={task.done ? "Als offen markieren" : "Als erledigt markieren"}
        className={`w-5 h-5 shrink-0 rounded border grid place-items-center transition ${
          task.done
            ? "bg-[color:var(--color-accent)] border-[color:var(--color-accent)]"
            : "border-[color:var(--color-border)] hover:border-[color:var(--color-accent)]"
        }`}
      >
        {task.done && (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
            <path d="M2 6l3 3 5-6" stroke="var(--color-accent-fg)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${task.done ? "line-through" : ""}`}>{task.title}</div>
        <div className="flex items-center gap-2 text-[10px] text-[color:var(--color-muted)]">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: CATEGORY_COLOR[task.category] }}
            />
            {CATEGORY_LABEL[task.category]}
          </span>
          {assignee && <span>· {assignee}</span>}
        </div>
      </div>
      <PriorityBadge priority={task.priority} />
      <span className="text-xs text-[color:var(--color-muted)] tabular-nums shrink-0 w-14 text-right">
        {task.due_date ? fmtDay(task.due_date) : "—"}
      </span>
      <button
        onClick={onDelete}
        aria-label="Aufgabe löschen"
        className="opacity-0 group-hover:opacity-100 text-[color:var(--color-muted)] hover:text-[color:var(--color-accent)] transition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
