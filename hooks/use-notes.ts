"use client";

import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notesApi } from "@/lib/notes-api";
import type { Note, NoteBulkUpdate, NoteInput, NoteUpdate } from "@/lib/types";

const NOTES_KEY = ["notes"] as const;

function topZ(notes: Note[]): number {
  return notes.reduce((max, n) => Math.max(max, n.z), 0);
}

// Shallow-equal over a note's mutable fields. Used to tell whether a note has
// been changed by a newer interaction before an older request's error handler
// runs — so a failed write only rolls back if nothing has superseded it.
function sameNote(a: Note, b: Note): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.z === b.z &&
    a.color === b.color &&
    a.text === b.text
  );
}

/**
 * Server state for the notes board, backed by TanStack Query.
 *
 * Once the initial list has loaded, the query cache is the client's source of
 * truth. Writes update the cache optimistically and are fire-and-forget: no
 * refetch runs after a mutation, so a slow or out-of-order server response can
 * never pull a note back to a stale position. The user can move and resize
 * freely without the backend showing through. Only a failed write rolls its
 * single affected note back, and only when a newer interaction hasn't already
 * changed it. New notes carry a client-generated id used as the real primary
 * key, so optimistic creates need no temp-id reconciliation.
 */
export function useNotes() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: NOTES_KEY, queryFn: notesApi.list });

  const setNotes = useCallback(
    (updater: (prev: Note[]) => Note[]) => {
      queryClient.setQueryData<Note[]>(NOTES_KEY, (prev) => updater(prev ?? []));
    },
    [queryClient],
  );

  const currentNotes = useCallback(
    () => queryClient.getQueryData<Note[]>(NOTES_KEY) ?? [],
    [queryClient],
  );

  // Each onMutate fires cancelQueries without awaiting it, so the optimistic
  // setQueryData runs synchronously — the note prop updates in the same tick as
  // a drag release, leaving no frame for a stale value to spring across.
  const createMutation = useMutation({
    mutationFn: (note: NoteInput) => notesApi.create(note),
    onMutate: async (note) => {
      // Cancel any in-flight initial load so it can't clobber the optimistic add.
      void queryClient.cancelQueries({ queryKey: NOTES_KEY });
      const optimisticZ = topZ(currentNotes()) + 1;
      const optimistic: Note = { z: optimisticZ, text: "", ...note };
      setNotes((prev) => [...prev, optimistic]);
      return { optimisticZ };
    },
    onSuccess: (serverNote, _note, context) => {
      // Adopt the server-assigned z, but only if the note hasn't been restacked
      // meanwhile — never touch position/size/text the user may have changed.
      setNotes((prev) =>
        prev.map((n) =>
          n.id === serverNote.id && n.z === context?.optimisticZ
            ? { ...n, z: serverNote.z }
            : n,
        ),
      );
    },
    onError: (_e, note) =>
      setNotes((prev) => prev.filter((n) => n.id !== note.id)),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: NoteUpdate }) =>
      notesApi.update(id, update),
    onMutate: async ({ id, update }) => {
      void queryClient.cancelQueries({ queryKey: NOTES_KEY });
      const prevNote = currentNotes().find((n) => n.id === id);
      const optimistic = prevNote ? { ...prevNote, ...update } : undefined;
      if (optimistic) {
        setNotes((prev) => prev.map((n) => (n.id === id ? optimistic : n)));
      }
      return { prevNote, optimistic };
    },
    onError: (_e, { id }, context) => {
      const prevNote = context?.prevNote;
      const optimistic = context?.optimistic;
      if (!prevNote || !optimistic) return;
      // Roll back only if a newer interaction hasn't already changed this note.
      setNotes((prev) =>
        prev.map((n) => (n.id === id && sameNote(n, optimistic) ? prevNote : n)),
      );
    },
  });

  const patchManyMutation = useMutation({
    mutationFn: (updates: NoteBulkUpdate[]) => notesApi.updateMany(updates),
    onMutate: async (updates) => {
      void queryClient.cancelQueries({ queryKey: NOTES_KEY });
      const previous = currentNotes();
      const byId = new Map(updates.map(({ id, ...rest }) => [id, rest]));
      setNotes((prev) =>
        prev.map((n) => {
          const update = byId.get(n.id);
          return update ? { ...n, ...update } : n;
        }),
      );
      return { previous };
    },
    onError: (_e, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTES_KEY, context.previous);
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onMutate: async (id) => {
      void queryClient.cancelQueries({ queryKey: NOTES_KEY });
      const prevNote = currentNotes().find((n) => n.id === id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      return { prevNote };
    },
    onError: (_e, id, context) => {
      const prevNote = context?.prevNote;
      if (prevNote) {
        setNotes((prev) =>
          prev.some((n) => n.id === id) ? prev : [...prev, prevNote],
        );
      }
    },
  });

  const createNote = useCallback(
    (input: Omit<NoteInput, "id">) =>
      createMutation.mutate({ id: crypto.randomUUID(), ...input }),
    [createMutation],
  );

  const patchNote = useCallback(
    (id: string, update: NoteUpdate) => patchMutation.mutate({ id, update }),
    [patchMutation],
  );

  const patchNotes = useCallback(
    (updates: NoteBulkUpdate[]) => {
      if (updates.length > 0) patchManyMutation.mutate(updates);
    },
    [patchManyMutation],
  );

  const removeNote = useCallback(
    (id: string) => removeMutation.mutate(id),
    [removeMutation],
  );

  const bringToFront = useCallback(
    (id: string) => {
      const notes = currentNotes();
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      const max = topZ(notes);
      if (note.z === max) return; // already on top
      patchMutation.mutate({ id, update: { z: max + 1 } });
    },
    [currentNotes, patchMutation],
  );

  const error = query.error
    ? "Failed to load notes."
    : createMutation.error
      ? "Failed to create note."
      : patchMutation.error || patchManyMutation.error
        ? "Failed to save note."
        : removeMutation.error
          ? "Failed to delete note."
          : null;

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    error,
    createNote,
    patchNote,
    patchNotes,
    removeNote,
    bringToFront,
  };
}
