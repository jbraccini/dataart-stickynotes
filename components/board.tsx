"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { StickyNote } from "@/components/sticky-note";
import { TrashZone } from "@/components/trash-zone";
import { ColorPicker } from "@/components/color-picker";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/hooks/use-notes";
import { cn } from "@/lib/utils";
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
  const { notes, error, isLoading, createNote, patchNote, patchNotes, removeNote, bringToFront } =
    useNotes();

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

  // Board pan offset (canvas → screen). Notes live in canvas coordinates; the
  // canvas layer is translated by this. `spaceHeld` arms pan mode; `panning`
  // disables the pan transition so it tracks the pointer 1:1.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);

  // Position of the most recently created note, used to place the next one.
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const create = useCallback(
    (input: Omit<NoteInput, "id">) => {
      lastPosRef.current = { x: input.x, y: input.y };
      createNote(input);
    },
    [createNote],
  );

  // Hold Space to pan (ignored while typing in a note).
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLElement &&
        (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable)
      );
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping()) {
        e.preventDefault(); // stop the page from scrolling
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Client point → canvas point (undo the board offset and the current pan).
  const canvasPoint = (clientX: number, clientY: number) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    return {
      x: clientX - (bounds?.left ?? 0) - pan.x,
      y: clientY - (bounds?.top ?? 0) - pan.y,
    };
  };

  const isChrome = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el?.closest('[data-testid="sticky-note"]') || !!el?.closest("[data-no-create]");
  };

  // Pan the board while Space is held (started from the overlay).
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation(); // don't let the board's create handler also fire
    setPanning(true);
    const originClient = { x: event.clientX, y: event.clientY };
    const originPan = pan;

    const handleMove = (e: PointerEvent) => {
      setPan({
        x: originPan.x + (e.clientX - originClient.x),
        y: originPan.y + (e.clientY - originClient.y),
      });
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setPanning(false);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  // Rubber-band create: drag on empty board to set position and size.
  const startCreate = (event: React.PointerEvent<HTMLDivElement>) => {
    if (spaceHeld || isChrome(event.target) || !boardRef.current) return;
    const origin = canvasPoint(event.clientX, event.clientY);

    const handleMove = (e: PointerEvent) => {
      const p = canvasPoint(e.clientX, e.clientY);
      setDraftRect(rectFromPoints(origin.x, origin.y, p.x, p.y));
    };

    const handleUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setDraftRect(null);

      const p = canvasPoint(e.clientX, e.clientY);
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
    if (spaceHeld || isChrome(event.target)) return;
    const p = canvasPoint(event.clientX, event.clientY);
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

  // Reset the pan and arrange notes into a grid centered in the viewport, so the
  // centered layout lines up with what the user sees. Notes remain draggable.
  const sortIntoGrid = () => {
    if (notes.length === 0) return;
    setPan({ x: 0, y: 0 });

    const cols = Math.ceil(Math.sqrt(notes.length));
    const rows = Math.ceil(notes.length / cols);
    const step = SORT_CELL + SORT_GAP;
    const gridW = cols * SORT_CELL + (cols - 1) * SORT_GAP;
    const gridH = rows * SORT_CELL + (rows - 1) * SORT_GAP;
    const startX = Math.max(20, (window.innerWidth - gridW) / 2);
    const startY = Math.max(96, (window.innerHeight - gridH) / 2);

    const updates = notes.map((note, i) => ({
      id: note.id,
      x: startX + (i % cols) * step,
      y: startY + Math.floor(i / cols) * step,
      width: SORT_CELL,
      height: SORT_CELL,
    }));
    patchNotes(updates);
  };

  return (
    <main
      ref={boardRef}
      onPointerDown={startCreate}
      onDoubleClick={createOnDoubleClick}
      className="board-surface relative h-screen w-screen overflow-hidden"
      style={{
        // Move the dotted grid with the pan so it reads as one continuous board.
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        transition: panning ? "none" : "background-position 300ms ease",
      }}
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
            Drag or double-click to create · hold Space to pan
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

      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-wrap justify-center gap-6 opacity-60">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[180px] w-[180px] animate-pulse rounded-md border border-border bg-muted"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            // Instant while panning; ease when the pan is set programmatically (Sort).
            transition: panning ? "none" : "transform 300ms ease",
          }}
        >
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
        </div>
      )}

      {/* While Space is held, this overlay captures the drag so panning works
          even over notes (and suppresses create). */}
      {spaceHeld && (
        <div
          onPointerDown={startPan}
          className={cn("absolute inset-0 z-[9990]", panning ? "cursor-grabbing" : "cursor-grab")}
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
