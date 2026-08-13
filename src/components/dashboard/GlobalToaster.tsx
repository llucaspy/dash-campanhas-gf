"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ExternalLink, ChevronDown, ChevronUp, CheckCircle2, TrendingUp } from "lucide-react";
import { useCampaigns } from "../../context/CampaignContext";
import { getCampaignIntelligence } from "../../lib/campaignHealth";
import { useAuth } from "../../context/AuthContext";
import { AdminLock } from "../auth/AdminLock";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";

interface CriticalAlert {
  id: string;
  title: string;
  campaign: string;
  gamLink?: string;
  hasGamLink?: boolean;
  actionMsg: string;
  type: "material" | "attention";
}

interface DeliveryUpdate {
  id: string;
  title: string;
  campaign: string;
  message: string;
  progress: number;
}

export function GlobalToaster() {
  const { campaigns, canViewOperationalInfo } = useCampaigns();
  const { currentCampaigns } = useMemo(() => splitCampaignsByArchive(campaigns), [campaigns]);
  const { isAdmin } = useAuth();
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [deliveryUpdates, setDeliveryUpdates] = useState<DeliveryUpdate[]>([]);
  const [visible, setVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      setCriticalAlerts([]);
      setVisible(false);
      setIsExpanded(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;

    const updates = currentCampaigns
      .map((camp) => {
        const intelligence = getCampaignIntelligence(camp, { isAdmin: canViewOperationalInfo });
        if (intelligence.status === "delivered" || intelligence.status === "almost_delivered") {
          return {
            id: `${camp.id}-${intelligence.status}`,
            title: intelligence.label,
            campaign: camp.campaignName,
            message: intelligence.message,
            progress: intelligence.deliveryPct,
          };
        }

        return null;
      })
      .filter((item): item is DeliveryUpdate => Boolean(item))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 6);

    setDeliveryUpdates(updates);
    setVisible(updates.length > 0);
    if (updates.length === 0) setIsExpanded(false);
  }, [canViewOperationalInfo, currentCampaigns, isAdmin]);

  useEffect(() => {
    const unlock = () => {
      setHasInteracted(true);
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && criticalAlerts.length > 0 && (
        isAdmin ? (
        <motion.div
          layout
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="fixed bottom-6 right-6 z-[100] w-[340px] print:hidden select-none"
        >
          {/* Card Shell */}
          <div className="rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.06] bg-white">
            
            {/* Top accent stripe */}
            <div className="h-[3px] w-full bg-gradient-to-r from-red-500 via-rose-400 to-orange-400" />

            {/* Header row */}
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
              {/* Pulsing icon */}
              <div className="relative flex-shrink-0">
                <motion.div
                  animate={{ scale: [1, 1.18, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500" strokeWidth={2.5} />
                </motion.div>
                {/* Ripple */}
                <motion.div
                  animate={{ scale: [1, 1.6], opacity: [0.35, 0] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
                  className="absolute inset-0 rounded-xl bg-red-400 pointer-events-none"
                />
              </div>

              {/* Texts */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-red-500 tracking-widest uppercase leading-none mb-0.5">
                  Alerta Operacional
                </p>
                <p className="text-[13px] font-bold text-slate-800 leading-snug truncate">
                  {criticalAlerts.length} campanha{criticalAlerts.length > 1 ? "s" : ""} em estado crítico
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setIsExpanded(v => !v)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setVisible(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Collapsed preview */}
            {!isExpanded && (
              <div className="px-4 pb-3.5 space-y-1">
                {criticalAlerts.slice(0, 2).map(a => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-[12px] text-slate-500 truncate">
                      <span className="font-semibold text-slate-700">{a.title}:</span> {a.campaign}
                    </span>
                  </div>
                ))}
                {criticalAlerts.length > 2 && (
                  <p className="text-[11px] text-slate-400 pl-3.5">
                    + {criticalAlerts.length - 2} outros
                  </p>
                )}
                <button
                  onClick={() => setIsExpanded(true)}
                  className="mt-2 w-full text-[11px] font-semibold text-red-500 hover:text-red-600 flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                >
                  Ver detalhes e ações <ChevronUp className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2 max-h-[55vh] overflow-y-auto">
                    {criticalAlerts.map(a => (
                      <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-widest">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              {a.title}
                            </span>
                            <p className="text-[12.5px] font-semibold text-slate-800 mt-0.5 leading-snug">{a.campaign}</p>
                          </div>
                          {a.hasGamLink && isAdmin && (
                            <a
                              href={a.gamLink}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-all"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Setup
                            </a>
                          )}
                          {a.hasGamLink && !isAdmin && (
                            <AdminLock locked>
                              <button
                                type="button"
                                className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg cursor-not-allowed"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Setup
                              </button>
                            </AdminLock>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-200 pt-2 mt-1">
                          {a.actionMsg}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        ) : null
      )}
      {visible && !isAdmin && deliveryUpdates.length > 0 && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="fixed bottom-6 right-6 z-[100] w-[340px] print:hidden select-none"
        >
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06]">
            <div className="h-[3px] w-full bg-gradient-to-r from-emerald-400 via-sky-400 to-[#355CFF]" />
            <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-[11px] font-semibold uppercase leading-none tracking-widest text-emerald-600">
                  Andamento das campanhas
                </p>
                <p className="truncate text-[13px] font-bold leading-snug text-slate-800">
                  {deliveryUpdates.length} campanha{deliveryUpdates.length > 1 ? "s" : ""} entregue{deliveryUpdates.length > 1 ? "s" : ""} ou quase
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setIsExpanded((v) => !v)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setVisible(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isExpanded && (
              <div className="space-y-1 px-4 pb-3.5">
                {deliveryUpdates.slice(0, 2).map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="truncate text-[12px] text-slate-500">
                      <span className="font-semibold text-slate-700">{item.title}:</span> {item.campaign}
                    </span>
                  </div>
                ))}
                {deliveryUpdates.length > 2 && <p className="pl-3.5 text-[11px] text-slate-400">+ {deliveryUpdates.length - 2} outras</p>}
              </div>
            )}

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="max-h-[55vh] space-y-2 overflow-y-auto px-3 pb-3">
                    {deliveryUpdates.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="mb-2 flex items-start gap-2">
                          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{item.title}</p>
                            <p className="mt-0.5 truncate text-[12.5px] font-semibold leading-snug text-slate-800">{item.campaign}</p>
                          </div>
                        </div>
                        <p className="border-t border-slate-200 pt-2 text-[11px] leading-relaxed text-slate-500">{item.message}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
