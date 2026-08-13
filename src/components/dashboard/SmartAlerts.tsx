"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, BarChart3, CheckCircle2, ChevronDown, Clock, ExternalLink, MailOpen, ShieldAlert, Trash2, TrendingUp } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useCampaigns } from "../../context/CampaignContext";
import { cn } from "../../lib/utils";
import { getCampaignIntelligence, type CampaignCoreStatus, type CampaignTone } from "../../lib/campaignHealth";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";

const alertIcons: Record<CampaignCoreStatus, any> = {
  delivered: CheckCircle2,
  almost_delivered: TrendingUp,
  on_track: BarChart3,
  attention: ShieldAlert,
  material_pending: Clock,
  sponsorship_active: ShieldAlert,
};

type SmartAlertsView = "campaigns" | "gmail";

interface GmailAlert {
  id: string;
  senderName?: string | null;
  senderEmail?: string | null;
  subject?: string | null;
  snippet?: string | null;
  priority: "low" | "normal" | "high" | "critical";
  status: "new" | "seen" | "in_progress" | "resolved" | "ignored";
  receivedAt?: string | null;
  gmailUrl?: string | null;
  matchedTargets: string[];
  reasons: unknown[];
  senderIsImportant?: boolean;
  senderColor?: string | null;
}

interface GmailAlertsState {
  enabled: boolean;
  configured: boolean;
  unreadCount: number;
  alerts: GmailAlert[];
  available: boolean;
  isLoading: boolean;
  lastSyncError?: string | null;
  lastSyncMessage?: string | null;
}

const GMAIL_ALERT_REFRESH_INTERVAL_MS = 30 * 1000;
const GMAIL_DASHBOARD_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const GMAIL_DASHBOARD_SYNC_STORAGE_KEY = "dashboard-gf-last-gmail-dashboard-sync";

function getAlertTone(tone: CampaignTone) {
  if (tone === "success") {
    return {
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      card: "border-emerald-100 bg-emerald-50/20 hover:border-emerald-200",
    };
  }

  if (tone === "danger") {
    return {
      color: "text-red-600",
      bg: "bg-red-50",
      card: "border-red-200 bg-red-50/30 hover:border-red-300",
    };
  }

  if (tone === "warning") {
    return {
      color: "text-amber-600",
      bg: "bg-amber-50",
      card: "border-amber-100 bg-amber-50/30 hover:border-amber-200",
    };
  }

  return {
    color: "text-[#355CFF]",
    bg: "bg-[#EBF1FF]",
    card: "border-[#F1F5F9] hover:border-[#355CFF]/20 hover:bg-[#F8FAFC]",
  };
}

function getGmailPriorityTone(priority: GmailAlert["priority"], status: GmailAlert["status"]) {
  if (priority === "critical" || priority === "high") {
    return {
      card: "border-red-200 bg-red-50/30 hover:border-red-300",
      iconBg: "bg-white",
      title: "text-red-700",
      meta: "text-red-500",
      badge: "bg-red-100 text-red-700",
    };
  }

  if (status === "new") {
    return {
      card: "border-[#DCE6FF] bg-[#F6F9FF] hover:border-[#355CFF]/30",
      iconBg: "bg-white",
      title: "text-[#1D1E2C] group-hover:text-[#355CFF]",
      meta: "text-[#355CFF]",
      badge: "bg-[#EBF1FF] text-[#355CFF]",
    };
  }

  return {
    card: "border-[#F1F5F9] hover:border-[#355CFF]/20 hover:bg-[#F8FAFC]",
    iconBg: "bg-[#F8FAFC]",
    title: "text-[#1D1E2C] group-hover:text-[#355CFF]",
    meta: "text-[#71717A]",
    badge: "bg-slate-100 text-slate-500",
  };
}

