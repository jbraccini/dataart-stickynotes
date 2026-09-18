"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ColorPicker } from "@/components/color-picker";
import { useDragInteraction } from "@/hooks/use-drag-interaction";
import { NOTE_SURFACE } from "@/lib/note-colors";
import { cn } from "@/lib/utils";
import type { ColorChoice, Note, NoteUpdate, Rect } from "@/lib/types";

// Spring used when a note moves on its own (e.g. sorting into a grid).
const POSITION_SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;

interface StickyNoteProps {
  note: Note;
  getTrashRect: () => DOMRect | null;
  onCommit: (update: NoteUpdate) => void;
  onDelete: () => void;
  onRaise: () => void;
  onOverTrashChange?: (over: boolean) => void;
}

export function StickyNote({
  note,
  getTrashRect,
  onCommit,
  onDelete,
  onRaise,
  onOverTrashChange,
}: StickyNoteProps) {
  const { start } = useDragInteraction();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Transient geometry while a drag/resize is in flight; null when idle.
  const [draft, setDraft] = useState<Rect | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);

  // Keep local text in sync when the note changes and we are not editing.
  useEffect(() => {
    if (!editing) setText(note.text);
  }, [note.text, editing]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const geometry: Rect = draft ?? {
    x: note.x,
    y: note.y,
    width: note.width,
    height: note.height,
  };

  const beginMove = (event: React.PointerEvent) => {
    onRaise();
    const target = event.target as HTMLElement;
    if (editing || target.closest("[data-no-drag]")) return;
    setDragging(true);
    start(event, {
      mode: "move",
      rect: geometry,
      getTrashRect,
      onPreview: (rect, over) => {
        setDraft(rect);
        setOverTrash(over);
        onOverTrashChange?.(over);
      },
      onCommit: (rect, over) => {
        setDraft(null);
        setDragging(false);
        setOverTrash(false);
        onOverTrashChange?.(false);
        if (over) {
          onDelete();
        } else {
          onCommit({ x: rect.x, y: rect.y });
        }
      },
    });
  };

  const beginResize = (event: React.PointerEvent) => {
    event.stopPropagation();
    onRaise();
    setDragging(true);
    start(event, {
      mode: "resize",
      rect: geometry,
      onPreview: (rect) => setDraft(rect),
      onCommit: (rect) => {
        setDraft(null);
        setDragging(false);
        onCommit({ width: rect.width, height: rect.height });
      },
    });
  };

  const commitText = () => {
    setEditing(false);
    if (text !== note.text) onCommit({ text });
  };

  const changeColor = (color: ColorChoice) => {
    if (color === "random") return; // per-note picker never offers random
    if (color !== note.color) onCommit({ color });
  };

  return (
    <motion.div
      role="group"
      aria-label="Sticky note"
      data-testid="sticky-note"
      onPointerDown={beginMove}
      initial={{
        opacity: 0,
        scale: 0.85,
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
      }}
      animate={{
        opacity: overTrash ? 0.6 : 1,
        scale: overTrash ? 0.9 : dragging ? 1.03 : 1,
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        opacity: { duration: 0.15 },
        scale: { type: "spring", stiffness: 500, damping: 32 },
        // Follow the pointer instantly during a drag; spring into place otherwise.
        left: dragging ? { duration: 0 } : POSITION_SPRING,
        top: dragging ? { duration: 0 } : POSITION_SPRING,
        width: dragging ? { duration: 0 } : POSITION_SPRING,
        height: dragging ? { duration: 0 } : POSITION_SPRING,
      }}
      style={{ position: "absolute", zIndex: note.z }}
      className={cn(
        "flex touch-none select-none flex-col rounded-md border shadow-md",
        NOTE_SURFACE[note.color],
        dragging ? "cursor-grabbing shadow-xl" : "cursor-grab",
      )}
    >
      <div className="flex items-center justify-end gap-2 px-2 pt-2">
        <ColorPicker value={note.color} onSelect={changeColor} />
        <button
          type="button"
          data-no-drag
          aria-label="Delete note"
          onClick={onDelete}
          className="text-black/40 transition-colors hover:text-black/80"
        >
          ×
        </button>
      </div>

      <textarea
        ref={textareaRef}
        data-no-drag
        value={text}
        readOnly={!editing}
        placeholder="Double-click to edit…"
        onDoubleClick={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        className={cn(
          "flex-1 resize-none bg-transparent px-3 pb-3 pt-1 text-sm text-black/80 outline-none placeholder:text-black/30",
          editing ? "cursor-text" : "cursor-inherit",
        )}
      />

      <div
        data-no-drag
        onPointerDown={beginResize}
        aria-label="Resize note"
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize touch-none"
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.25) 50%)",
        }}
      />
    </motion.div>
  );
}
