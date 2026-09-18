// The fixed set of note colors offered in the UI. Kept as a const tuple so the
// NoteColor type and the color picker stay in sync from a single source.
export const NOTE_COLORS = [
  "yellow",
  "green",
  "blue",
  "pink",
  "purple",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

/** A picker selection: a concrete color, or "random" to pick one per note. */
export type ColorChoice = NoteColor | "random";

/** Resolve a picker choice to a concrete color, rolling a random one when asked. */
export function resolveColor(choice: ColorChoice): NoteColor {
  if (choice !== "random") return choice;
  return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]!;
}

export interface Note {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  color: NoteColor;
  text: string;
}

/** Rectangle + color chosen when a note is created. */
export interface NoteInput {
  // Client-generated id, used directly as the primary key so optimistic
  // creates never need a temp-id → server-id reconciliation.
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: NoteColor;
  text?: string;
}

/** Any subset of a note's mutable fields, sent on update. */
export type NoteUpdate = Partial<Omit<Note, "id">>;

/** One entry in a bulk update: the target id plus the fields to change. */
export type NoteBulkUpdate = { id: string } & NoteUpdate;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_NOTE_SIZE = 120;
export const DEFAULT_NOTE_SIZE = 180;