function safeHexColor(value?: string | null) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : "#2563EB";
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = safeHexColor(hex).replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatReceivedAt(value?: string | null) {
  if (!value) return "Horario nao informado";

  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ViewSwitcher({
  activeView,
  onChange,
  showGmail,
  campaignCount,
  gmailCount,
}: {
  activeView: SmartAlertsView;
  onChange: (view: SmartAlertsView) => void;
  showGmail: boolean;
  campaignCount: number;
  gmailCount: number;
}) {
  if (!showGmail) return <div className="rounded-lg bg-[#EBF1FF] px-2.5 py-1 text-xs font-semibold text-[#355CFF]">{campaignCount}</div>;

  return (
    <div className="flex shrink-0 rounded-xl border border-[#E9EDF5] bg-[#F8FAFC] p-1">
      <button
        type="button"
        onClick={() => onChange("campaigns")}
        className={cn(
          "h-8 rounded-lg px-2.5 text-[11px] font-black transition-all",
          activeView === "campaigns" ? "bg-white text-[#355CFF] shadow-sm" : "text-[#71717A] hover:text-[#1D1E2C]"
        )}
      >
        Avisos {campaignCount}
      </button>
      <button
        type="button"
        onClick={() => onChange("gmail")}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-black transition-all",
          activeView === "gmail" ? "bg-white text-[#355CFF] shadow-sm" : "text-[#71717A] hover:text-[#1D1E2C]"
        )}
      >
        <img src="/gmail.png" alt="" className="h-3.5 w-3.5 object-contain" />
        Gmail {gmailCount}
      </button>
    </div>
  );
}

