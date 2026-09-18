import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { parseNoteInput } from "@/lib/note-validation";
import type { Note } from "@/lib/types";

// GET /api/notes — list every note, bottom of the stack first.
export async function GET() {
  const rows = db.select().from(notes).orderBy(notes.z).all();
  return NextResponse.json<Note[]>(rows);
}

// POST /api/notes — create a note; the server assigns id and the next z-index.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = parseNoteInput(body);
  if (!input) {
    return NextResponse.json({ error: "Invalid note payload" }, { status: 400 });
  }

  const { max } = db
    .select({ max: sql<number | null>`max(${notes.z})` })
    .from(notes)
    .get() ?? { max: null };

  const note: Note = {
    id: crypto.randomUUID(),
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    z: (max ?? 0) + 1,
    color: input.color,
    text: input.text ?? "",
  };

  db.insert(notes).values(note).run();
  return NextResponse.json<Note>(note, { status: 201 });
}
