"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  STAGES,
  STAGE_LABEL,
  STAGE_BADGE,
  LOST_STAGES,
  BUSINESS_YEARS_LABEL,
  REVENUE_LABEL,
  TAG_CATEGORY_COLOR,
  TAG_CATEGORY_LABEL,
  TAG_CATEGORY_ORDER,
  type Stage,
  type Lead,
  type Profile,
  type Tag,
  type TagCategoryId,
  type LeadTagLink,
} from "@/lib/types";
import { cn, formatEUR, timeAgo } from "@/lib/utils";
import { updateLead, claimLead, addTagToLead, removeTagFromLead } from "../leads/actions";
import { LeadCardActionMenu } from "@/components/crm/LeadCardActionMenu";

type Props = {
  leads: Lead[];
  profiles: Profile[];
  lastActivityByLead: Record<string, string>;
  currentUserId: string;
  tags: Tag[];
  leadTags: LeadTagLink[];
  orgName?: string;
};

export function BoardClient({ leads: initialLeads, profiles, lastActivityByLead, currentUserId, tags, leadTags: initialLeadTags, orgName }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [leadTags, setLeadTags] = useState<LeadTagLink[]>(initialLeadTags);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingLostStage, setPendingLostStage] = useState<{ leadId: string; toStage: Stage } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tagPopupLeadId, setTagPopupLeadId] = useState<string | null>(null);
  // Filter-State
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [filterOwnerIds, setFilterOwnerIds] = useState<Set<string>>(new Set());
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  useEffect(() => setMounted(true), []);

  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const tagsByLeadId = new Map<string, Tag[]>();
  for (const lt of leadTags) {
    const t = tagsById.get(lt.tag_id);
    if (!t) continue;
    if (!tagsByLeadId.has(lt.lead_id)) tagsByLeadId.set(lt.lead_id, []);
    tagsByLeadId.get(lt.lead_id)!.push(t);
  }

  // Sichtbare Leads nach Filter berechnen
  const filteredLeads = leads.filter((l) => {
    if (filterUnassigned && l.owner_id) return false;
    if (filterOwnerIds.size > 0) {
      if (!l.owner_id || !filterOwnerIds.has(l.owner_id)) return false;
    }
    if (filterTagIds.size > 0) {
      const leadTagIds = (tagsByLeadId.get(l.id) ?? []).map((t) => t.id);
      // AND-Logik: Lead muss ALLE selektierten Tags haben
      for (const tid of filterTagIds) {
        if (!leadTagIds.includes(tid)) return false;
      }
    }
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      const haystack = [l.name, l.first_name, l.last_name, l.email, l.phone]
        .filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const hasActiveFilter = filterTagIds.size > 0 || filterOwnerIds.size > 0 || filterUnassigned || filterSearch.trim().length > 0;

  function handleAddTag(leadId: string, tagId: string) {
    if (leadTags.some((lt) => lt.lead_id === leadId && lt.tag_id === tagId)) return;
    const before = leadTags;
    setLeadTags((prev) => [...prev, { lead_id: leadId, tag_id: tagId }]);
    setError(null);
    startTransition(async () => {
      const res = await addTagToLead(leadId, tagId);
      if (!res.ok) { setError(res.error ?? "Fehler"); setLeadTags(before); }
    });
  }

  function handleRemoveTag(leadId: string, tagId: string) {
    const before = leadTags;
    setLeadTags((prev) => prev.filter((lt) => !(lt.lead_id === leadId && lt.tag_id === tagId)));
    setError(null);
    startTransition(async () => {
      const res = await removeTagFromLead(leadId, tagId);
      if (!res.ok) { setError(res.error ?? "Fehler"); setLeadTags(before); }
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const [activeDragData, setActiveDragData] = useState<
    | { type: "card"; id: string }
    | { type: "user"; userId: string; color: string; label: string }
    | null
  >(null);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    const data = event.active.data.current;
    if (data?.type === "user") {
      setActiveDragData({
        type: "user",
        userId: data.userId as string,
        color: data.color as string,
        label: data.label as string,
      });
    } else {
      setActiveDragData({ type: "card", id: String(event.active.id) });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setActiveDragData(null);
    const { active, over } = event;
    if (!over) return;

    // Drag-Type 1: User-Avatar wird auf Lead-Karte gezogen → Claim
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    if (activeType === "user" && overType === "lead") {
      const userId = active.data.current?.userId as string;
      const leadId = over.data.current?.leadId as string;
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || !userId) return;
      const before = leads;
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, owner_id: userId } : l)));
      setError(null);
      startTransition(async () => {
        const res = await claimLead(leadId, userId);
        if (!res.ok) {
          setError(res.error ?? "Fehler beim Zuweisen");
          setLeads(before);
        }
      });
      return;
    }

    // Drag-Type 2: Lead-Karte wird auf Stage-Spalte gezogen → Stage-Wechsel
    if (activeType !== "user") {
      const leadId = String(active.id);
      const toStage = String(over.id) as Stage;
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.stage === toStage) return;
      // Wenn over ist eine Lead-Card statt einer Stage-Spalte, ignorieren
      if (overType === "lead") return;

      if (LOST_STAGES.has(toStage)) {
        setPendingLostStage({ leadId, toStage });
        return;
      }
      moveLead(leadId, toStage);
    }
  }

  function handleUntag(leadId: string) {
    const before = leads;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, owner_id: null } : l)));
    setError(null);
    startTransition(async () => {
      const res = await claimLead(leadId, null);
      if (!res.ok) {
        setError(res.error ?? "Fehler beim Entfernen");
        setLeads(before);
      }
    });
  }

  function moveLead(leadId: string, toStage: Stage, lostReason?: string) {
    const before = leads;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: toStage, ...(lostReason ? { lost_reason: lostReason } : {}) } : l)));
    setError(null);
    startTransition(async () => {
      const res = await updateLead(leadId, lostReason ? { stage: toStage, lost_reason: lostReason } : { stage: toStage });
      if (!res.ok) {
        setError(res.error ?? "Fehler beim Speichern");
        setLeads(before); // revert
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3 px-2 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">
            Pipeline
            {orgName && (
              <span className="text-[color:var(--color-muted)] font-normal"> · {orgName}</span>
            )}
          </h1>
          <p className="text-xs text-[color:var(--color-muted)]">
            {hasActiveFilter
              ? `${filteredLeads.length} von ${leads.length} Leads (gefiltert)`
              : `${leads.length} Leads · Karte ziehen zum Stage-Wechsel · User-Kreis auf Lead ziehen zum Taggen`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {pending && <span className="text-[color:var(--color-muted)] text-xs">speichern…</span>}
          <Link
            href="/list"
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
          >
            Liste-Ansicht
          </Link>
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] font-semibold px-3 py-1.5 hover:opacity-90 transition"
          >
            + Lead hinzufügen
          </Link>
        </div>
      </div>

      {/* Filter-Bar */}
      <div className="mb-4 px-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="🔍 Name oder Email…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md px-2 py-1 text-xs outline-none focus:border-[color:var(--color-accent)] w-44"
        />

        {/* Person-Filter via User-Avatare */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[color:var(--color-muted)] uppercase tracking-wider mr-0.5">Person:</span>
          {profiles.filter((p) => !!p.marker_color).map((p) => {
            const active = filterOwnerIds.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setFilterOwnerIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.id)) next.delete(p.id);
                    else next.add(p.id);
                    return next;
                  });
                  setFilterUnassigned(false);
                }}
                title={`Filter auf ${p.display_name || p.email}`}
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 transition-all",
                  active ? "scale-110 shadow" : "opacity-50 hover:opacity-100",
                )}
                style={{
                  background: p.marker_color ?? "#666",
                  borderColor: active ? (p.marker_color ?? "#fff") : "transparent",
                }}
              >
                {p.avatar_emoji ? (
                  <span className="text-[14px] leading-none">{p.avatar_emoji}</span>
                ) : (
                  <span className="text-[9px] font-bold uppercase text-white">
                    {(p.display_name || p.email).slice(0, 2)}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setFilterUnassigned((v) => !v);
              setFilterOwnerIds(new Set());
            }}
            title="Nur ungetaggte Leads"
            className={cn(
              "ml-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
              filterUnassigned
                ? "bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] border-[color:var(--color-accent)]"
                : "border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]",
            )}
          >
            Ungetaggt
          </button>
        </div>


        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setFilterTagIds(new Set());
              setFilterOwnerIds(new Set());
              setFilterUnassigned(false);
              setFilterSearch("");
            }}
            className="ml-auto text-[10px] text-[color:var(--color-muted)] hover:text-[color:var(--color-red)] underline"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 px-2 text-sm text-[color:var(--color-red)]">{error}</p>
      )}

      {mounted ? (
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 flex-1 min-h-0">
        <UserDock profiles={profiles.filter((p) => !!p.marker_color)} />
        <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-4 snap-x items-stretch">
          {STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stage);
            const totalValue = stageLeads.reduce(
              (sum, l) => sum + Number(l.value_estimate ?? 0),
              0,
            );
            return (
              <Column
                key={stage}
                stage={stage}
                count={stageLeads.length}
                totalValue={totalValue}
              >
                {stageLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    lead={lead}
                    owner={lead.owner_id ? profileById.get(lead.owner_id) ?? null : null}
                    lastActivity={lastActivityByLead[lead.id]}
                    currentUserId={currentUserId}
                    onUntag={handleUntag}
                    leadTags={tagsByLeadId.get(lead.id) ?? []}
                    onOpenTagPopup={() => setTagPopupLeadId(lead.id)}
                    onRemoveTag={(tagId) => handleRemoveTag(lead.id, tagId)}
                    allTags={tags}
                    onMoveStage={(toStage) => {
                      if (LOST_STAGES.has(toStage)) {
                        setPendingLostStage({ leadId: lead.id, toStage });
                      } else {
                        moveLead(lead.id, toStage);
                      }
                    }}
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </div>

        <DragOverlay dropAnimation={null}>
          {activeDragData?.type === "user" ? (
            <UserChip color={activeDragData.color} label={activeDragData.label} dragging />
          ) : activeDragData?.type === "card" ? (
            <CardShell
              lead={leads.find((l) => l.id === activeDragData.id)!}
              owner={(() => {
                const l = leads.find((x) => x.id === activeDragData.id);
                return l?.owner_id ? profileById.get(l.owner_id) ?? null : null;
              })()}
              lastActivity={undefined}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      ) : (
        <div className="px-2 text-sm text-[color:var(--color-muted)]">Lade Pipeline…</div>
      )}

      {pendingLostStage && (
        <LostReasonModal
          leadId={pendingLostStage.leadId}
          toStage={pendingLostStage.toStage}
          onCancel={() => setPendingLostStage(null)}
          onConfirm={(reason) => {
            moveLead(pendingLostStage.leadId, pendingLostStage.toStage, reason);
            setPendingLostStage(null);
          }}
        />
      )}

      {tagPopupLeadId && (
        <TagPopup
          tags={tags}
          activeTagIds={(tagsByLeadId.get(tagPopupLeadId) ?? []).map((t) => t.id)}
          onAdd={(tagId) => handleAddTag(tagPopupLeadId, tagId)}
          onRemove={(tagId) => handleRemoveTag(tagPopupLeadId, tagId)}
          onClose={() => setTagPopupLeadId(null)}
        />
      )}
    </>
  );
}

const NARROW_STAGES: ReadonlySet<Stage> = new Set(["klarheitsgespraech_lost"]);

function Column({
  stage,
  count,
  totalValue,
  children,
}: {
  stage: Stage;
  count: number;
  totalValue: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const narrow = NARROW_STAGES.has(stage);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 rounded-lg border bg-[color:var(--color-surface)] flex flex-col snap-start",
        narrow ? "w-36" : "w-44",
        isOver
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-surface-2)]"
          : "border-[color:var(--color-border)]",
      )}
    >
      <div className="px-2 py-1.5 border-b border-[color:var(--color-border)] flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis", STAGE_BADGE[stage])}>
          {STAGE_LABEL[stage]}
        </span>
        <span className="text-[11px] text-[color:var(--color-muted)] shrink-0">
          {count}{totalValue > 0 && ` · ${formatEUR(totalValue)}`}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1.5">{children}</div>
    </div>
  );
}

