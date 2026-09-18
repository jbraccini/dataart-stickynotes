import { describe, it, expect } from "vitest";
import { parseNoteInput } from "@/lib/note-validation";

const validBody = {
  id: "note-1",
  x: 10,
  y: 20,
  width: 180,
  height: 180,
  color: "blue",
  text: "hi",
};

describe("parseNoteInput", () => {
  it("parses a valid payload including the client-supplied id", () => {
    expect(parseNoteInput(validBody)).toEqual(validBody);
  });

  it("rejects a payload missing the id", () => {
    const { id: _id, ...withoutId } = validBody;
    expect(parseNoteInput(withoutId)).toBeNull();
  });

  it("rejects a payload whose id is not a non-empty string", () => {
    expect(parseNoteInput({ ...validBody, id: "" })).toBeNull();
    expect(parseNoteInput({ ...validBody, id: 42 })).toBeNull();
  });
});
