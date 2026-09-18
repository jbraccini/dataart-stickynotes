import { pgTable, text, integer, doublePrecision } from "drizzle-orm/pg-core";
import type { NoteColor } from "@/lib/types";

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  width: doublePrecision("width").notNull(),
  height: doublePrecision("height").notNull(),
  z: integer("z").notNull(),
  // Stored as text; the column is typed as NoteColor at the app boundary.
  color: text("color").$type<NoteColor>().notNull(),
  text: text("text").notNull().default(""),
});

export type NoteRow = typeof notes.$inferSelect;
export type NewNoteRow = typeof notes.$inferInsert;
