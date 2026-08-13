"use client";

import { useState } from "react";
import { Activity, LayoutDashboard, Zap, FileText, History, Settings, Inbox, Menu, X, Github, Linkedin, MessageCircle, Instagram, LogOut, Bot } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { AdsnapPromoCard } from "./AdsnapPromoCard";
import { useAuth } from "../../context/AuthContext";
import { AdminLock } from "../auth/AdminLock";
import { useCampaigns } from "../../context/CampaignContext";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";
import { isLucasAccount } from "../../lib/lucasAccess";

const menuItems = [
  { icon: LayoutDashboard, label: "Analytics", href: "/", adminOnly: false, lucasOnly: false },
  { icon: Activity, label: "Acompanhamento", href: "/acompanhamento", adminOnly: false, lucasOnly: true },
  { icon: Bot, label: "Assistente OPEC", href: "/assistant", adminOnly: true, lucasOnly: false },
  { icon: Zap, label: "Criar Campanha", href: "/campaigns/create", adminOnly: false, lucasOnly: false },
  { icon: FileText, label: "Relatório GAM", href: "/gam", adminOnly: false, lucasOnly: false },
  { icon: History, label: "Historico", href: "/history", adminOnly: false, lucasOnly: false },
];

const bottomItems = [
  { icon: Inbox, label: "Solicitacoes", href: "/requests" },
  { icon: Settings, label: "Configurações", href: "/settings" },
];