function Card({
  lead,
  owner,
  lastActivity,
  currentUserId,
  onUntag,
  leadTags,
  onOpenTagPopup,
  onRemoveTag,
  allTags,
  onMoveStage,
}: {
  lead: Lead;
  owner: Profile | null;
  lastActivity: string | undefined;
  currentUserId: string;
  onUntag: (leadId: string) => void;
  leadTags: Tag[];
  onOpenTagPopup: () => void;
  onRemoveTag: (tagId: string) => void;
  allTags: Tag[];
  onMoveStage: (toStage: Stage) => void;
}) {
  const drag = useDraggable({ id: lead.id, data: { type: "card" } });
  const drop = useDroppable({ id: `lead-${lead.id}`, data: { type: "lead", leadId: lead.id } });
  const setRef = (el: HTMLDivElement | null) => {
    drag.setNodeRef(el);
    drop.setNodeRef(el);
  };
  return (
    <div
      ref={setRef}
      {...drag.attributes}
      {...drag.listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-shadow",
        drag.isDragging && "opacity-30",
        drop.isOver && "ring-2 ring-offset-1 ring-offset-[color:var(--color-surface)]",
      )}
      style={drop.isOver && drop.active?.data.current?.type === "user"
        ? { boxShadow: `0 0 0 2px ${(drop.active.data.current as { color?: string }).color ?? "#c9a961"}` }
        : undefined}
    >
      <CardShell
        lead={lead}
        owner={owner}
        lastActivity={lastActivity}
        currentUserId={currentUserId}
        onUntag={onUntag}
        leadTags={leadTags}
        onOpenTagPopup={onOpenTagPopup}
        onRemoveTag={onRemoveTag}
        allTags={allTags}
        onMoveStage={onMoveStage}
      />
    </div>
  );
}

