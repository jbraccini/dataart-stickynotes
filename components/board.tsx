"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { StickyNote } from "@/components/sticky-note";
import { TrashZone } from "@/components/trash-zone";
import { ColorPicker } from "@/components/color-picker";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/hooks/use-notes";
import {
  DEFAULT_NOTE_SIZE,
  MIN_NOTE_SIZE,
  resolveColor,
  type ColorChoice,
  type NoteInput,
  type Rect,
} from "@/lib/types";

// A pointer movement smaller than this counts as a click, not a create-drag.
const DRAG_THRESHOLD = 12;
// Uniform cell used when sorting notes into a grid.
const SORT_CELL = DEFAULT_NOTE_SIZE;
const SORT_GAP = 24;

/** Build a normalized rectangle from two corner points. */
function rectFromPoints(ax: number, ay: number, bx: number, by: number): Rect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

export function Board() {
  const { notes, error, createNote, patchNote, removeNote, bringToFront } = useNotes();

  const boardRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const getTrashRect = useCallback(
    () => trashRef.current?.getBoundingClientRect() ?? null,
    [],
  );

  const [trashActive, setTrashActive] = useState(false);
  // New notes default to a random color; pick a specific one to pin it.
  const [newColor, setNewColor] = useState<ColorChoice>("random");
  const [draftRect, setDraftRect] = useState<Rect | null>(null);

  // Position of the most recently created note, used to place the next one.
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const create = useCallback(
    (input: NoteInput) => {
      lastPosRef.current = { x: input.x, y: input.y };
      void createNote(input);
    },
    [createNote],
  );

  const boardPoint = (clientX: number, clientY: number) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    return { x: clientX - (bounds?.left ?? 0), y: clientY - (bounds?.top ?? 0) };
  };

  const isChrome = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el?.closest('[data-testid="sticky-note"]') || !!el?.closest("[data-no-create]");
  };

  // Rubber-band create: drag on empty board to set position and size.
  const startCreate = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isChrome(event.target) || !boardRef.current) return;
    const origin = boardPoint(event.clientX, event.clientY);

    const handleMove = (e: PointerEvent) => {
      const p = boardPoint(e.clientX, e.clientY);
      setDraftRect(rectFromPoints(origin.x, origin.y, p.x, p.y));
    };

    const handleUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setDraftRect(null);

      const p = boardPoint(e.clientX, e.clientY);
      const drawn = rectFromPoints(origin.x, origin.y, p.x, p.y);
      // Ignore clicks; only a real drag creates a note (double-click also creates).
      if (drawn.width < DRAG_THRESHOLD && drawn.height < DRAG_THRESHOLD) return;

      create({
        x: drawn.x,
        y: drawn.y,
        width: Math.max(MIN_NOTE_SIZE, drawn.width),
        height: Math.max(MIN_NOTE_SIZE, drawn.height),
        color: resolveColor(newColor),
      });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  // Double-click on empty space drops a default-sized note.
  const createOnDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isChrome(event.target)) return;
    const p = boardPoint(event.clientX, event.clientY);
    create({
      x: p.x,
      y: p.y,
      width: DEFAULT_NOTE_SIZE,
      height: DEFAULT_NOTE_SIZE,
      color: resolveColor(newColor),
    });
  };

  // Place a new note next to the last created one, wrapping at the viewport edge.
  const addNextNote = () => {
    const base = lastPosRef.current ?? { x: 80, y: 96 };
    let x = base.x + DEFAULT_NOTE_SIZE + 20;
    let y = base.y;
    if (x + DEFAULT_NOTE_SIZE > window.innerWidth) {
      x = 80;
      y = base.y + DEFAULT_NOTE_SIZE + 20;
    }
    if (y + DEFAULT_NOTE_SIZE > window.innerHeight) y = 96;

    create({ x, y, width: DEFAULT_NOTE_SIZE, height: DEFAULT_NOTE_SIZE, color: resolveColor(newColor) });
  };

  // Arrange notes into a grid centered in the viewport; they remain draggable.
  const sortIntoGrid = () => {
    if (notes.length === 0) return;
    const cols = Math.ceil(Math.sqrt(notes.length));
    const rows = Math.ceil(notes.length / cols);
    const step = SORT_CELL + SORT_GAP;
    const gridW = cols * SORT_CELL + (cols - 1) * SORT_GAP;
    const gridH = rows * SORT_CELL + (rows - 1) * SORT_GAP;
    const startX = Math.max(20, (window.innerWidth - gridW) / 2);
    const startY = Math.max(96, (window.innerHeight - gridH) / 2);

    notes.forEach((note, i) => {
      const x = startX + (i % cols) * step;
      const y = startY + Math.floor(i / cols) * step;
      void patchNote(note.id, { x, y, width: SORT_CELL, height: SORT_CELL });
    });
  };

  return (
    <main
      ref={boardRef}
      onPointerDown={startCreate}
      onDoubleClick={createOnDoubleClick}
      className="relative h-screen w-screen overflow-hidden"
    >
      <header
        data-no-create
        className="pointer-events-none absolute inset-x-4 top-4 z-[9998] flex items-start justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">Sticky Notes</h1>
          <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <span>New note color</span>
            <ColorPicker value={newColor} onSelect={setNewColor} allowRandom />
          </div>
          <span className="text-xs text-muted-foreground">
            Drag or double-click empty space to create
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <Button size="sm" onClick={addNextNote}>
            + New note
          </Button>
          <Button size="sm" variant="outline" onClick={sortIntoGrid} disabled={notes.length === 0}>
            Sort
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            getTrashRect={getTrashRect}
            onCommit={(update) => void patchNote(note.id, update)}
            onDelete={() => void removeNote(note.id)}
            onRaise={() => bringToFront(note.id)}
            onOverTrashChange={setTrashActive}
          />
        ))}
      </AnimatePresence>

      {draftRect && (
        <div
          className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary/50 bg-primary/5"
          style={{
            left: draftRect.x,
            top: draftRect.y,
            width: draftRect.width,
            height: draftRect.height,
          }}
        />
      )}

      <TrashZone ref={trashRef} active={trashActive} />

      {error && (
        <div className="absolute bottom-6 left-6 z-[9999] rounded-md bg-red-600 px-3 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </main>
  );
}
