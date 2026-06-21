"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  MoreVertical,
  Pencil,
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  ArrowRightLeft,
  Flame,
  Trophy,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import {
  STAGES,
  STAGE_LABEL,
  type Stage,
  type Lead,
  type Tag,
} from "@/lib/types";
import { updateLead, addTagToLead, removeTagFromLead } from "@/app/leads/actions";
import { deleteLead } from "@/lib/crm/leadActions";
import { whatsappLink, normalizePhoneToE164 } from "@/lib/crm/phone";

type Props = {
  lead: Lead;
  allTags: Tag[];
  leadTagIds: string[];
  onOpenTagPopup: () => void;
  onMoveStage: (toStage: Stage) => void;
};

const POPUP_WIDTH = 288;
const POPUP_MAX_HEIGHT = 480;
const VIEWPORT_MARGIN = 8;

export function LeadCardActionMenu({
  lead,
  allTags,
  leadTagIds,
  onOpenTagPopup,
  onMoveStage,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setShowStages(false);
    }, 350);
  };

  const close = () => {
    cancelClose();
    setOpen(false);
    setShowStages(false);
  };

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  function recomputePos() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let left = rect.right - POPUP_WIDTH;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    if (left + POPUP_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - POPUP_WIDTH - VIEWPORT_MARGIN;
    }
    let top = rect.bottom + 4;
    if (
      top + POPUP_MAX_HEIGHT > window.innerHeight - VIEWPORT_MARGIN &&
      rect.top - POPUP_MAX_HEIGHT > VIEWPORT_MARGIN
    ) {
      top = rect.top - POPUP_MAX_HEIGHT - 4;
    }
    setPos({ top, left });
  }

  useLayoutEffect(() => {
    if (open) recomputePos();
  }, [open, showStages]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", recomputePos, true);
    window.addEventListener("resize", recomputePos);
    return () => {
      window.removeEventListener("scroll", recomputePos, true);
      window.removeEventListener("resize", recomputePos);
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const stop = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const hotLeadTag = allTags.find((t) => t.label.toLowerCase() === "hot lead");
  const isHot = hotLeadTag ? leadTagIds.includes(hotLeadTag.id) : false;

  function toggleHot() {
    if (!hotLeadTag) {
      setToast("Tag „Hot Lead“ existiert nicht");
      return;
    }
    startTransition(async () => {
      if (isHot) await removeTagFromLead(lead.id, hotLeadTag.id);
      else await addTagToLead(lead.id, hotLeadTag.id);
    });
    close();
  }

  function markWon() {
    startTransition(async () => {
      await updateLead(lead.id, { stage: "won" });
    });
    close();
  }

  function handleDelete() {
    const name = lead.name ?? "diesen Lead";
    if (!window.confirm(`„${name}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteLead(lead.id);
      if (!res.ok) setToast(`Löschen fehlgeschlagen: ${res.error}`);
      else setToast("Lead gelöscht");
    });
    close();
  }

  function copyCalendly() {
    const url = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
    if (!url) {
      setToast("Calendly URL nicht konfiguriert");
      return;
    }
    navigator.clipboard.writeText(url).then(() => setToast("Calendly Link kopiert"));
    close();
  }

  const phoneNorm = lead.phone ? normalizePhoneToE164(lead.phone) : null;
  const whatsapp = lead.phone ? whatsappLink(lead.phone) : null;
  const mailto = lead.email ? `mailto:${lead.email}` : null;

  const popup = open && pos && mounted
    ? createPortal(
        <div
          role="menu"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: POPUP_WIDTH,
            maxHeight: POPUP_MAX_HEIGHT,
          }}
          className="z-[100] overflow-y-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-2xl py-1.5 text-[13px] text-[color:var(--color-text)]"
        >
          <Link
            href={`/leads/${lead.id}`}
            onClick={close}
            className="flex items-center gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)]"
          >
            <Pencil className="w-3.5 h-3.5" /> Lead bearbeiten
          </Link>
          <button
            type="button"
            onClick={() => {
              onOpenTagPopup();
              close();
            }}
            className="w-full text-left flex items-center gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)]"
          >
            <TagIcon className="w-3.5 h-3.5" /> Tags bearbeiten
          </button>

          <Separator />

          {mailto && (
            <a
              href={mailto}
              onClick={close}
              className="flex items-center gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)]"
            >
              <Mail className="w-3.5 h-3.5" /> E-Mail senden
            </a>
          )}
          {phoneNorm && (
            <a
              href={`tel:${phoneNorm}`}
              onClick={close}
              className="flex items-center gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)]"
            >
              <Phone className="w-3.5 h-3.5" /> Anrufen
            </a>
          )}
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="flex items-center gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)]"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp öffnen
            </a>
          )}
          <button
            type="button"
            onClick={copyCalendly}
            className="w-full text-left flex items-center gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)]"
          >
            <Calendar className="w-3.5 h-3.5" /> Calendly Link senden
          </button>

          <Separator />

          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setShowStages((v) => !v);
            }}
            className="w-full text-left flex items-center justify-between gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)]"
          >
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Stage ändern
            </span>
            <span className="text-xs text-[color:var(--color-muted)]">
              {showStages ? "▲" : "▼"}
            </span>
          </button>
          {showStages && (
            <div className="bg-[color:var(--color-surface-2)] border-y border-[color:var(--color-border)]">
              {STAGES.filter((s) => s !== lead.stage).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onMoveStage(s);
                    close();
                  }}
                  className="w-full text-left px-7 py-1.5 text-[12px] hover:bg-[color:var(--color-surface)]"
                >
                  → {STAGE_LABEL[s]}
                </button>
              ))}
            </div>
          )}

          <Separator />

          <button
            type="button"
            onClick={toggleHot}
            className="w-full text-left flex items-center gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)]"
          >
            <Flame className={`w-3.5 h-3.5 ${isHot ? "text-orange-400" : ""}`} />
            {isHot ? "Hot Lead entfernen" : "Als Hot Lead markieren"}
          </button>
          {lead.stage !== "won" && (
            <button
              type="button"
              onClick={markWon}
              className="w-full text-left flex items-center gap-2 px-3.5 py-2 hover:bg-[color:var(--color-surface-2)] text-green-400"
            >
              <Trophy className="w-3.5 h-3.5" /> Als Won markieren
            </button>
          )}

          <Separator />

          <button
            type="button"
            onClick={handleDelete}
            className="w-full text-left flex items-center gap-2 px-3.5 py-2 hover:bg-red-500/10 text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" /> Lead löschen
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Aktionen für Lead ${lead.name ?? "Unbenannt"}`}
        onPointerDown={stop}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        onMouseEnter={cancelClose}
        onMouseLeave={() => open && scheduleClose()}
        className="flex items-center justify-center w-7 h-7 rounded opacity-60 hover:opacity-100 hover:bg-[color:var(--color-border)]/40 transition"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {popup}
      {toast && mounted &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[200] bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded-md px-4 py-2 text-sm shadow-2xl">
            {toast}
          </div>,
          document.body,
        )}
    </>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-[color:var(--color-border)]" />;
}
