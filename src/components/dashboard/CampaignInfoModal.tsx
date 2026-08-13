"use client";

import { X, Building2, CalendarDays, ExternalLink, FileText, Link2, Mail, MonitorPlay, UserSquare2 } from "lucide-react";
import type { Campaign, Purchase } from "../../context/CampaignContext";
import { calculateTotalImpressions, getCampaignIntelligence, type CampaignTone } from "../../lib/campaignHealth";
import { cn } from "../../lib/utils";
import { AdminLock } from "../auth/AdminLock";

function getSituationStyle(tone: CampaignTone) {
  if (tone === "success") return "bg-emerald-100 text-emerald-700";
  if (tone === "danger") return "bg-red-100 text-red-700";
  if (tone === "warning") return "bg-amber-100 text-amber-700";
  if (tone === "info") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

function formatDate(date?: string) {
  return date ? new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";
}

function formatNumber(value?: number) {
  return (value || 0).toLocaleString("pt-BR");
}

function PurchaseList({ title, purchases }: { title: string; purchases: Purchase[] }) {
  const validPurchases = purchases.filter((purchase) => purchase.description || purchase.volume);

  return (
    <div className="rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A1A1AA]">{title}</p>
      <div className="mt-3 space-y-2">
        {validPurchases.length === 0 ? (
          <p className="text-xs font-semibold text-[#A1A1AA]">Nenhum volume cadastrado.</p>
        ) : (
          validPurchases.map((purchase, index) => (
            <div key={`${title}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs">
              <span className="min-w-0 truncate font-bold text-[#1D1E2C]" title={purchase.description}>{purchase.description || "Sem descricao"}</span>
              <span className="shrink-0 font-black text-[#355CFF]">{purchase.volume || "-"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function CampaignInfoModal({
  campaign,
  isAdmin,
  canViewOperationalInfo = isAdmin,
  onClose,
}: {
  campaign: Campaign;
  isAdmin: boolean;
  canViewOperationalInfo?: boolean;
  onClose: () => void;
}) {
  const intelligence = getCampaignIntelligence(campaign, { isAdmin: canViewOperationalInfo });
  const totalImpressions = calculateTotalImpressions(campaign);
  const deliveryPct = totalImpressions > 0 ? Math.round(((campaign.deliveredImpressions || 0) / totalImpressions) * 100) : 0;
  const links = [
    { href: campaign.dashLink, label: "Relatorio", icon: ExternalLink },
    { href: campaign.pdfUrl, label: "PI", icon: FileText },
    { href: campaign.hasGamLink ? campaign.gamLink : undefined, label: "GAM", icon: MonitorPlay, operationalOnly: true },
    { href: campaign.gmailLink, label: "Fluxo Gmail", icon: Mail },
  ].filter((link) => link.href);

  return (
    <div className="fixed inset-0 z-[280] flex items-start justify-center overflow-y-auto bg-[#0F172A]/70 px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-10" onClick={onClose}>
      <div className="w-full max-w-[920px] overflow-hidden rounded-[22px] border border-[#E9EDF5] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#F1F5F9] p-5 sm:p-6">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-[#EBF1FF] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#355CFF]">PI {campaign.piNumber || "-"}</span>
              <span className={cn("inline-flex min-h-6 items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.04em]", getSituationStyle(intelligence.tone))}>
                {intelligence.label}
              </span>
            </div>
            <h2 className="text-xl font-black leading-tight text-[#1D1E2C] sm:text-2xl">{campaign.campaignName}</h2>
            <p className="mt-2 max-w-[680px] text-sm font-medium leading-6 text-[#71717A]">{intelligence.message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#A1A1AA] transition-colors hover:bg-[#F5F7FB] hover:text-[#1D1E2C]"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:p-6">
          <div className="rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
              <Building2 className="h-4 w-4" />
              Cliente
            </div>
            <p className="mt-2 truncate text-sm font-black text-[#1D1E2C]" title={campaign.client}>{campaign.client || "-"}</p>
          </div>
          <div className="rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
              <UserSquare2 className="h-4 w-4" />
              Agencia
            </div>
            <p className="mt-2 truncate text-sm font-black text-[#1D1E2C]" title={campaign.agency}>{campaign.agency || "-"}</p>
          </div>
          <div className="rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC] p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
              <CalendarDays className="h-4 w-4" />
              Periodo
            </div>
            <p className="mt-2 text-sm font-black text-[#1D1E2C]">{formatDate(campaign.startDate)} a {formatDate(campaign.endDate)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-3 sm:px-6 sm:pb-6">
          <div className="rounded-2xl border border-[#F1F5F9] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A1A1AA]">Contratado</p>
            <p className="mt-2 text-xl font-black text-[#1D1E2C]">{totalImpressions.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-2xl border border-[#F1F5F9] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A1A1AA]">Entregue</p>
            <p className="mt-2 text-xl font-black text-[#355CFF]">{formatNumber(campaign.deliveredImpressions)}</p>
          </div>
          <div className="rounded-2xl border border-[#F1F5F9] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A1A1AA]">Entrega / VA</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-xl font-black text-[#1D1E2C]">{deliveryPct}%</p>
              <p className="pb-1 text-xs font-bold text-[#A1A1AA]">VA {campaign.viewabilityPercentage || 0}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9EDF5]">
              <div className={cn("h-full rounded-full", deliveryPct >= 100 ? "bg-[#22C55E]" : deliveryPct >= 70 ? "bg-[#355CFF]" : "bg-[#FB923C]")} style={{ width: `${Math.min(deliveryPct, 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6 sm:pb-6">
          <PurchaseList title="Impressões pagas" purchases={campaign.paidPurchases || []} />
          <PurchaseList title="Cotas bonificadas" purchases={campaign.bonusPurchases || []} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[#F1F5F9] bg-[#FBFCFF] p-5 sm:p-6">
          {links.length === 0 ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#A1A1AA]">
              <Link2 className="h-4 w-4" />
              Sem links cadastrados
            </span>
          ) : (
            links.map((link) => {
              const Icon = link.icon;

              if (link.operationalOnly && !canViewOperationalInfo) {
                return (
                  <AdminLock key={link.label} locked>
                    <button type="button" className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#71717A]">
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </button>
                  </AdminLock>
                );
              }

              return (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#355CFF] transition-colors hover:bg-[#EBF1FF]">
                  <Icon className="h-4 w-4" />
                  {link.label}
                </a>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
