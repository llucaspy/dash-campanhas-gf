"use client";

import { Cloud } from "lucide-react";

export function AdsnapPromoCard() {
  return (
    <a
      href="https://adsnap-cloud.vercel.app/login"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-[#DDE6F7] bg-white/95 px-3 py-2.5 text-sm font-medium text-[#71717A] shadow-[0_6px_20px_rgba(53,92,255,0.08)] transition-all duration-200 hover:border-[#355CFF]/20 hover:bg-white hover:text-[#1D1E2C]"
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#355CFF]/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="relative flex h-5 w-5 items-center justify-center text-[#71717A] transition-colors group-hover:text-[#355CFF]">
        <Cloud className="h-5 w-5" />
      </span>
      <span className="relative">Adsnap Cloud</span>
    </a>
  );
}
