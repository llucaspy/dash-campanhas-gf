"use client";

import { Lock } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface AdminLockProps {
  children: ReactNode;
  locked: boolean;
  className?: string;
}

export function AdminLock({ children, locked, className }: AdminLockProps) {
  if (!locked) return <>{children}</>;

  return (
    <div className={cn("group/admin-lock relative inline-flex", className)}>
      <div className="pointer-events-none inline-flex opacity-55 grayscale-[0.15]">{children}</div>
      <div className="pointer-events-none absolute -top-2 left-1/2 z-50 w-max max-w-[230px] -translate-x-1/2 -translate-y-full rounded-xl border border-[#E9EDF5] bg-white px-3 py-2 text-[11px] font-semibold text-[#525866] opacity-0 shadow-[0_12px_34px_rgba(15,23,42,0.12)] transition-all duration-200 group-hover/admin-lock:opacity-100">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-[#355CFF]" />
          Acesso reservado ao Lucas.
        </div>
      </div>
    </div>
  );
}

export function lockedButtonClass(isLocked: boolean) {
  return isLocked ? "cursor-not-allowed opacity-60 hover:bg-inherit hover:text-inherit" : "";
}
