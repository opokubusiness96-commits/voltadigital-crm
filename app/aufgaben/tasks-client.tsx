"use client";

import { useState } from "react";
import {
  type Task,
  type Priority,
  type TaskBucket,
  TASK_BUCKET_LABEL,
  PRIORITY_LABEL,
  CLIENTS,
  clientName,
  fmtDate,
  taskBucket,
  day,
} from "@/lib/mock/agency";
import { Card, PriorityBadge } from "@/components/cockpit/ui";

const BUCKET_ORDER: TaskBucket[] = ["ueberfaellig", "heute", "woche", "spaeter"];

export function TasksClient({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [filter, setFilter] = useState<Priority | "alle">("alle");
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState<Priority>("mittel");
  const [client, setClient] = useState(CLIENTS[0].slug);
  const [due, setDue] = useState(day(0));

  const toggle = (id: string) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setTasks((ts) => [
      { id: `t${Date.now()}`, title: title.trim(), client, priority: prio, due, done: false },
      ...ts,
    ]);
    setTitle("");
  }

  const visible = tasks.filter((t) => filter === "alle" || t.priority === filter);
  const open = visible.filter((t) => !t.done);
  const done = visible.filter((t) => t.done);

  const inputCls =
    "bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded-md px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]";

  return (
    <div className="space-y-6">
      {/* Schnell-Eingabe */}
      <Card className="p-4">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Neue Aufgabe…"
            className={inputCls}
          />
          <select value={client} onChange={(e) => setClient(e.target.value)} className={inputCls}>
            {CLIENTS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={prio} onChange={(e) => setPrio(e.target.value as Priority)} className={inputCls}>
            {(["hoch", "mittel", "niedrig"] as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
          <button className="bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold rounded-md px-4 text-sm">
            Hinzufügen
          </button>
        </form>
      </Card>

      {/* Prio-Filter */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[color:var(--color-muted)] mr-1">Priorität:</span>
        {(["alle", "hoch", "mittel", "niedrig"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              filter === p
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                : "border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
            }`}
          >
            {p === "alle" ? "Alle" : PRIORITY_LABEL[p as Priority]}
          </button>
        ))}
        <span className="ml-auto text-xs text-[color:var(--color-muted)]">
          {open.length} offen · {done.length} erledigt
        </span>
      </div>

      {/* Gruppen */}
      {BUCKET_ORDER.map((bucket) => {
        const items = open.filter((t) => taskBucket(t.due) === bucket);
        if (items.length === 0) return null;
        const isOverdue = bucket === "ueberfaellig";
        return (
          <section key={bucket}>
            <h2
              className={`mb-2 text-xs font-semibold uppercase tracking-wider ${
                isOverdue ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-muted)]"
              }`}
            >
              {TASK_BUCKET_LABEL[bucket]} · {items.length}
            </h2>
            <Card className="divide-y divide-[color:var(--color-border)]">
              {items.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} />
              ))}
            </Card>
          </section>
        );
      })}

      {/* Erledigt */}
      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
            Erledigt · {done.length}
          </h2>
          <Card className="divide-y divide-[color:var(--color-border)] opacity-60">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} />
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => onToggle(task.id)}
        aria-label={task.done ? "Als offen markieren" : "Als erledigt markieren"}
        className={`shrink-0 w-5 h-5 rounded-md border grid place-items-center transition ${
          task.done
            ? "bg-[color:var(--color-accent)] border-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]"
            : "border-[color:var(--color-border)] hover:border-[color:var(--color-accent)]"
        }`}
      >
        {task.done && (
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${task.done ? "line-through text-[color:var(--color-muted)]" : ""}`}>
          {task.title}
        </div>
        <div className="text-xs text-[color:var(--color-muted)]">{clientName(task.client)}</div>
      </div>
      <PriorityBadge priority={task.priority} />
      <span className="text-xs text-[color:var(--color-muted)] tabular-nums w-14 text-right shrink-0">
        {fmtDate(task.due)}
      </span>
    </div>
  );
}