function CardShell({
  lead,
  owner,
  lastActivity,
  dragging,
  currentUserId,
  onUntag,
  leadTags,
  onOpenTagPopup,
  onRemoveTag,
  allTags,
  onMoveStage,
}: {
  lead: Lead;
  owner: Profile | null;
  lastActivity: string | undefined;
  dragging?: boolean;
  currentUserId?: string;
  onUntag?: (leadId: string) => void;
  leadTags?: Tag[];
  onOpenTagPopup?: () => void;
  onRemoveTag?: (tagId: string) => void;
  allTags?: Tag[];
  onMoveStage?: (toStage: Stage) => void;
}) {
  const dotColor = activityDot(lastActivity);
  const displayName =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.name || "Unbenannt";
  const ownerColor = owner?.marker_color ?? null;
  const ownerInitials = owner ? (owner.display_name || owner.email).slice(0, 2).toUpperCase() : null;

  function onClaimClick(e: React.MouseEvent | React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) return;
    if (owner?.id === currentUserId) {
      // Toggle off (release)
      claimLead(lead.id, null);
    } else {
      claimLead(lead.id, currentUserId);
    }
  }

  const ownerLabel = owner
    ? owner.display_name || owner.email.split("@")[0]
    : null;

  return (
    <div
      className={cn(
        "relative rounded border bg-[color:var(--color-surface-2)] border-[color:var(--color-border)] px-2 py-1.5 text-sm hover:border-[color:var(--color-accent)] transition-colors",
        dragging && "shadow-2xl border-[color:var(--color-accent)] rotate-2",
      )}
    >
      <div className="flex items-start gap-1.5">
        <Link
          href={`/leads/${lead.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 font-medium hover:underline text-[13px] leading-tight truncate"
        >
          {displayName}
        </Link>
        {allTags && onOpenTagPopup && onMoveStage && (
          <LeadCardActionMenu
            lead={lead}
            allTags={allTags}
            leadTagIds={(leadTags ?? []).map((t) => t.id)}
            onOpenTagPopup={onOpenTagPopup}
            onMoveStage={onMoveStage}
          />
        )}
        {owner && ownerColor && (
          <button
            type="button"
            title={`${ownerLabel} — klick zum Entfernen`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUntag?.(lead.id);
            }}
            className="shrink-0 group relative w-6 h-6 rounded-full flex items-center justify-center shadow hover:scale-110 transition-transform border-2"
            style={{ background: ownerColor, borderColor: `${ownerColor}` }}
            aria-label={`${ownerLabel} entfernen`}
          >
            {owner.avatar_emoji ? (
              <span className="text-[14px] leading-none">{owner.avatar_emoji}</span>
            ) : (
              <span className="text-[9px] font-bold uppercase text-white">
                {ownerLabel?.slice(0, 2)}
              </span>
            )}
            <span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-black/70 text-white text-[10px] leading-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden
            >
              ×
            </span>
          </button>
        )}
      </div>

      {(lead.email || lead.phone) && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-[color:var(--color-muted)]">
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="hover:text-[color:var(--color-text)] truncate max-w-full min-w-0"
            >
              ✉ {lead.email}
            </a>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="hover:text-[color:var(--color-text)]"
            >
              ☎ {lead.phone}
            </a>
          )}
        </div>
      )}

      {(lead.business_years || lead.revenue_band) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {lead.business_years && (
            <span
              title="Seit wann Unternehmer"
              className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-border)]/40 text-[color:var(--color-muted)] leading-tight"
            >
              👤 {BUSINESS_YEARS_LABEL[lead.business_years] ?? lead.business_years}
            </span>
          )}
          {lead.revenue_band && (
            <span
              title="Letzter Jahresumsatz"
              className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-border)]/40 text-[color:var(--color-muted)] leading-tight"
            >
              💰 {REVENUE_LABEL[lead.revenue_band] ?? lead.revenue_band}
            </span>
          )}
        </div>
      )}

      {/* Tags + Info-Tag Button */}
      {(leadTags && leadTags.length > 0) || onOpenTagPopup ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {(leadTags ?? []).map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-0.5 rounded-full pl-1.5 pr-0.5 py-0.5 text-[10px] font-medium leading-tight border"
              style={{
                background: `${TAG_CATEGORY_COLOR[t.category_id]}26`,
                borderColor: `${TAG_CATEGORY_COLOR[t.category_id]}66`,
                color: TAG_CATEGORY_COLOR[t.category_id],
              }}
            >
              {t.label}
              {onRemoveTag && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveTag(t.id);
                  }}
                  className="w-3 h-3 rounded-full hover:bg-white/10 inline-flex items-center justify-center text-[12px] leading-none"
                  title="Tag entfernen"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {onOpenTagPopup && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenTagPopup();
              }}
              title="Tag hinzufügen"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[color:var(--color-border)]/60 hover:bg-[color:var(--color-accent)] hover:text-[color:var(--color-accent-fg)] text-[12px] leading-none text-[color:var(--color-muted)]"
            >
              +
            </button>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between mt-1 text-[10px] text-[color:var(--color-muted)]">
        <span className="flex items-center gap-1">
          <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
          {lastActivity ? timeAgo(lastActivity) : timeAgo(lead.updated_at)}
        </span>
        {lead.value_estimate != null && (
          <span>{formatEUR(lead.value_estimate)}</span>
        )}
      </div>
    </div>
  );
}

// Bekannte Team-Mitglieder die noch keinen Auth-Account haben
// → werden als inaktive Placeholder angezeigt bis ihr Account angelegt wird.
// ACHTUNG: rendert mandantenunabhängig für ALLE Orgs — deshalb leer lassen,
// solange es keine org-gescopte Lösung gibt (Jerome-Altlast "Simon" entfernt).
const PENDING_TEAM_MEMBERS: Array<{ display_name: string; marker_color: string; emailHint: string }> = [];

function UserDock({ profiles }: { profiles: Profile[] }) {
  const realLabels = new Set(
    profiles
      .map((p) => (p.display_name || "").toLowerCase())
      .filter(Boolean),
  );
  const pendingToShow = PENDING_TEAM_MEMBERS.filter(
    (p) => !realLabels.has(p.display_name.toLowerCase()),
  );
  if (!profiles.length && !pendingToShow.length) return null;
  return (
    <div className="shrink-0 sticky top-2 self-start flex flex-col items-center gap-2 px-2 py-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <span className="text-[9px] uppercase tracking-wider text-[color:var(--color-muted)]">Tag</span>
      {profiles.map((p) => (
        <DraggableUserChip key={p.id} profile={p} />
      ))}
      {pendingToShow.map((p) => (
        <PendingUserChip key={p.display_name} display_name={p.display_name} marker_color={p.marker_color} />
      ))}
    </div>
  );
}

function PendingUserChip({
  display_name,
  marker_color,
}: {
  display_name: string;
  marker_color: string;
}) {
  return (
    <div
      title={`${display_name}: Account muss noch angelegt werden — danach automatisch aktiv`}
      className="opacity-40 cursor-not-allowed"
    >
      <UserChip color={marker_color} label={display_name} />
    </div>
  );
}

function DraggableUserChip({ profile }: { profile: Profile }) {
  const label = (profile.display_name || profile.email.split("@")[0]).split(/[\s.@]/)[0];
  const color = profile.marker_color ?? "#c9a961";
  const emoji = profile.avatar_emoji ?? null;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `user-${profile.id}`,
    data: { type: "user", userId: profile.id, color, label, emoji },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`${label} taggen — auf einen Lead ziehen`}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-transform",
        isDragging && "opacity-30",
      )}
    >
      <UserChip color={color} label={label} emoji={emoji} />
    </div>
  );
}

function UserChip({
  color,
  label,
  emoji,
  dragging,
}: {
  color: string;
  label: string;
  emoji?: string | null;
  dragging?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        className={cn(
          "w-9 h-9 rounded-full border-2 border-white/20 flex items-center justify-center shadow",
          dragging && "shadow-2xl scale-110",
        )}
        style={{ background: color }}
      >
        {emoji ? (
          <span className="text-[18px] leading-none">{emoji}</span>
        ) : (
          <span className="text-[12px] font-bold uppercase text-white">{label.slice(0, 2)}</span>
        )}
      </div>
      <span className="text-[10px] font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function TagPopup({
  tags,
  activeTagIds,
  onAdd,
  onRemove,
  onClose,
}: {
  tags: Tag[];
  activeTagIds: string[];
  onAdd: (tagId: string) => void;
  onRemove: (tagId: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const activeSet = new Set(activeTagIds);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = filter.trim()
    ? tags.filter((t) => t.label.toLowerCase().includes(filter.toLowerCase()))
    : tags;

  const grouped = TAG_CATEGORY_ORDER.map((cat) => ({
    cat,
    tags: filtered.filter((t) => t.category_id === cat),
  })).filter((g) => g.tags.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[80vh] flex flex-col rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Tags</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] text-sm"
          >
            ✕
          </button>
        </div>
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Tag suchen…"
          className="w-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded px-3 py-2 text-sm mb-3"
        />
        <div className="flex-1 overflow-y-auto space-y-3">
          {grouped.map(({ cat, tags: catTags }) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1.5 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: TAG_CATEGORY_COLOR[cat] }}
                />
                {TAG_CATEGORY_LABEL[cat]}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {catTags.map((t) => {
                  const active = activeSet.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => (active ? onRemove(t.id) : onAdd(t.id))}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors"
                      style={{
                        background: active ? `${TAG_CATEGORY_COLOR[cat]}33` : `${TAG_CATEGORY_COLOR[cat]}12`,
                        borderColor: active ? TAG_CATEGORY_COLOR[cat] : `${TAG_CATEGORY_COLOR[cat]}44`,
                        color: TAG_CATEGORY_COLOR[cat],
                      }}
                      title={t.description ?? undefined}
                    >
                      {active && <span>✓</span>}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <p className="text-sm text-[color:var(--color-muted)] text-center py-4">
              Keine Tags gefunden.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function activityDot(iso: string | undefined): string {
  if (!iso) return "bg-[color:var(--color-muted)]/40";
  const ageH = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (ageH < 24) return "bg-[color:var(--color-green)]";
  if (ageH < 72) return "bg-[color:var(--color-amber)]";
  return "bg-[color:var(--color-red)]";
}

function LostReasonModal({
  leadId,
  toStage,
  onConfirm,
  onCancel,
}: {
  leadId: string;
  toStage: Stage;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold mb-1">{STAGE_LABEL[toStage]} — Grund?</h2>
        <p className="text-sm text-[color:var(--color-muted)] mb-3">
          Pflichtfeld. Z.B. <code>no_show</code>, <code>kein_budget</code>, <code>falscher_zeitpunkt</code>, <code>unqualified</code>.
        </p>
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && reason.trim()) onConfirm(reason.trim());
            if (e.key === "Escape") onCancel();
          }}
          className="w-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded px-3 py-2 text-sm mb-4"
          placeholder="kein_budget"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
          >
            Abbrechen
          </button>
          <button
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="text-sm bg-[color:var(--color-red)] text-white font-medium rounded px-3 py-1.5 disabled:opacity-50"
          >
            Auf {STAGE_LABEL[toStage]} setzen
          </button>
        </div>
      </div>
    </div>
  );
}

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}
