export type CallOutcome =
  | "reached"
  | "voicemail_left"
  | "voicemail_no_message"
  | "no_answer"
  | "wrong_number"
  | "appointment_scheduled"
  | "not_interested";

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  reached: "Erreicht",
  voicemail_left: "Mailbox hinterlassen",
  voicemail_no_message: "Mailbox keine Nachricht",
  no_answer: "Nicht erreicht",
  wrong_number: "Falsche Nummer",
  appointment_scheduled: "Termin vereinbart",
  not_interested: "Kein Interesse",
};

export const CALL_OUTCOMES: CallOutcome[] = [
  "reached",
  "voicemail_left",
  "voicemail_no_message",
  "no_answer",
  "wrong_number",
  "appointment_scheduled",
  "not_interested",
];

export type LossReason =
  | "kein_budget"
  | "kein_bedarf"
  | "no_show"
  | "falsche_zielgruppe"
  | "konkurrent"
  | "sonstiges";

export const LOSS_REASON_LABEL: Record<LossReason, string> = {
  kein_budget: "Kein Budget",
  kein_bedarf: "Kein Bedarf",
  no_show: "No-Show",
  falsche_zielgruppe: "Falsche Zielgruppe",
  konkurrent: "Konkurrent gewählt",
  sonstiges: "Sonstiges",
};

export const LOSS_REASONS: LossReason[] = [
  "kein_budget",
  "kein_bedarf",
  "no_show",
  "falsche_zielgruppe",
  "konkurrent",
  "sonstiges",
];

export type Note = {
  id: string;
  org_id: string;
  lead_id: string;
  content: string;
  created_at: string;
  created_by: string | null;
};

export type Task = {
  id: string;
  org_id: string;
  lead_id: string;
  title: string;
  due_date: string | null;
  assignee_id: string | null;
  status: "open" | "done" | "canceled";
  created_at: string;
  created_by: string | null;
};

export type CallLog = {
  id: string;
  org_id: string;
  lead_id: string;
  outcome: CallOutcome;
  duration_minutes: number | null;
  note: string | null;
  called_at: string;
  created_by: string | null;
};
