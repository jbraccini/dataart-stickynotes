"use client";

import { useCallback, useEffect, useRef } from "react";
import { MIN_NOTE_SIZE, type Rect } from "@/lib/types";

export type InteractionMode = "move" | "resize";

// --- Pure geometry helpers (unit-tested directly) ---

/** Translate a rectangle by a pointer delta. */
export function applyMove(start: Rect, dx: number, dy: number): Rect {
  return { ...start, x: start.x + dx, y: start.y + dy };
}

/** Grow/shrink from the bottom-right corner, never below `min`. */
export function applyResize(start: Rect, dx: number, dy: number, min = MIN_NOTE_SIZE): Rect {
  return {
    x: start.x,
    y: start.y,
    width: Math.max(min, start.width + dx),
    height: Math.max(min, start.height + dy),
  };
}

/** Point-in-rectangle test in viewport coordinates. */
export function isPointOverRect(x: number, y: number, rect: DOMRect | null): boolean {
  if (!rect) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

interface StartOptions {
  mode: InteractionMode;
  /** The note's geometry at the moment the drag begins. */
  rect: Rect;
  /** Live geometry during the drag (called on every pointer move). */
  onPreview: (rect: Rect, overTrash: boolean) => void;
  /** Final geometry when the pointer is released. */
  onCommit: (rect: Rect, overTrash: boolean) => void;
  /** Trash zone rectangle, resolved lazily so it reflects the current layout. */
  getTrashRect?: () => DOMRect | null;
}

/**
 * Hand-rolled drag/resize engine built on pointer events — no drag library.
 * The consumer calls `start` from an `onPointerDown` handler; the hook then
 * tracks the gesture on the window until release.
 */
export function useDragInteraction() {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const start = useCallback((event: React.PointerEvent, options: StartOptions) => {
    const origin = { x: event.clientX, y: event.clientY };

    // Keep receiving events even if the pointer leaves the element. jsdom does
    // not implement this, so failures are non-fatal.
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore — capture is a progressive enhancement
    }

    const resolve = (clientX: number, clientY: number) => {
      const dx = clientX - origin.x;
      const dy = clientY - origin.y;
      const rect =
        options.mode === "move"
          ? applyMove(options.rect, dx, dy)
          : applyResize(options.rect, dx, dy);
      const overTrash =
        options.mode === "move" &&
        isPointOverRect(clientX, clientY, options.getTrashRect?.() ?? null);
      return { rect, overTrash };
    };

    const handleMove = (e: PointerEvent) => {
      const { rect, overTrash } = resolve(e.clientX, e.clientY);
      options.onPreview(rect, overTrash);
    };

    const handleUp = (e: PointerEvent) => {
      const { rect, overTrash } = resolve(e.clientX, e.clientY);
      cleanup();
      options.onCommit(rect, overTrash);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      cleanupRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    cleanupRef.current = cleanup;
  }, []);

  return { start };
}
