"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { notesApi } from "@/lib/notes-api";
import type { Note, NoteInput, NoteUpdate } from "@/lib/types";

interface State {
  notes: Note[];
  error: string | null;
}

type Action =
  | { type: "load"; notes: Note[] }
  | { type: "add"; note: Note }
  | { type: "replace"; id: string; note: Note }
  | { type: "patch"; id: string; update: NoteUpdate }
  | { type: "remove"; id: string }
  | { type: "error"; message: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return { ...state, notes: action.notes };
    case "add":
      return { ...state, notes: [...state.notes, action.note] };
    case "replace":
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? action.note : n)),
      };
    case "patch":
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, ...action.update } : n,
        ),
      };
    case "remove":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case "error":
      return { ...state, error: action.message };
  }
}

export function useNotes() {
  const [state, dispatch] = useReducer(reducer, { notes: [], error: null });

  // Mirror of the latest notes so async handlers can read pre-mutation values
  // for rollback without re-subscribing on every change.
  const notesRef = useRef(state.notes);
  notesRef.current = state.notes;

  useEffect(() => {
    let active = true;
    notesApi
      .list()
      .then((notes) => {
        if (active) dispatch({ type: "load", notes });
      })
      .catch(() => {
        if (active) dispatch({ type: "error", message: "Failed to load notes." });
      });
    return () => {
      active = false;
    };
  }, []);

  const createNote = useCallback(async (input: NoteInput) => {
    // Optimistic insert with a temporary id and a top-of-stack z.
    const tempId = `temp-${crypto.randomUUID()}`;
    const topZ = notesRef.current.reduce((max, n) => Math.max(max, n.z), 0);
    const optimistic: Note = {
      id: tempId,
      z: topZ + 1,
      text: "",
      ...input,
    };
    dispatch({ type: "add", note: optimistic });

    try {
      const saved = await notesApi.create(input);
      dispatch({ type: "replace", id: tempId, note: saved });
    } catch {
      dispatch({ type: "remove", id: tempId });
      dispatch({ type: "error", message: "Failed to create note." });
    }
  }, []);

  const patchNote = useCallback(async (id: string, update: NoteUpdate) => {
    const previous = notesRef.current.find((n) => n.id === id);
    if (!previous) return;

    dispatch({ type: "patch", id, update });
    try {
      await notesApi.update(id, update);
    } catch {
      dispatch({ type: "replace", id, note: previous });
      dispatch({ type: "error", message: "Failed to save note." });
    }
  }, []);

  const removeNote = useCallback(async (id: string) => {
    const previous = notesRef.current.find((n) => n.id === id);
    if (!previous) return;

    dispatch({ type: "remove", id });
    try {
      await notesApi.remove(id);
    } catch {
      dispatch({ type: "add", note: previous });
      dispatch({ type: "error", message: "Failed to delete note." });
    }
  }, []);

  const bringToFront = useCallback((id: string) => {
    const note = notesRef.current.find((n) => n.id === id);
    if (!note) return;
    const topZ = notesRef.current.reduce((max, n) => Math.max(max, n.z), 0);
    if (note.z === topZ) return; // already on top
    void patchNote(id, { z: topZ + 1 });
  }, [patchNote]);

  return {
    notes: state.notes,
    error: state.error,
    createNote,
    patchNote,
    removeNote,
    bringToFront,
  };
}
