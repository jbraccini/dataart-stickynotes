import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type { NoteColor } from "@/lib/types";

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  width: real("width").notNull(),
  height: real("height").notNull(),
  z: integer("z").notNull(),
  // Stored as text; the column is typed as NoteColor at the app boundary.
  color: text("color").$type<NoteColor>().notNull(),
  text: text("text").notNull().default(""),
});

export type NoteRow = typeof notes.$inferSelect;
export type NewNoteRow = typeof notes.$inferInsert;
