"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FileText,
  Github,
  LogOut,
  Maximize2,
  Minimize2,
  Moon,
  Printer,
  RefreshCw,
  Search,
  Sun,
  Target,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import type { ElementType } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../context/ThemeContext";
import { Campaign, useCampaigns } from "../../context/CampaignContext";
import { useAuth } from "../../context/AuthContext";
import { calculateTotalImpressions, getCampaignIntelligence } from "../../lib/campaignHealth";

function formatDate(date?: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { campaigns, canViewOperationalInfo, lastUpdatedAt } = useCampaigns();
  const { user, logout, isAdmin } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeAgo, setTimeAgo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const query = searchTerm.trim().toLowerCase();
  const searchResults = query
    ? campaigns
        .filter((campaign) => {
          return (
            campaign.campaignName.toLowerCase().includes(query) ||
            (campaign.piNumber || "").toLowerCase().includes(query) ||
            (campaign.client || "").toLowerCase().includes(query)
          );
        })
        .slice(0, 6)
    : [];

  const selectedTotal = selectedCampaign ? calculateTotalImpressions(selectedCampaign) : 0;
  const selectedDelivered = selectedCampaign?.deliveredImpressions || 0;
  const selectedDeliveryPct = selectedTotal > 0 ? Math.round((selectedDelivered / selectedTotal) * 100) : 0;
  const selectedIntelligence = selectedCampaign ? getCampaignIntelligence(selectedCampaign, { isAdmin: canViewOperationalInfo }) : null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Monitora mudanças de fullscreen vindas de outras fontes (ESC, etc.)
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Calcula tempo relativo desde a última atualização
  const computeTimeAgo = useCallback(() => {
    if (!lastUpdatedAt) { setTimeAgo(""); return; }
    const now = new Date();
    const diffMs = now.getTime() - lastUpdatedAt.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffH = Math.floor(diffMin / 60);

    if (diffSec < 30) setTimeAgo("agora");
    else if (diffSec < 60) setTimeAgo("há poucos seg");
    else if (diffMin < 60) setTimeAgo(`há ${diffMin} min`);
    else setTimeAgo(`há ${diffH}h ${diffMin % 60}min`);
  }, [lastUpdatedAt]);

  useEffect(() => {
    computeTimeAgo();
    const interval = setInterval(computeTimeAgo, 30000);
    return () => clearInterval(interval);
  }, [computeTimeAgo]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-16 2xl:h-[72px] bg-white dark:bg-[#0F1117] backdrop-blur-md border-b border-[#E9EDF5] dark:border-white/10 sticky top-0 z-40 px-3 sm:px-4 xl:px-5 2xl:px-8 flex items-center justify-between print:hidden transition-colors duration-300">
      <div className="flex items-center gap-2 xl:gap-3 text-sm text-[#71717A] ml-10 xl:ml-0">
        <div className="flex items-center gap-1 lg:gap-2">
          <span className="hidden sm:inline dark:text-white/40">GF</span>
          <ChevronRight className="w-4 h-4 hidden sm:block dark:text-white/30" />
          <span className="hidden text-[#1D1E2C] dark:text-white font-semibold text-xs sm:inline sm:text-sm">Dash campanhas</span>
        </div>

        {/* Badge Última Sincronização */}
        {timeAgo && (
          <div className="hidden md:flex items-center gap-1.5 ml-2 px-2.5 py-1 bg-[#F0FDF4] dark:bg-emerald-500/10 rounded-lg border border-emerald-200/60 dark:border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
              Sync: {timeAgo}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 xl:gap-4 2xl:gap-6">
        <div className="relative group hidden md:block">
          <Search className="w-5 h-5 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2 group-hover:text-[#355CFF] transition-colors" />
          <input
            type="text"
            placeholder="Buscar campanha..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="bg-[#F5F7FB] dark:bg-white/10 dark:text-white dark:placeholder:text-white/30 border-none rounded-xl py-2 pl-10 pr-4 text-sm w-[220px] xl:w-[240px] 2xl:w-[280px] focus:ring-2 focus:ring-[#355CFF]/20 transition-all outline-none"
          />
          {searchTerm && (
            <div className="absolute right-0 top-[46px] z-50 w-[360px] overflow-hidden rounded-2xl border border-[#E9EDF5] bg-white shadow-[0_22px_70px_rgba(18,24,38,0.14)]">
              {searchResults.length > 0 ? (
                searchResults.map((campaign) => {
                  const total = calculateTotalImpressions(campaign);
                  const pct = total > 0 ? Math.round(((campaign.deliveredImpressions || 0) / total) * 100) : 0;

                  return (
                    <button
                      key={campaign.id}
                      type="button"
                      onClick={() => {
                        setSelectedCampaign(campaign);
                        setSearchTerm("");
                      }}
                      className="block w-full border-b border-[#F1F5F9] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#F8FAFC]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#1D1E2C]">{campaign.campaignName}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-[#A1A1AA]">
                            PI {campaign.piNumber || "-"} · {campaign.client || "-"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#EBF1FF] px-2 py-0.5 text-[10px] font-bold text-[#355CFF]">{pct}%</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-5 text-sm font-semibold text-[#A1A1AA]">Nenhuma campanha encontrada.</div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 xl:gap-2 2xl:gap-3 xl:border-l border-[#E9EDF5] dark:border-white/10 xl:pl-4 2xl:pl-6">
          <a href="https://github.com/llucaspy" target="_blank" rel="noreferrer" className="hidden 2xl:flex items-center gap-2 px-2.5 py-1.5 bg-[#F5F7FB] dark:bg-white/10 rounded-lg cursor-pointer hover:bg-[#F1F4F9] dark:hover:bg-[#F1F4F9] transition-all text-[#1D1E2C] dark:text-white hover:text-[#1D1E2C] dark:hover:text-[#1D1E2C] group">
            <Github className="w-4 h-4" />
            <span className="text-xs font-medium">Github: llucas.py</span>
          </a>

          {/* Botão de Tema */}
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
            className="flex items-center justify-center rounded-lg p-2 text-[#71717A] transition-all hover:bg-[#F5F7FB] hover:text-[#1D1E2C] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          {/* Botão Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            className="hidden items-center justify-center rounded-lg p-2 text-[#71717A] transition-all hover:bg-[#F5F7FB] hover:text-[#1D1E2C] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white sm:flex"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>

          {/* Gerar PDF */}
          <button
            onClick={() => window.print()}
            title="Gerar resumo executivo em PDF"
            className="flex items-center gap-2 rounded-xl bg-[#355CFF] px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#355CFF]/90 sm:px-3 2xl:px-4 2xl:text-sm"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden md:inline">Resumo PDF</span>
          </button>

          <div className="flex items-center gap-1.5 2xl:gap-3 ml-1 xl:ml-2 pl-2 xl:pl-3 2xl:pl-4 border-l border-[#E9EDF5] dark:border-white/10">
            <div className="text-right hidden sm:block">
              <p className="max-w-[110px] truncate text-xs 2xl:text-sm font-semibold text-[#1D1E2C] dark:text-white">{user?.name || "Usuário"}</p>
              <p className="text-[10px] text-[#A1A1AA] font-medium">{user?.role === "ADMIN" ? "Meu acesso" : "Equipe"}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DCE6FF] bg-[#EBF1FF] text-sm font-black text-[#355CFF] shadow-sm 2xl:h-10 2xl:w-10">
              {(user?.name || "U").charAt(0).toUpperCase()}
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="flex rounded-lg p-2 text-[#71717A] transition-all hover:bg-[#F5F7FB] hover:text-[#1D1E2C] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {isMounted && selectedCampaign && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-[#E9EDF5] bg-white shadow-[0_30px_100px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#F1F5F9] p-6">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#EBF1FF] px-2.5 py-1 text-xs font-black text-[#355CFF]">PI {selectedCampaign.piNumber || "-"}</span>
                  <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1 text-xs font-bold text-[#71717A]">{selectedIntelligence?.label}</span>
                </div>
                <h2 className="truncate text-xl font-black tracking-tight text-[#1D1E2C]">{selectedCampaign.campaignName}</h2>
                <p className="mt-1 text-sm font-medium text-[#71717A]">{selectedCampaign.client || "Cliente nao informado"} · {selectedCampaign.agency || "Agencia nao informada"}</p>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#E5EAF4] text-[#71717A] transition-colors hover:bg-[#F8FAFC] hover:text-[#1D1E2C]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <CampaignMetric icon={Target} label="Entrega" value={`${selectedDeliveryPct}%`} detail={`${selectedDelivered.toLocaleString("pt-BR")} de ${selectedTotal.toLocaleString("pt-BR")}`} />
                <CampaignMetric icon={BarChart3} label="Viewability" value={`${selectedCampaign.viewabilityPercentage || 0}%`} detail="VA registrado" />
                <CampaignMetric icon={CalendarDays} label="Inicio" value={formatDate(selectedCampaign.startDate)} detail="Periodo de veiculacao" />
                <CampaignMetric icon={CalendarDays} label="Fim" value={formatDate(selectedCampaign.endDate)} detail="Encerramento" />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
                <div className="rounded-2xl border border-[#E9EDF5] bg-[#FBFCFF] p-5">
                  <h3 className="mb-4 text-sm font-black text-[#1D1E2C]">Informacoes da campanha</h3>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <InfoLine label="Adserver" value={selectedCampaign.adserver || "-"} />
                    <InfoLine label="Status" value={selectedIntelligence?.label || "-"} />
                    <InfoLine label="Cliente" value={selectedCampaign.client || "-"} />
                    <InfoLine label="Agencia" value={selectedCampaign.agency || "-"} />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <PurchaseList title="Compra paga" items={selectedCampaign.paidPurchases} />
                    <PurchaseList title="Bonificacao" items={selectedCampaign.bonusPurchases} />
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedCampaign.pdfUrl ? (
                    <a
                      href={selectedCampaign.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-[#E9EDF5] bg-white p-4 text-sm font-bold text-[#1D1E2C] shadow-sm transition-all hover:border-[#355CFF]/30 hover:bg-[#F6F9FF]"
                    >
                      <span className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-[#8B5CF6]" />
                        Abrir PDF da campanha
                      </span>
                      <ExternalLink className="h-4 w-4 text-[#A1A1AA]" />
                    </a>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#A1A1AA]">
                      Nenhum PDF anexado nesta campanha.
                    </div>
                  )}

                  {selectedCampaign.dashLink && <QuickLink href={selectedCampaign.dashLink} label="Abrir dashboard da campanha" />}
                  {selectedCampaign.gmailLink && <QuickLink href={selectedCampaign.gmailLink} label="Abrir fluxo" />}
                  {selectedCampaign.gamLink && <QuickLink href={selectedCampaign.gamLink} label="Abrir GAM" />}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}

function CampaignMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E9EDF5] bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#EBF1FF] text-[#355CFF]">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A1A1AA]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#1D1E2C]">{value}</p>
      <p className="mt-0.5 truncate text-xs font-medium text-[#71717A]">{detail}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#A1A1AA]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-[#1D1E2C]">{value}</p>
    </div>
  );
}

function PurchaseList({ title, items }: { title: string; items: Campaign["paidPurchases"] }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.08em] text-[#A1A1AA]">{title}</p>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.id || index} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-semibold text-[#525866]">{item.description || "Volume"}</span>
              <span className="shrink-0 font-black text-[#1D1E2C]">{item.volume}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs font-semibold text-[#A1A1AA]">Sem itens registrados.</p>
      )}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-2xl border border-[#E9EDF5] bg-white p-4 text-sm font-bold text-[#1D1E2C] shadow-sm transition-all hover:border-[#355CFF]/30 hover:bg-[#F6F9FF]"
    >
      {label}
      <ExternalLink className="h-4 w-4 text-[#A1A1AA]" />
    </a>
  );
}
