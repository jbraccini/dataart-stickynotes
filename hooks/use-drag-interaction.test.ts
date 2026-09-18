import { describe, it, expect } from "vitest";
import { applyMove, applyResize, isPointOverRect } from "@/hooks/use-drag-interaction";
import { MIN_NOTE_SIZE, type Rect } from "@/lib/types";

const start: Rect = { x: 100, y: 100, width: 180, height: 180 };

describe("drag geometry", () => {
  it("translates a note by the pointer delta", () => {
    expect(applyMove(start, 25, -10)).toEqual({ x: 125, y: 90, width: 180, height: 180 });
  });

  it("resizes from the corner and clamps to the minimum size", () => {
    expect(applyResize(start, 40, 20)).toMatchObject({ width: 220, height: 200 });

    const shrunk = applyResize(start, -1000, -1000);
    expect(shrunk.width).toBe(MIN_NOTE_SIZE);
    expect(shrunk.height).toBe(MIN_NOTE_SIZE);
  });

  it("detects when the pointer is over the trash rectangle", () => {
    const trash = { left: 0, top: 0, right: 100, bottom: 100 } as DOMRect;
    expect(isPointOverRect(50, 50, trash)).toBe(true);
    expect(isPointOverRect(150, 50, trash)).toBe(false);
    expect(isPointOverRect(50, 50, null)).toBe(false);
  });
});
