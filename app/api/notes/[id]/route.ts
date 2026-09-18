import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { parseNoteUpdate } from "@/lib/note-validation";
import type { Note } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/notes/:id — apply a partial update to one note.
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const update = parseNoteUpdate(body);
  if (!update) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  if (Object.keys(update).length > 0) {
    db.update(notes).set(update).where(eq(notes.id, id)).run();
  }

  const row = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!row) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json<Note>(row);
}

// DELETE /api/notes/:id — remove one note.
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const result = db.delete(notes).where(eq(notes.id, id)).run();
  if (result.changes === 0) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
