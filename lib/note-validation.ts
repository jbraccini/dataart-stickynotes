import { NOTE_COLORS, type NoteColor, type NoteInput, type NoteUpdate } from "@/lib/types";

function isColor(value: unknown): value is NoteColor {
  return typeof value === "string" && (NOTE_COLORS as readonly string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validate a create payload. Returns the parsed input or null when invalid. */
export function parseNoteInput(body: unknown): NoteInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (
    typeof b.id !== "string" ||
    b.id.length === 0 ||
    !isFiniteNumber(b.x) ||
    !isFiniteNumber(b.y) ||
    !isFiniteNumber(b.width) ||
    !isFiniteNumber(b.height) ||
    !isColor(b.color)
  ) {
    return null;
  }

  return {
    id: b.id,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    color: b.color,
    text: typeof b.text === "string" ? b.text : "",
  };
}

/** Validate a partial update. Returns the parsed subset, or null when a present field is malformed. */
export function parseNoteUpdate(body: unknown): NoteUpdate | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const update: NoteUpdate = {};

  for (const key of ["x", "y", "width", "height", "z"] as const) {
    if (key in b) {
      if (!isFiniteNumber(b[key])) return null;
      update[key] = b[key];
    }
  }
  if ("color" in b) {
    if (!isColor(b.color)) return null;
    update.color = b.color;
  }
  if ("text" in b) {
    if (typeof b.text !== "string") return null;
    update.text = b.text;
  }

  return update;
}
