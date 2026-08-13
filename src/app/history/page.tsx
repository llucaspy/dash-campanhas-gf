"use client";

import { CalendarDays, CheckCircle2, ExternalLink, FileText, History, RotateCcw, Search, Target, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { AdminLock } from "../../components/auth/AdminLock";
import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { useAuth } from "../../context/AuthContext";
import { useCampaigns, type Campaign } from "../../context/CampaignContext";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";
import { calculateTotalImpressions, getCampaignIntelligence } from "../../lib/campaignHealth";

function formatDate(date?: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatNumber(value: number) {
  return Math.round(value || 0).toLocaleString("pt-BR");
}

function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultRestoreEndDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return toDateInputValue(date);
}

export default function HistoryPage() {
  const { campaigns, isLoading, updateCampaign } = useCampaigns();
  const { isAdmin } = useAuth();
  const { archivedCampaigns } = splitCampaignsByArchive(campaigns);
  const [query, setQuery] = useState("");
  const [restoreCampaign, setRestoreCampaign] = useState<Campaign | null>(null);
  const [restoreEndDate, setRestoreEndDate] = useState(getDefaultRestoreEndDate);
  const [isRestoring, setIsRestoring] = useState(false);
  const historyTotalImpressions = archivedCampaigns.reduce((sum, campaign) => sum + calculateTotalImpressions(campaign), 0);
  const historyDeliveredImpressions = archivedCampaigns.reduce((sum, campaign) => sum + (campaign.deliveredImpressions || 0), 0);
  const historyDeliveryPct = historyTotalImpressions > 0 ? Math.round((historyDeliveredImpressions / historyTotalImpressions) * 100) : 0;

  const openRestoreModal = (campaign: Campaign) => {
    setRestoreCampaign(campaign);
    setRestoreEndDate(getDefaultRestoreEndDate());
  };

  const closeRestoreModal = () => {
    if (isRestoring) return;
    setRestoreCampaign(null);
  };

  const restoreArchivedCampaign = async () => {
    if (!restoreCampaign || !restoreEndDate) return;

    setIsRestoring(true);
    try {
      await updateCampaign(restoreCampaign.id, {
        endDate: restoreEndDate,
        status: "veiculando",
      });
      setRestoreCampaign(null);
    } finally {
      setIsRestoring(false);
    }
  };

  const filtered = archivedCampaigns.filter((campaign) => {
    const value = query.trim().toLowerCase();
    if (!value) return true;
    return (
      campaign.campaignName.toLowerCase().includes(value) ||
      (campaign.piNumber || "").toLowerCase().includes(value) ||
      (campaign.client || "").toLowerCase().includes(value)
    );
  });

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC]">
      <Sidebar />
      <main className="relative w-full max-w-full flex-1 overflow-x-hidden bg-[#F8FAFC] xl:ml-[232px] 2xl:ml-[260px]">
        <Topbar />

        <div className="w-full min-w-0 space-y-5 p-3 sm:p-4 xl:p-5 2xl:space-y-6 2xl:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">Histórico</p>
              <h1 className="mt-2 flex items-center gap-3 text-2xl font-black tracking-tight text-[#1D1E2C]">
                <History className="h-6 w-6 text-[#355CFF]" />
                Campanhas encerradas
              </h1>
              <p className="mt-1 text-sm font-medium text-[#71717A]">Consulta de campanhas finalizadas no dashboard.</p>
            </div>

            <div className="relative w-full lg:w-[340px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por campanha, PI ou cliente..."
                className="h-11 w-full rounded-2xl border border-[#E5EAF4] bg-white pl-10 pr-4 text-sm outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-[#D9E3FF] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8A94A6]">Total de impressões</p>
                  <p className="mt-3 text-2xl font-black tracking-tight text-[#1D1E2C]">{formatNumber(historyTotalImpressions)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#71717A]">{archivedCampaigns.length} campanha(s) no histórico</p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F6F9FF] text-[#355CFF]">
                  <Target className="h-5 w-5" />
                </span>
              </div>
            </div>

            <div className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8A94A6]">Impressões entregues</p>
                  <p className="mt-3 text-2xl font-black tracking-tight text-[#1D1E2C]">{formatNumber(historyDeliveredImpressions)}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">{historyDeliveryPct}% do total contratado</p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-[#E9EDF5] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] p-5">
              <p className="text-sm font-black text-[#1D1E2C]">{filtered.length} campanha(s) no histórico</p>
              <span className="rounded-full bg-[#EBF1FF] px-2.5 py-1 text-xs font-bold text-[#355CFF]">{archivedCampaigns.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <tr>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">PI</th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Campanha</th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Cliente</th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Período</th>
                    <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Entrega</th>
                    <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">VA</th>
                    <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Acessos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-sm font-semibold text-[#A1A1AA]">Carregando histórico...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-sm font-semibold text-[#A1A1AA]">Nenhuma campanha encerrada encontrada.</td>
                    </tr>
                  ) : (
                    filtered.map((campaign) => {
                      const total = calculateTotalImpressions(campaign);
                      const delivered = campaign.deliveredImpressions || 0;
                      const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
                      const intelligence = getCampaignIntelligence(campaign, { isAdmin });

                      return (
                        <tr key={campaign.id} className="transition-colors hover:bg-[#F8FAFC]">
                          <td className="px-5 py-4 font-mono text-xs font-semibold text-[#71717A]">{campaign.piNumber || "-"}</td>
                          <td className="px-5 py-4">
                            <p className="max-w-[340px] truncate text-sm font-black text-[#1D1E2C]" title={campaign.campaignName}>{campaign.campaignName}</p>
                            <p className="mt-0.5 text-xs font-medium text-[#A1A1AA]">{intelligence.label}</p>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-[#71717A]">{campaign.client || "-"}</td>
                          <td className="px-5 py-4 text-xs font-semibold text-[#71717A]">{formatDate(campaign.startDate)} a {formatDate(campaign.endDate)}</td>
                          <td className="px-5 py-4 text-right">
                            <p className="text-sm font-black text-[#1D1E2C]">{pct}%</p>
                            <p className="text-[11px] font-medium text-[#A1A1AA]">{delivered.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}</p>
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-black text-[#355CFF]">{campaign.viewabilityPercentage || 0}%</td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => openRestoreModal(campaign)}
                                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-100"
                                  title="Restaurar campanha"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Restaurar
                                </button>
                              )}
                              {campaign.pdfUrl && (
                                <HistoryLink href={campaign.pdfUrl} label="PDF" tone="purple">
                                  <FileText className="h-4 w-4" />
                                </HistoryLink>
                              )}
                              {campaign.gamLink && (
                                isAdmin ? (
                                  <HistoryLink href={campaign.gamLink} label="GAM">
                                    <img src="/GAM.png" alt="Google Ad Manager" className="block h-5 w-5 min-h-5 min-w-5 max-h-5 max-w-5 object-contain" />
                                  </HistoryLink>
                                ) : (
                                  <AdminLock locked>
                                    <button
                                      type="button"
                                      title="Google Ad Manager"
                                      className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-xl border border-[#E9EDF5] bg-white px-3 text-xs font-bold text-[#A1A1AA] opacity-70"
                                    >
                                      <img src="/GAM.png" alt="Google Ad Manager" className="block h-5 w-5 min-h-5 min-w-5 max-h-5 max-w-5 object-contain" />
                                      GAM
                                    </button>
                                  </AdminLock>
                                )
                              )}
                              {campaign.dashLink && (
                                <HistoryLink href={campaign.dashLink} label="Dashboard">
                                  <ExternalLink className="h-4 w-4" />
                                </HistoryLink>
                              )}
                              {campaign.gmailLink && (
                                <HistoryLink href={campaign.gmailLink} label="Fluxo">
                                  <img src="/gmail.png" alt="Fluxo Gmail" className="block h-5 w-5 min-h-5 min-w-5 max-h-5 max-w-5 object-contain" />
                                </HistoryLink>
                              )}
                              {!isAdmin && !campaign.pdfUrl && !campaign.gamLink && !campaign.dashLink && !campaign.gmailLink && (
                                <span className="text-xs font-semibold text-[#A1A1AA]">Sem links</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {restoreCampaign && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-[#0F172A]/65 px-4 py-6 backdrop-blur-sm" onClick={closeRestoreModal}>
          <div className="w-full max-w-[480px] overflow-hidden rounded-[24px] border border-[#E9EDF5] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[#F1F5F9] p-5">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar campanha
                </div>
                <h2 className="truncate text-lg font-black text-[#1D1E2C]" title={restoreCampaign.campaignName}>{restoreCampaign.campaignName}</h2>
                <p className="mt-1 text-sm font-medium text-[#71717A]">
                  A campanha volta para Minhas Campanhas como veiculando.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRestoreModal}
                disabled={isRestoring}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#A1A1AA] transition-colors hover:bg-[#F5F7FB] hover:text-[#1D1E2C] disabled:cursor-not-allowed disabled:opacity-60"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-[#E9EDF5] bg-[#F8FAFC] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A1A1AA]">Período atual</p>
                <p className="mt-2 text-sm font-bold text-[#1D1E2C]">
                  {formatDate(restoreCampaign.startDate)} a {formatDate(restoreCampaign.endDate)}
                </p>
              </div>

              <label className="block">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#71717A]">
                  <CalendarDays className="h-3.5 w-3.5 text-[#355CFF]" />
                  Nova data final
                </span>
                <input
                  type="date"
                  value={restoreEndDate}
                  min={toDateInputValue()}
                  onChange={(event) => setRestoreEndDate(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-[#E2E8F3] bg-white px-4 text-sm font-bold text-[#1D1E2C] outline-none transition-all focus:border-[#355CFF] focus:ring-4 focus:ring-[#355CFF]/10"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#F1F5F9] bg-[#FBFCFF] p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeRestoreModal}
                disabled={isRestoring}
                className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-black text-[#71717A] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={restoreArchivedCampaign}
                disabled={isRestoring || !restoreEndDate}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-600/15 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RotateCcw className="h-4 w-4" />
                {isRestoring ? "Restaurando..." : "Restaurar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryLink({ href, label, tone = "blue", children }: { href: string; label: string; tone?: "blue" | "purple"; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      className={`inline-flex h-9 items-center gap-2 rounded-xl border border-[#E9EDF5] bg-white px-3 text-xs font-bold transition-all ${
        tone === "purple"
          ? "text-[#8B5CF6] hover:border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/10"
          : "text-[#525866] hover:border-[#355CFF]/30 hover:bg-[#F6F9FF] hover:text-[#355CFF]"
      }`}
    >
      {children}
      {label}
    </a>
  );
}
