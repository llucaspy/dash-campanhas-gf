"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellPlus, CalendarDays, Check, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { Campaign } from "../../context/CampaignContext";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { CampaignInfoModal } from "./CampaignInfoModal";

type NewCampaignNotification = Campaign & { implementationDate: string };

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function NewCampaignToaster() {
  const { user, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<NewCampaignNotification[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<NewCampaignNotification | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const visible = campaigns.length > 0;
  const primaryCampaign = campaigns[0];
  const campaignIds = useMemo(() => campaigns.map((campaign) => campaign.id), [campaigns]);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setCampaigns([]);
      return;
    }

    try {
      const response = await fetch("/api/campaign-notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
    } catch {
      setCampaigns([]);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const acknowledge = async () => {
    if (campaignIds.length === 0) return;
    setIsAcknowledging(true);

    try {
      const response = await fetch("/api/campaign-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignIds }),
      });

      if (response.ok) {
        setCampaigns([]);
        setIsExpanded(false);
        setSelectedCampaign(null);
      }
    } finally {
      setIsAcknowledging(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {visible && primaryCampaign && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="fixed right-4 top-4 z-[230] w-[min(420px,calc(100vw-24px))] select-none print:hidden xl:right-6 xl:top-6"
          >
            <div className="overflow-hidden rounded-[22px] border border-[#DCE6FF] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.18)]">
              <div className="h-[3px] w-full bg-gradient-to-r from-[#355CFF] via-sky-400 to-emerald-400" />

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                    <BellPlus className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#355CFF]">
                      {campaigns.length > 1 ? "Campanhas adicionadas" : "Nova campanha adicionada"}
                    </p>
                    <p className="mt-1 truncate text-sm font-black text-[#1D1E2C]" title={primaryCampaign.campaignName}>
                      {primaryCampaign.campaignName}
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-[#71717A]" title={primaryCampaign.client}>
                      PI {primaryCampaign.piNumber || "-"} · {primaryCampaign.client || "Cliente nao informado"}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#A1A1AA]">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Implementada em {formatDate(primaryCampaign.implementationDate || primaryCampaign.createdAt)}
                    </div>
                  </div>

                  {campaigns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded((value) => !value)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#A1A1AA] transition-colors hover:bg-[#F5F7FB] hover:text-[#1D1E2C]"
                      title={isExpanded ? "Recolher campanhas" : "Ver todas as campanhas"}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setSelectedCampaign(primaryCampaign)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#D9E3FF] bg-[#F6F9FF] px-3 text-xs font-black text-[#355CFF] transition-colors hover:bg-[#EBF1FF]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir infos
                  </button>
                  <button
                    type="button"
                    onClick={acknowledge}
                    disabled={isAcknowledging}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#355CFF] px-3 text-xs font-black text-white shadow-[0_12px_28px_rgba(53,92,255,0.20)] transition-colors hover:bg-[#2849D6] disabled:cursor-wait disabled:opacity-70"
                  >
                    <Check className="h-4 w-4" />
                    {isAcknowledging ? "Salvando..." : "OK, visualizado"}
                  </button>
                </div>

                {campaigns.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded((value) => !value)}
                    className="mt-3 w-full text-center text-xs font-black text-[#355CFF] transition-colors hover:text-[#2849D6]"
                  >
                    {isExpanded ? "Ocultar demais campanhas" : `Ver mais ${campaigns.length - 1} campanha(s) de hoje/ontem`}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {isExpanded && campaigns.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-[#EEF2F8] bg-[#FBFCFF]"
                  >
                    <div className="max-h-[44vh] space-y-2 overflow-y-auto p-3">
                      {campaigns.map((campaign) => (
                        <button
                          type="button"
                          key={campaign.id}
                          onClick={() => setSelectedCampaign(campaign)}
                          className={cn(
                            "w-full rounded-2xl border bg-white p-3 text-left transition-colors hover:border-[#D9E3FF] hover:bg-[#F6F9FF]",
                            campaign.id === primaryCampaign.id ? "border-[#D9E3FF]" : "border-[#EEF2F8]"
                          )}
                        >
                          <span className="block truncate text-xs font-black text-[#1D1E2C]" title={campaign.campaignName}>
                            {campaign.campaignName}
                          </span>
                          <span className="mt-1 block truncate text-[11px] font-bold text-[#71717A]" title={campaign.client}>
                            PI {campaign.piNumber || "-"} · {campaign.client || "Cliente nao informado"}
                          </span>
                          <span className="mt-2 block text-[11px] font-semibold text-[#A1A1AA]">
                            Implementada em {formatDate(campaign.implementationDate || campaign.createdAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedCampaign && (
        <CampaignInfoModal
          campaign={selectedCampaign}
          isAdmin={isAdmin}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </>
  );
}
