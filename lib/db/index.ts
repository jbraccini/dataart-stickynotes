import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_FILE = process.env.SQLITE_PATH ?? "sqlite.db";

// better-sqlite3 is synchronous. A single shared connection is reused across
// requests in the Node server; the route handlers wrap access in async handlers.
const sqlite = new Database(DB_FILE);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
