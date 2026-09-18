# Sticky Notes

A single-page sticky-notes board for desktop. Create notes by dragging out a
rectangle on an empty area, move and resize them by dragging, edit their text,
change their color, and delete them by dragging onto the trash zone. Notes are
persisted to a Supabase Postgres database through a small Nextjs REST API and restored
on reload.

https://dataart-stickynotes.vercel.app/

## Requirements

- Node.js 20+ (developed on Node 24)
- A Supabase Postgres database

## Getting started

Set `DATABASE_URL` to the Supabase **transaction pooler** connection string
(Project → Database → Connection string → Transaction pooler). A
working value is provided in `.env`; see `.env.example` for the shape.

I just put a test Supabase for you guys if you want to try it on local.

```bash
npm install       # install dependencies
npm run db:push   # optionally create the notes table/schema in the Supabase database 
npm run dev       # start the dev server at http://localhost:3000
```

Then open http://localhost:3000.

To run a production build:

```bash
npm run build
npm run start
```

Test url: https://dataart-stickynotes.vercel.app/

## Testing

```bash
npm test
```

A small unit-test suite covers the `StickyNote` component (rendering, text
editing, delete, and bring-to-front), the pure drag/resize/hit-test geometry
that powers the interactions, and the note-input validation.

## Usage

- **Create** — drag on empty board space to draw a note at a position and size,
  or double-click empty space to drop a default-sized note. The top-right
  **＋ New note** button adds one next to the last created note.
- **Move** — drag a note by its body.
- **Resize** — drag the handle in the bottom-right corner (clamped to a minimum size).
- **Delete** — drag a note onto the trash zone, or use the × button.
- **Edit** — double-click a note to edit its text; it saves when you click away.
- **Color** — new notes are a random color by default (🎲 in the toolbar);
  pick a specific color there to pin it, or change any note's color from the
  swatch in its header.
- **Pan** — hold **Space** and drag to pan the board (like a design tool).
- **Sort** — the top-right **Sort** button resets the pan and arranges notes into a
  grid centered on screen, animating each into place. Notes can still be dragged
  out afterward.
- **Stacking** — grabbing a note brings it above any overlapping notes.

## Architecture

The app is built with Next.js (App Router) and TypeScript in strict mode. The
UI is a single client page: a `Board` renders the note surface, the create
gesture, and the trash zone, and delegates each note to a `StickyNote`
component. Server state lives in TanStack Query: the `useNotes` hook is a thin
facade over a `["notes"]` query plus create/update/delete mutations, so the
query cache — not a hand-written reducer — owns the note list. All persistence
goes through `/api/notes` route handlers backed by Supabase Postgres via Drizzle
ORM (`postgres-js` on the transaction pooler). The API is the single source of
truth, and the board restores its state from it on load.

The core requirement — implementing drag interactions without a
drag-and-drop library — is handled by a hand-rolled `useDragInteraction` hook.
It attaches pointer-event listeners on `pointerdown`, tracks the gesture on the
window until release, and reports live and final geometry through callbacks. The
actual geometry (translate for move, corner-anchored grow/shrink with a minimum
clamp for resize, and point-in-rectangle testing for the trash zone) lives in
small pure functions that are unit-tested in isolation. Framer Motion is used
only for presentation polish (enter/exit transitions, the settle spring, and
trash-zone feedback), and shadcn/Tailwind conventions are used only for chrome
(theme tokens, the button primitive) — never for the notes or their interactions.

Interactions are optimistic via TanStack Query mutations: each mutation cancels
in-flight queries, snapshots the cache, applies the change locally, rolls back on
error, and invalidates on settle so the server stays authoritative. While
dragging or resizing, a note renders from a transient local "draft" geometry so
only the active note re-renders, and the geometry is committed once on pointer
release rather than on every move. New notes carry a client-generated UUID that
is used as the real primary key, so an optimistic create never needs a temporary
id swapped out on reconciliation. The initial load shows a lightweight skeleton
while the notes query is pending.
