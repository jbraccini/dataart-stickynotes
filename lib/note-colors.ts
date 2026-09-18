import type { NoteColor } from "@/lib/types";

/** Tailwind classes for a note surface, keyed by color. */
export const NOTE_SURFACE: Record<NoteColor, string> = {
  yellow: "bg-amber-200 border-amber-300",
  green: "bg-green-200 border-green-300",
  blue: "bg-sky-200 border-sky-300",
  pink: "bg-pink-200 border-pink-300",
  purple: "bg-violet-200 border-violet-300",
};

/** Solid swatch classes for the color picker. */
export const NOTE_SWATCH: Record<NoteColor, string> = {
  yellow: "bg-amber-300",
  green: "bg-green-300",
  blue: "bg-sky-300",
  pink: "bg-pink-300",
  purple: "bg-violet-300",
};
