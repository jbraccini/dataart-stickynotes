import type { Note, NoteBulkUpdate, NoteInput, NoteUpdate } from "@/lib/types";

const BASE = "/api/notes";

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const notesApi = {
  list(): Promise<Note[]> {
    return fetch(BASE).then((r) => json<Note[]>(r));
  },

  create(input: NoteInput): Promise<Note> {
    return fetch(BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<Note>(r));
  },

  update(id: string, update: NoteUpdate): Promise<Note> {
    return fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    }).then((r) => json<Note>(r));
  },

  // Apply many updates in one request (used by Sort); the server runs them in a
  // single transaction.
  updateMany(updates: NoteBulkUpdate[]): Promise<Note[]> {
    return fetch(BASE, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updates }),
    }).then((r) => json<Note[]>(r));
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
  },
};