function ImportantAlertsCard({
  smartAlerts,
  canViewOperationalInfo,
  activeView,
  showGmail,
  gmailCount,
  onViewChange,
}: {
  smartAlerts: any[];
  canViewOperationalInfo: boolean;
  activeView: SmartAlertsView;
  showGmail: boolean;
  gmailCount: number;
  onViewChange: (view: SmartAlertsView) => void;
}) {
  return (
    <motion.div
      key="important-alerts"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="relative flex h-full min-h-0 flex-1 flex-col rounded-[22px] border border-[#E9EDF5] bg-white p-4 shadow-sm 2xl:rounded-[32px] 2xl:p-8"
    >
      <div className="mb-8 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[#1D1E2C]">
            <AlertCircle className="h-4 w-4 text-[#355CFF]" />
            Avisos Importantes
          </h3>
          <p className="mt-0.5 text-xs text-[#A1A1AA]">{canViewOperationalInfo ? "Acompanhamento operacional" : "Andamento das campanhas"}</p>
        </div>
        <ViewSwitcher activeView={activeView} onChange={onViewChange} showGmail={showGmail} campaignCount={smartAlerts.length} gmailCount={gmailCount} />
      </div>

      <div className="scrollbar-thin scrollbar-thumb-[#E2E8F0] scrollbar-track-transparent flex-1 space-y-4 overflow-y-auto pb-4 pr-2">
        {smartAlerts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center opacity-50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F8FAFC]">
              <AlertCircle className="h-5 w-5 text-[#A1A1AA]" />
            </div>
            <p className="text-sm font-semibold text-[#1D1E2C]">Tudo em acompanhamento</p>
            <p className="mt-1 text-xs text-[#A1A1AA]">Nenhum movimento relevante no momento.</p>
          </div>
        ) : (
          smartAlerts.map((alert) => (
            <div key={alert.id} className={cn("group flex gap-4 rounded-2xl border p-4 transition-all", alert.card)}>
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", alert.bg)}>
                <alert.icon className={cn("h-5 w-5", alert.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className={cn("truncate text-[13px] font-semibold transition-colors", alert.isCritical ? "text-red-700" : "text-[#1D1E2C] group-hover:text-[#355CFF]")}>
                  {alert.title}
                </h4>
                <p className={cn("mt-0.5 truncate text-[11px] font-medium", alert.isCritical ? "text-red-500" : "text-[#355CFF]")} title={alert.campaign}>
                  {alert.campaign}
                </p>
                <p className={cn("mt-1 break-words text-[11px] leading-relaxed", alert.isCritical ? "text-red-600" : "text-[#71717A]")}>
                  {alert.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {smartAlerts.length > 3 && (
        <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex h-16 items-end justify-center rounded-b-[32px] bg-gradient-to-t from-white via-white/80 to-transparent pb-0">
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="flex items-center gap-1 rounded-full border border-[#E9EDF5] bg-white/50 px-3 py-1 shadow-sm backdrop-blur-md"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#355CFF]">Scroll</span>
            <ChevronDown className="h-3 w-3 text-[#355CFF]" />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function GmailAlertsCard({
  gmailState,
  activeView,
  campaignCount,
  onViewChange,
  onDismiss,
  dismissingAlertId,
}: {
  gmailState: GmailAlertsState;
  activeView: SmartAlertsView;
  campaignCount: number;
  onViewChange: (view: SmartAlertsView) => void;
  onDismiss: (alert: GmailAlert) => void;
  dismissingAlertId: string | null;
}) {
  return (
    <motion.div
      key="gmail-alerts"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="relative flex h-full min-h-0 flex-1 flex-col rounded-[22px] border border-[#E9EDF5] bg-white p-4 shadow-sm 2xl:rounded-[32px] 2xl:p-8"
    >
      <div className="mb-8 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[#1D1E2C]">
            <img src="/gmail.png" alt="Gmail" className="h-4 w-4 object-contain" />
            Gmail
          </h3>
          <p className="mt-0.5 text-xs text-[#A1A1AA]">
            {gmailState.enabled ? "Emails que pedem atencao" : "Monitoramento preparado para ativacao"}
          </p>
        </div>
        <ViewSwitcher activeView={activeView} onChange={onViewChange} showGmail campaignCount={campaignCount} gmailCount={gmailState.unreadCount} />
      </div>

      <div className="scrollbar-thin scrollbar-thumb-[#E2E8F0] scrollbar-track-transparent flex-1 space-y-4 overflow-y-auto pb-4 pr-2">
        {gmailState.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC]" />
            ))}
          </div>
        ) : gmailState.alerts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center opacity-70">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F8FAFC]">
              <MailOpen className="h-5 w-5 text-[#A1A1AA]" />
            </div>
            <p className="text-sm font-semibold text-[#1D1E2C]">Sem emails em destaque</p>
            <p className="mt-1 max-w-[260px] text-xs leading-5 text-[#A1A1AA]">
              {!gmailState.enabled
                ? "Ative o monitoramento nas configuracoes para iniciar."
                : !gmailState.configured
                  ? "Complete as credenciais do Gmail nas configuracoes."
                  : gmailState.lastSyncError || "Quando chegar um email novo envolvendo Lucas ou OPEC, este card assume o lugar dos avisos."}
            </p>
          </div>
        ) : (
          gmailState.alerts.map((alert) => {
            const tone = getGmailPriorityTone(alert.priority, alert.status);
            const title = alert.subject || "Email sem assunto";
            const sender = alert.senderName || alert.senderEmail || "Remetente nao informado";
            const target = alert.matchedTargets?.[0] ? `Alvo: ${alert.matchedTargets[0]}` : formatReceivedAt(alert.receivedAt);
            const importantSenderColor = safeHexColor(alert.senderColor);
            const importantSenderStyle = alert.senderIsImportant
              ? {
                  borderColor: hexToRgba(importantSenderColor, 0.36),
                  backgroundColor: hexToRgba(importantSenderColor, 0.07),
                }
              : undefined;

            return (
              <div key={alert.id} style={importantSenderStyle} className={cn("group flex gap-4 rounded-2xl border p-4 transition-all", tone.card)}>
                <div
                  className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone.iconBg)}
                  style={alert.senderIsImportant ? { backgroundColor: hexToRgba(importantSenderColor, 0.12) } : undefined}
                >
                  <img src="/gmail.png" alt="" className="h-5 w-5 object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start gap-2">
                    <h4 className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold transition-colors", tone.title)} title={title}>
                      {title}
                    </h4>
                    {alert.senderIsImportant && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                        style={{ backgroundColor: importantSenderColor }}
                      >
                        Adserver
                      </span>
                    )}
                    {alert.status === "new" && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", tone.badge)}>Novo</span>}
                  </div>
                  <p className={cn("mt-0.5 truncate text-[11px] font-medium", tone.meta)} title={sender}>
                    {sender}
                  </p>
                  <p className="mt-1 line-clamp-2 break-words text-[11px] leading-relaxed text-[#71717A]">{alert.snippet || target}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="truncate text-[10px] font-semibold text-[#A1A1AA]">{target}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onDismiss(alert)}
                        disabled={dismissingAlertId === alert.id}
                        className="flex items-center gap-1 text-[10px] font-black text-[#A1A1AA] transition-colors hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        Descartar
                      </button>
                      {alert.gmailUrl && (
                        <a
                          href={alert.gmailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-black text-[#355CFF] transition-colors hover:text-[#1D1E2C]"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

export function SmartAlerts() {
  const { isAdmin } = useAuth();
  const { campaigns, canViewOperationalInfo } = useCampaigns();
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);
  const [activeView, setActiveView] = useState<SmartAlertsView>("campaigns");
  const [lastPromotedGmailId, setLastPromotedGmailId] = useState<string | null>(null);
  const [dismissingGmailId, setDismissingGmailId] = useState<string | null>(null);
  const [gmailState, setGmailState] = useState<GmailAlertsState>({
    enabled: false,
    configured: false,
    unreadCount: 0,
    alerts: [],
    available: false,
    isLoading: false,
    lastSyncError: null,
    lastSyncMessage: null,
  });

  const smartAlerts = useMemo(() => {
    const today = new Date();

    return currentCampaigns
      .map((camp) => {
        const intelligence = getCampaignIntelligence(camp, { isAdmin: canViewOperationalInfo, today });
        if (intelligence.status === "on_track") return null;

        const tone = getAlertTone(intelligence.tone);
        return {
          id: `${camp.id}-${intelligence.status}`,
          title: intelligence.label,
          campaign: camp.campaignName,
          message: intelligence.message,
          icon: alertIcons[intelligence.status],
          color: tone.color,
          bg: tone.bg,
          card: tone.card,
          isCritical: intelligence.isCritical,
          priority: intelligence.priorityScore,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0)) as any[];
  }, [canViewOperationalInfo, currentCampaigns]);

  const loadGmailAlerts = useCallback(async () => {
    if (!isAdmin) return;

    setGmailState((current) => ({ ...current, isLoading: current.alerts.length === 0 }));

    try {
      const response = await fetch("/api/admin/gmail/alerts", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setGmailState((current) => ({ ...current, available: false, isLoading: false }));
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha ao carregar Gmail.");

      setGmailState((current) => ({
        enabled: Boolean(data.enabled),
        configured: Boolean(data.configured),
        unreadCount: Number(data.unreadCount || 0),
        alerts: Array.isArray(data.alerts) ? data.alerts : [],
        available: true,
        isLoading: false,
        lastSyncError: null,
        lastSyncMessage: current.lastSyncMessage || null,
      }));
    } catch (error) {
      setGmailState((current) => ({
        ...current,
        isLoading: false,
        lastSyncError: error instanceof Error ? error.message : "Nao foi possivel carregar Gmail.",
      }));
    }
  }, [isAdmin]);

  const runDashboardGmailSync = useCallback(async () => {
    if (!isAdmin) return;
    if (!gmailState.available || !gmailState.enabled || !gmailState.configured) return;

    const now = Date.now();
    const lastSyncAt = Number(window.localStorage.getItem(GMAIL_DASHBOARD_SYNC_STORAGE_KEY) || 0);
    if (Number.isFinite(lastSyncAt) && now - lastSyncAt < GMAIL_DASHBOARD_SYNC_INTERVAL_MS) return;

    window.localStorage.setItem(GMAIL_DASHBOARD_SYNC_STORAGE_KEY, String(now));

    try {
      const response = await fetch("/api/admin/gmail/sync-now", { method: "POST" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        window.localStorage.removeItem(GMAIL_DASHBOARD_SYNC_STORAGE_KEY);
        setGmailState((current) => ({
          ...current,
          lastSyncError: data.error || "Nao foi possivel sincronizar Gmail.",
        }));
        return;
      }

      setGmailState((current) => ({
        ...current,
        lastSyncError: null,
        lastSyncMessage: data.message || "Gmail sincronizado.",
      }));
      await loadGmailAlerts();
    } catch (error) {
      window.localStorage.removeItem(GMAIL_DASHBOARD_SYNC_STORAGE_KEY);
      setGmailState((current) => ({
        ...current,
        lastSyncError: error instanceof Error ? error.message : "Nao foi possivel sincronizar Gmail.",
      }));
    }
  }, [gmailState.available, gmailState.configured, gmailState.enabled, isAdmin, loadGmailAlerts]);

  const dismissGmailAlert = useCallback(
    async (alert: GmailAlert) => {
      if (!alert?.id || dismissingGmailId) return;

      const previousState = gmailState;
      setDismissingGmailId(alert.id);
      setGmailState((current) => ({
        ...current,
        unreadCount: alert.status === "new" ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
        alerts: current.alerts.filter((item) => item.id !== alert.id),
      }));

      try {
        const response = await fetch(`/api/admin/gmail/alerts/${encodeURIComponent(alert.id)}/dismiss`, { method: "POST" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Nao foi possivel descartar o email.");
        await loadGmailAlerts();
      } catch (error) {
        setGmailState({
          ...previousState,
          lastSyncError: error instanceof Error ? error.message : "Nao foi possivel descartar o email.",
        });
      } finally {
        setDismissingGmailId(null);
      }
    },
    [dismissingGmailId, gmailState, loadGmailAlerts]
  );

  useEffect(() => {
    loadGmailAlerts();
    if (!isAdmin) return;

    const intervalId = window.setInterval(loadGmailAlerts, GMAIL_ALERT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isAdmin, loadGmailAlerts]);

  useEffect(() => {
    if (!isAdmin || !gmailState.available || !gmailState.enabled || !gmailState.configured) return;

    runDashboardGmailSync();
    const intervalId = window.setInterval(runDashboardGmailSync, GMAIL_DASHBOARD_SYNC_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [gmailState.available, gmailState.configured, gmailState.enabled, isAdmin, runDashboardGmailSync]);

  const newestUnreadGmailId = gmailState.alerts.find((alert) => alert.status === "new")?.id || null;

  useEffect(() => {
    if (!newestUnreadGmailId || newestUnreadGmailId === lastPromotedGmailId) return;
    setActiveView("gmail");
    setLastPromotedGmailId(newestUnreadGmailId);
  }, [lastPromotedGmailId, newestUnreadGmailId]);

  const showGmail = gmailState.available;
  const displayedView = showGmail ? activeView : "campaigns";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {displayedView === "gmail" ? (
        <GmailAlertsCard
          key="gmail"
          gmailState={gmailState}
          activeView={displayedView}
          campaignCount={smartAlerts.length}
          onViewChange={setActiveView}
          onDismiss={dismissGmailAlert}
          dismissingAlertId={dismissingGmailId}
        />
      ) : (
        <ImportantAlertsCard
          key="campaigns"
          smartAlerts={smartAlerts}
          canViewOperationalInfo={canViewOperationalInfo}
          activeView={displayedView}
          showGmail={showGmail}
          gmailCount={gmailState.unreadCount}
          onViewChange={setActiveView}
        />
      )}
    </AnimatePresence>
  );
}
