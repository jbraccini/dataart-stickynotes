import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { parseNoteInput, parseNoteUpdate } from "@/lib/note-validation";
import type { Note } from "@/lib/types";

// GET /api/notes — list every note, bottom of the stack first.
export async function GET() {
  const rows = await db.select().from(notes).orderBy(notes.z);
  return NextResponse.json<Note[]>(rows);
}

// POST /api/notes — create a note; the client supplies the id, the server
// assigns the next z-index.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = parseNoteInput(body);
  if (!input) {
    return NextResponse.json({ error: "Invalid note payload" }, { status: 400 });
  }

  const rows = await db
    .select({ max: sql<number | null>`max(${notes.z})` })
    .from(notes);
  const maxZ = rows[0]?.max ?? 0;

  const note: Note = {
    id: input.id,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    z: maxZ + 1,
    color: input.color,
    text: input.text ?? "",
  };

  await db.insert(notes).values(note);
  return NextResponse.json<Note>(note, { status: 201 });
}

// PATCH /api/notes — apply many partial updates in one transaction (used by Sort).
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: "Invalid updates payload" }, { status: 400 });
  }

  const parsed: { id: string; update: NonNullable<ReturnType<typeof parseNoteUpdate>> }[] = [];
  for (const item of body.updates) {
    if (typeof item !== "object" || item === null) {
      return NextResponse.json({ error: "Invalid updates payload" }, { status: 400 });
    }
    const { id, ...rest } = item as { id?: unknown };
    const update = parseNoteUpdate(rest);
    if (typeof id !== "string" || id.length === 0 || !update) {
      return NextResponse.json({ error: "Invalid updates payload" }, { status: 400 });
    }
    parsed.push({ id, update });
  }

  const updated = await db.transaction(async (tx) => {
    const rows: Note[] = [];
    for (const { id, update } of parsed) {
      if (Object.keys(update).length === 0) continue;
      const [row] = await tx.update(notes).set(update).where(eq(notes.id, id)).returning();
      if (row) rows.push(row);
    }
    return rows;
  });

  return NextResponse.json<Note[]>(updated);
}