function MarfeelMark() {
  return (
    <span className="relative h-5 w-5 shrink-0">
      <span className="absolute left-0 top-1 h-3.5 w-3.5 rounded-[4px] bg-[#F4C430] shadow-sm" />
      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-[4px] bg-[#5B7C2F] shadow-sm" />
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin, user, logout } = useAuth();
  const isLucas = isLucasAccount(user);
  const { campaigns } = useCampaigns();
  const { archivedCampaigns } = splitCampaignsByArchive(campaigns);

  return (
    <>
      {/* Botão hamburger mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-[60] xl:hidden p-2 bg-white rounded-xl shadow-md border border-[#E9EDF5] print:hidden"
      >
        <Menu className="w-5 h-5 text-[#355CFF]" />
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/45 z-[55] xl:hidden backdrop-blur-[2px]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-[100dvh] w-[min(82vw,248px)] xl:w-[232px] 2xl:w-[260px] border-r border-[#DDE6F7] bg-white dark:bg-[#0F1117] flex flex-col p-4 2xl:p-5 z-[70] print:hidden transition-transform duration-300 overflow-y-auto overflow-x-hidden shadow-[18px_0_60px_rgba(15,23,42,0.18)] xl:shadow-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        "xl:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
      )}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(245,248,255,0.98)_42%,rgba(53,92,255,0.34)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,17,23,0.98)_0%,rgba(15,17,23,0.96)_52%,rgba(53,92,255,0.22)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[#355CFF]/18 blur-2xl" />
        <div className="relative z-10 flex min-h-full flex-col">
        <div className="flex shrink-0 items-center justify-between mb-4 2xl:mb-8 pl-2">
          <h1 className="text-[18px] font-black tracking-tighter text-[#355CFF]">Dash campanhas - GF</h1>
          <button onClick={() => setMobileOpen(false)} className="xl:hidden p-1 hover:bg-[#F5F7FB] rounded-lg">
            <X className="w-5 h-5 text-[#71717A]" />
          </button>
        </div>

        <div className="mb-5 flex items-center justify-between rounded-2xl border border-[#DDE6F7] bg-white/95 p-3 shadow-[0_8px_28px_rgba(53,92,255,0.10)] xl:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#355CFF] text-sm font-black text-white shadow-[0_10px_24px_rgba(53,92,255,0.24)]">
              {(user?.name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#1D1E2C]">{user?.name || "Usuario"}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA]">{isAdmin ? "Meu acesso" : "Equipe"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              logout();
            }}
            title="Sair"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5EAF4] bg-[#F8FAFC] text-[#71717A] transition-colors hover:bg-white hover:text-[#355CFF]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 mt-2 shrink-0">
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest mb-4 pl-2">Principal</p>
          {menuItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.lucasOnly || isLucas)).map((item) => {
            const isActive = pathname === item.href;
            const isLocked = item.href === "/campaigns/create" && !isAdmin;
            const badge = item.href === "/history" ? archivedCampaigns.length : 0;
            const content = (
              <>
                <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-[#355CFF]" : "text-[#71717A] group-hover:text-[#1D1E2C]")} />
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className="ml-auto rounded-full bg-[#EBF1FF] px-2 py-0.5 text-[10px] font-black text-[#355CFF]">
                    {badge}
                  </span>
                )}
              </>
            );

            if (isLocked) {
              return (
                <AdminLock key={item.href} locked className="flex w-full">
                  <div className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#71717A] transition-all duration-200">
                    {content}
                  </div>
                </AdminLock>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium relative group",
                  isActive
                    ? "bg-[#F3F4F6] text-[#355CFF]"
                    : "text-[#71717A] hover:bg-[#F9FAFB] hover:text-[#1D1E2C]"
                )}
              >
                {content}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-0.5 pt-4 border-t border-[#F1F5F9] pb-2 shrink-0">
          <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest mb-4 pl-2">Configurações</p>
          {bottomItems.map((item) => {
            const isActive = pathname === item.href;
            const isLocked = !isAdmin;
            const content = (
              <>
                <item.icon className="w-5 h-5 transition-colors" />
                {item.label}
              </>
            );

            if (isLocked) {
              return (
                <AdminLock key={item.href} locked className="flex w-full">
                  <div className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#71717A] transition-all duration-200">
                    {content}
                  </div>
                </AdminLock>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium relative group",
                  isActive
                    ? "bg-[#F3F4F6] text-[#355CFF]"
                    : "text-[#71717A] hover:bg-[#F9FAFB] hover:text-[#1D1E2C]"
                )}
              >
                {content}
              </Link>
            );
          })}
        </div>

        <div className="w-full mt-2 mb-2 shrink-0">
           <a
             href="https://admanager.google.com/123935210#delivery/order/list"
             target="_blank"
             rel="noopener noreferrer"
             onClick={() => setMobileOpen(false)}
             className="mb-2 flex w-full items-center gap-3 rounded-xl border border-[#DDE6F7] bg-white/90 px-3 py-2.5 text-sm font-medium text-[#71717A] shadow-[0_8px_24px_rgba(53,92,255,0.08)] transition-all hover:border-[#C9D6F2] hover:bg-white hover:text-[#1D1E2C] hover:shadow-[0_10px_28px_rgba(53,92,255,0.12)]"
           >
             <img src="/GAM.png" alt="Google Ad Manager" className="h-5 w-5 object-contain" />
             <span className="flex-1">Google Ad Manager</span>
           </a>
           <a
             href="https://hub.marfeel.com/"
             target="_blank"
             rel="noopener noreferrer"
             onClick={() => setMobileOpen(false)}
             className="mb-2 flex w-full items-center gap-3 rounded-xl border border-[#DDE6F7] bg-white/90 px-3 py-2.5 text-sm font-medium text-[#71717A] shadow-[0_8px_24px_rgba(53,92,255,0.08)] transition-all hover:border-[#C9D6F2] hover:bg-white hover:text-[#1D1E2C] hover:shadow-[0_10px_28px_rgba(53,92,255,0.12)]"
           >
             <MarfeelMark />
             <span className="flex-1">Marfeel</span>
           </a>
           <AdsnapPromoCard />
        </div>

        {/* Developer Card Base */}
        <div className="mt-auto pt-3 2xl:pt-5 shrink-0 pb-3">
          <div className="bg-white/95 backdrop-blur-md border border-[#DDE6F7] rounded-2xl p-3 2xl:p-4 flex flex-col gap-3 shadow-[0_8px_28px_rgba(53,92,255,0.12)] hover:shadow-[0_10px_32px_rgba(53,92,255,0.16)] transition-all cursor-default">
            
            <div className="flex items-center gap-3">
              {/* Foto Profile Holder - Custom injection */}
              <div className="relative w-11 h-11 rounded-xl overflow-hidden group hover:scale-105 transition-transform duration-500 shadow-xl border border-[#E9EDF5] flex-shrink-0 cursor-pointer">
                <img src="https://images.metroimg.com/2026/02/foto-lucas-paim.png" alt="Lucas Paim" className="w-full h-full object-cover grayscale brightness-110 hover:grayscale-0 transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-40 pointer-events-none"></div>
              </div>
              
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-[#A1A1AA] uppercase tracking-[0.15em] flex items-center gap-1.5 leading-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#355CFF]"></span>
                  Desenvolvedor
                </span>
                <span className="text-[15px] font-black text-[#1D1E2C] mt-1 leading-none tracking-tight">
                  LUCAS PAIM
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between gap-1 mt-1">
              <a href="https://github.com/llucaspy" target="_blank" rel="noopener noreferrer" className="w-[34px] h-[34px] rounded-xl border border-[#E9EDF5] flex items-center justify-center text-[#71717A] hover:bg-[#1D1E2C] hover:text-white hover:border-[#1D1E2C] transition-all">
                <Github className="w-4 h-4" />
              </a>
              <a href="https://www.linkedin.com/in/lucas-mendon%C3%A7a-1296412b8?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noopener noreferrer" className="w-[34px] h-[34px] rounded-xl border border-[#E9EDF5] flex items-center justify-center text-[#71717A] hover:bg-[#355CFF] hover:text-white hover:border-[#355CFF] transition-all">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="https://wa.me/556191761606" target="_blank" rel="noopener noreferrer" className="w-[34px] h-[34px] rounded-xl border border-[#E9EDF5] flex items-center justify-center text-[#71717A] hover:bg-green-500 hover:text-white hover:border-green-500 transition-all">
                <MessageCircle className="w-4 h-4" />
              </a>
              <a href="https://www.instagram.com/llucas.py/" target="_blank" rel="noopener noreferrer" className="w-[34px] h-[34px] rounded-xl border border-[#E9EDF5] flex items-center justify-center text-[#71717A] hover:bg-gradient-to-tr hover:from-yellow-400 hover:via-red-500 hover:to-purple-500 hover:text-white hover:border-transparent transition-all">
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
        </div>
      </aside>
    </>
  );
}
