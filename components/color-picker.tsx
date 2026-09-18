"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NOTE_COLORS, type ColorChoice } from "@/lib/types";
import { NOTE_SWATCH } from "@/lib/note-colors";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: ColorChoice;
  onSelect: (color: ColorChoice) => void;
  /** Offer a "random" option (used for the new-note default). */
  allowRandom?: boolean;
}

const swatchBase =
  "flex h-5 w-5 items-center justify-center rounded-full border border-black/20 text-[11px] shadow-sm transition-transform hover:scale-110";

/** Small custom popover for picking a note color. */
export function ColorPicker({ value, onSelect, allowRandom = false }: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  const choose = (color: ColorChoice) => {
    onSelect(color);
    setOpen(false);
  };

  return (
    <div className="relative" data-no-drag>
      <button
        type="button"
        aria-label={value === "random" ? "Random color" : "Change color"}
        onClick={() => setOpen((v) => !v)}
        className={cn(swatchBase, value === "random" ? "bg-card" : NOTE_SWATCH[value])}
      >
        {value === "random" ? "🎲" : null}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-50 mt-1 flex gap-1 rounded-md border border-border bg-card p-1 shadow-md"
          >
            {allowRandom && (
              <button
                type="button"
                aria-label="Random color"
                onClick={() => choose("random")}
                className={cn(
                  swatchBase,
                  "bg-card",
                  value === "random" && "ring-2 ring-ring ring-offset-1",
                )}
              >
                🎲
              </button>
            )}
            {NOTE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => choose(color)}
                className={cn(
                  swatchBase,
                  NOTE_SWATCH[color],
                  color === value && "ring-2 ring-ring ring-offset-1",
                )}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
