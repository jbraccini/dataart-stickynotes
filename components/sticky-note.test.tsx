import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StickyNote } from "@/components/sticky-note";
import type { Note } from "@/lib/types";

const baseNote: Note = {
  id: "note-1",
  x: 40,
  y: 60,
  width: 180,
  height: 180,
  z: 1,
  color: "blue",
  text: "Buy milk",
};

function renderNote(overrides: Partial<Note> = {}, handlers = {}) {
  const props = {
    note: { ...baseNote, ...overrides },
    getTrashRect: () => null,
    onCommit: vi.fn(),
    onDelete: vi.fn(),
    onRaise: vi.fn(),
    ...handlers,
  };
  render(<StickyNote {...props} />);
  return props;
}

describe("StickyNote", () => {
  it("renders the note text and positions it from geometry", () => {
    renderNote();
    expect(screen.getByDisplayValue("Buy milk")).toBeInTheDocument();

    const note = screen.getByTestId("sticky-note");
    expect(note).toHaveStyle({ left: "40px", top: "60px", width: "180px", height: "180px" });
  });

  it("applies the surface color class for the note", () => {
    renderNote({ color: "pink" });
    expect(screen.getByTestId("sticky-note").className).toContain("bg-pink-200");
  });

  it("commits edited text on blur", () => {
    const onCommit = vi.fn();
    renderNote({}, { onCommit });

    const textarea = screen.getByDisplayValue("Buy milk");
    fireEvent.doubleClick(textarea);
    fireEvent.change(textarea, { target: { value: "Buy oat milk" } });
    fireEvent.blur(textarea);

    expect(onCommit).toHaveBeenCalledWith({ text: "Buy oat milk" });
  });

  it("deletes when the delete button is clicked", () => {
    const onDelete = vi.fn();
    renderNote({}, { onDelete });

    fireEvent.click(screen.getByLabelText("Delete note"));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("raises the note to the front when grabbed", () => {
    const onRaise = vi.fn();
    renderNote({}, { onRaise });

    fireEvent.pointerDown(screen.getByTestId("sticky-note"));
    expect(onRaise).toHaveBeenCalledOnce();
  });
});
