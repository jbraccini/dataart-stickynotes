"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TrashZoneProps {
  active: boolean;
}

/** Drop target for deleting notes. The board hit-tests against its rect. */
export const TrashZone = forwardRef<HTMLDivElement, TrashZoneProps>(
  ({ active }, ref) => (
    <motion.div
      ref={ref}
      aria-label="Trash zone"
      animate={{ scale: active ? 1.08 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "pointer-events-none absolute bottom-6 left-1/2 z-[9999] flex h-20 w-52 -translate-x-1/2 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-sm font-medium transition-colors",
        active
          ? "border-red-500 bg-red-500/15 text-red-600"
          : "border-border bg-card/60 text-muted-foreground",
      )}
    >
      <span aria-hidden className="text-xl">
        🗑
      </span>
      <span>{active ? "Release to delete" : "Drag here to delete"}</span>
    </motion.div>
  ),
);
TrashZone.displayName = "TrashZone";
