import { STAGE_BADGE, STAGE_LABEL, type Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STAGE_BADGE[stage],
        className,
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}
