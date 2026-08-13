"use client";

import { Fragment, useMemo, useState } from "react";
import { Search, Inbox, Trash2, ExternalLink, FileText, Edit2, X, Building2, UserSquare2, CalendarDays, MonitorPlay, Mail, Link2, Send, Loader2, FileSpreadsheet, Pause, Play, Archive } from "lucide-react";
import { cn } from "../../lib/utils";
import { useCampaigns, type Campaign, type Purchase } from "../../context/CampaignContext";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { AdminLock } from "../auth/AdminLock";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";
import { isLucasAccount } from "../../lib/lucasAccess";
import { calculateTotalImpressions, getCampaignIntelligence, type CampaignIntelligence, type CampaignTone } from "../../lib/campaignHealth";
import { CAMPAIGN_BOOST_STATUS_LABELS, CAMPAIGN_OPERATIONAL_OPTIONS, type CampaignOperationalSelection } from "../../lib/campaignOperationalStatus";

function getSituationStyle(tone: CampaignTone) {
  if (tone === "success") return "bg-emerald-100 text-emerald-700";
  if (tone === "danger") return "bg-red-100 text-red-700";
  if (tone === "warning") return "bg-amber-100 text-amber-700";
  if (tone === "info") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

type SmartDisplayGroup = "immediate" | "watch" | "on_track" | "delivered";
type SmartFilter = "all" | SmartDisplayGroup;

const SMART_GROUP_ORDER: SmartDisplayGroup[] = ["immediate", "watch", "on_track", "delivered"];

const SMART_GROUP_META: Record<SmartDisplayGroup, { title: string }> = {
  immediate: { title: "Acao imediata" },
  watch: { title: "Acompanhar hoje" },
  on_track: { title: "No ritmo" },
  delivered: { title: "Entregue" },
};

const CAMPAIGN_STATUS_EXPORT_LABELS: Record<Campaign["status"], string> = {
  veiculando: "Veiculando",
  pausada: "Pausada",
  finalizada: "Finalizada",
  pendente_material: "Pendente de material",
};

function getCampaignOperationalSelection(campaign: Campaign): CampaignOperationalSelection {
  if (campaign.status === "pausada") return "pausada";
  return campaign.boostStatus || "normal";
}

function getBoostStatusBadgeClass(status = "normal") {
  if (status === "sponsorship") return "border-red-200 bg-red-50 text-red-700";
  if (status === "high") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "low") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-blue-100 bg-blue-50 text-blue-700";
}

function getSmartDisplayGroup(campaign: Campaign, intelligence: CampaignIntelligence): SmartDisplayGroup {
  if (campaign.status === "finalizada" || intelligence.deliveryPct >= 100) return "delivered";
  if (intelligence.priorityLevel === "done") return "delivered";
  if (intelligence.priorityLevel === "immediate_action") return "immediate";
  if (intelligence.priorityLevel === "watch_today" || intelligence.priorityLevel === "adjust_pace") return "watch";
  return "on_track";
}

function getSmartAccent(intelligence: CampaignIntelligence) {
  if (intelligence.priorityLevel === "immediate_action" || intelligence.tone === "danger") {
    return {
      rail: "bg-red-500",
      badge: "bg-red-50 text-red-700 border-red-100",
      text: "text-red-700",
      bar: "bg-red-500",
      row: "hover:bg-red-50/75",
    };
  }

  if (intelligence.priorityLevel === "watch_today" || intelligence.tone === "warning") {
    return {
      rail: "bg-amber-500",
      badge: "bg-amber-50 text-amber-700 border-amber-100",
      text: "text-amber-700",
      bar: "bg-amber-500",
      row: "hover:bg-amber-50/75",
    };
  }

  if (intelligence.priorityLevel === "done" || intelligence.priorityLevel === "almost_done" || intelligence.tone === "success") {
    return {
      rail: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
      text: "text-emerald-700",
      bar: "bg-emerald-500",
      row: "hover:bg-emerald-50/75",
    };
  }

  return {
    rail: "bg-[#355CFF]",
    badge: "bg-[#EBF1FF] text-[#355CFF] border-[#D9E3FF]",
    text: "text-[#355CFF]",
    bar: "bg-[#355CFF]",
    row: "hover:bg-[#EBF1FF]/65",
  };
}

function getFilterLabel(filter: SmartFilter) {
  if (filter === "all") return "Todas";
  return SMART_GROUP_META[filter].title;
}

function getFilterDotClass(filter: SmartFilter) {
  if (filter === "immediate") return "bg-red-500";
  if (filter === "watch") return "bg-amber-500";
  if (filter === "on_track") return "bg-emerald-500";
  if (filter === "delivered") return "bg-slate-400";
  return "bg-[#355CFF]";
}

function formatDate(date?: string) {
  return date ? new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";
}

function formatNumber(value?: number) {
  return (value || 0).toLocaleString("pt-BR");
}

function getRemainingDaysLabel(campaign: Campaign) {
  const end = parseDateOnly(campaign.endDate);
  if (!end) return "prazo sem data";

  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysRemaining = Math.ceil((end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) return "veiculacao encerrada";
  if (daysRemaining === 0) return "encerra hoje";
  if (daysRemaining === 1) return "1 dia restante";
  return `${daysRemaining} dias restantes`;
}

function parseDateOnly(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function isWithinFlightPeriod(campaign: Campaign) {
  const end = parseDateOnly(campaign.endDate);
  if (!end) return true;
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return end.getTime() >= current.getTime();
}

function getDeliveryPct(campaign: Campaign) {
  const total = calculateTotalImpressions(campaign);
  if (total <= 0) return 0;
  return Math.round(((campaign.deliveredImpressions || 0) / total) * 100);
}

function escapeExcelCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? ` ${text}` : text;
  return safeText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isDeliveredPositiveCampaign(campaign: Campaign) {
  return getDeliveryPct(campaign) >= 100;
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

function CampaignDetailModal({
  campaign,
  isAdmin,
  canViewOperationalInfo = isAdmin,
  onClose,
  onEdit,
}: {
  campaign: Campaign;
  isAdmin: boolean;
  canViewOperationalInfo?: boolean;
  onClose: () => void;
  onEdit: () => void;
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
    <div className="fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto bg-[#0F172A]/70 px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-10" onClick={onClose}>
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

        <div className="flex flex-col gap-3 border-t border-[#F1F5F9] bg-[#FBFCFF] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex flex-wrap gap-2">
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
          {isAdmin ? (
            <button type="button" onClick={onEdit} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#355CFF] px-5 text-sm font-black text-white shadow-lg shadow-[#355CFF]/20 transition-colors hover:bg-[#2849D6]">
              <Edit2 className="h-4 w-4" />
              Editar campanha
            </button>
          ) : (
            <AdminLock locked>
              <button type="button" className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#F5F7FB] px-5 text-sm font-black text-[#71717A]">
                <Edit2 className="h-4 w-4" />
                Editar campanha
              </button>
            </AdminLock>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  helper,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "blue" | "purple" | "green" | "amber";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "blue"
      ? "text-[#2F57D6]"
      : tone === "purple"
        ? "text-[#5B50D6]"
        : tone === "green"
          ? "text-emerald-600"
          : tone === "amber"
            ? "text-amber-600"
            : "text-[#1D1E2C]";

  const content = (
    <>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A94A6]">{label}</span>
      <span className={cn("mt-1 block truncate text-[15px] font-semibold tabular-nums", toneClass)}>{value}</span>
      {helper && <span className="mt-0.5 block truncate text-[10px] font-medium text-[#A1A1AA]">{helper}</span>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="min-w-0 py-3 text-left"
      >
        {content}
      </button>
    );
  }

  return <div className="min-w-0 py-3">{content}</div>;
}

export function CampaignTable() {
  const { campaigns, canViewOperationalInfo, deleteCampaign, updateCampaign, updateDeliveredImpressions, updateViewabilityPercentage, refreshCampaigns, isLoading } = useCampaigns();
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportRecipients, setReportRecipients] = useState("");
  const [selectedReportCampaignIds, setSelectedReportCampaignIds] = useState<string[]>([]);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalizeRecipients, setFinalizeRecipients] = useState("lucas.mendonca@metropoles.com");
  const [finalizeSendPreview, setFinalizeSendPreview] = useState(true);
  const [isFinalizingDeliveries, setIsFinalizingDeliveries] = useState(false);
  const [isSendingFinalizeTest, setIsSendingFinalizeTest] = useState(false);
  const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null);
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [statusUpdatingCampaignId, setStatusUpdatingCampaignId] = useState<string | null>(null);
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);
  const canSendDeliveryPreview = isAdmin;
  const canViewActionsColumn = isAdmin || isLucasAccount(user);
  const canFinalizeDeliveries = canViewActionsColumn;
  const tableColumnCount = canViewActionsColumn ? 9 : 8;
  const finalizeCampaignCandidates = currentCampaigns.filter((campaign) => campaign.status !== "finalizada");
  const currentCampaignIds = new Set(currentCampaigns.map((campaign) => campaign.id));
  const reportCampaignCandidates = campaigns.filter((campaign) => {
    const isCurrentCampaign = currentCampaignIds.has(campaign.id) && campaign.status !== "finalizada";
    const isDeliveredWithinPeriod = isDeliveredPositiveCampaign(campaign) && isWithinFlightPeriod(campaign);
    return isCurrentCampaign || isDeliveredWithinPeriod;
  });

  const smartCampaigns = useMemo(() => {
    return currentCampaigns
      .map((campaign) => {
        const intelligence = getCampaignIntelligence(campaign, { isAdmin: canViewOperationalInfo });
        const total = calculateTotalImpressions(campaign);
        const accent = getSmartAccent(intelligence);

        return {
          campaign,
          intelligence,
          total,
          accent,
          group: getSmartDisplayGroup(campaign, intelligence),
        };
      })
      .sort((a, b) => {
        const groupDiff = SMART_GROUP_ORDER.indexOf(a.group) - SMART_GROUP_ORDER.indexOf(b.group);
        if (groupDiff !== 0) return groupDiff;
        return b.intelligence.priorityScore - a.intelligence.priorityScore || (a.campaign.displayOrder ?? 9999) - (b.campaign.displayOrder ?? 9999);
      });
  }, [currentCampaigns, canViewOperationalInfo]);

  const groupCounts = useMemo(() => {
    return smartCampaigns.reduce(
      (acc, item) => {
        acc[item.group] += 1;
        return acc;
      },
      {
        immediate: 0,
        watch: 0,
        on_track: 0,
        delivered: 0,
      } satisfies Record<SmartDisplayGroup, number>
    );
  }, [smartCampaigns]);

  const filterCounts = useMemo(() => {
    return {
      all: smartCampaigns.length,
      immediate: groupCounts.immediate,
      watch: groupCounts.watch,
      on_track: groupCounts.on_track,
      delivered: groupCounts.delivered,
    } satisfies Record<SmartFilter, number>;
  }, [groupCounts, smartCampaigns]);

  const overviewItems = [
    { label: "campanhas", value: filterCounts.all, dot: "bg-[#355CFF]" },
    { label: "acao imediata", value: filterCounts.immediate, dot: "bg-red-500" },
    { label: "acompanhar", value: filterCounts.watch, dot: "bg-amber-500" },
    { label: "no ritmo", value: filterCounts.on_track, dot: "bg-emerald-500" },
    { label: "entregues", value: filterCounts.delivered, dot: "bg-slate-400" },
  ];

  const filteredSmartCampaigns = smartCampaigns.filter(({ campaign, group }) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      campaign.campaignName.toLowerCase().includes(query) ||
      (campaign.piNumber || "").toLowerCase().includes(query) ||
      (campaign.client || "").toLowerCase().includes(query);
    const matchesFilter = smartFilter === "all" || group === smartFilter;

    return matchesSearch && matchesFilter;
  });

  const exportCampaignsToExcel = () => {
    const headers = [
      "PI",
      "Campanha",
      "Cliente",
      "Agencia",
      "Status",
      "Inicio",
      "Fim",
      "Contratado",
      "Entregue",
      "Restante",
      "Entrega %",
      "VA %",
    ];

    const bodyRows = filteredSmartCampaigns.map(({ campaign, intelligence, total }) => {
      const delivered = campaign.deliveredImpressions || 0;
      const remaining = Math.max(total - delivered, 0);

      return [
        campaign.piNumber || "-",
        campaign.campaignName || "-",
        campaign.client || "-",
        campaign.agency || "-",
        CAMPAIGN_STATUS_EXPORT_LABELS[campaign.status],
        formatDate(campaign.startDate),
        formatDate(campaign.endDate),
        total,
        delivered,
        remaining,
        `${intelligence.deliveryPct}%`,
        `${campaign.viewabilityPercentage || 0}%`,
      ];
    });

    const tableHead = headers.map((header) => `<th>${escapeExcelCell(header)}</th>`).join("");
    const tableBody = bodyRows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeExcelCell(cell)}</td>`).join("")}</tr>`)
      .join("");
    const generatedAt = new Date().toLocaleString("pt-BR");
    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
            th { background: #0f172a; color: #ffffff; font-weight: 700; }
            th, td { border: 1px solid #d9e2f1; padding: 8px 10px; mso-number-format: "\\@"; }
            .meta { margin-bottom: 12px; font-family: Arial, sans-serif; color: #475569; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="meta">Minhas Campanhas - gerado em ${escapeExcelCell(generatedAt)}</div>
          <table>
            <thead><tr>${tableHead}</tr></thead>
            <tbody>${tableBody}</tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `minhas-campanhas-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const sendDeliveryPreviewReport = async () => {
    const recipients = reportRecipients
      .split(/[,\n;]/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      setReportMessage("Informe pelo menos um destinatario.");
      return;
    }

    if (selectedReportCampaignIds.length === 0) {
      setReportMessage("Selecione pelo menos uma campanha.");
      return;
    }

    setIsSendingReport(true);
    setReportMessage(null);

    try {
      const response = await fetch("/api/admin/delivery-preview-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, campaignIds: selectedReportCampaignIds }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Falha ao enviar relatorio.");
      }

      setReportMessage(`Relatorio enviado para ${recipients.length} destinatario(s) com ${selectedReportCampaignIds.length} campanha(s).`);
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : "Falha ao enviar relatorio.");
    } finally {
      setIsSendingReport(false);
    }
  };

  const openFinalizeDeliveriesModal = () => {
    setIsFinalizeModalOpen(true);
    setFinalizeMessage(null);
    setFinalizeSendPreview(true);
    setFinalizeRecipients((current) => current || "lucas.mendonca@metropoles.com");
  };

  const finalizeDeliveries = async () => {
    const campaignIds = finalizeCampaignCandidates.map((campaign) => campaign.id);
    const recipients = finalizeRecipients
      .split(/[,\n;]/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (campaignIds.length === 0) {
      setFinalizeMessage("Nenhuma campanha disponivel para finalizar.");
      return;
    }

    if (finalizeSendPreview && recipients.length === 0) {
      setFinalizeMessage("Informe pelo menos um destinatario ou desative o envio do preview.");
      return;
    }

    const confirmed = window.confirm(
      `Finalizar ${campaignIds.length} campanha(s) e enviar para o historico${finalizeSendPreview ? " com email preview" : " sem email preview"}?`
    );
    if (!confirmed) return;

    setIsFinalizingDeliveries(true);
    setFinalizeMessage(null);

    try {
      const response = await fetch("/api/admin/finalize-deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignIds,
          sendPreview: finalizeSendPreview,
          recipients,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Falha ao finalizar entregas.");
      }

      await refreshCampaigns();
      const emailText = finalizeSendPreview
        ? ` Preview enviado para ${recipients.length} destinatario(s).`
        : " Preview nao enviado.";
      setFinalizeMessage(`${data.finalized || campaignIds.length} campanha(s) finalizada(s).${emailText}`);
    } catch (error) {
      setFinalizeMessage(error instanceof Error ? error.message : "Falha ao finalizar entregas.");
    } finally {
      setIsFinalizingDeliveries(false);
    }
  };

  const sendFinalizePreviewTest = async () => {
    const campaignIds = finalizeCampaignCandidates.map((campaign) => campaign.id);
    const recipients = finalizeRecipients
      .split(/[,\n;]/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (campaignIds.length === 0) {
      setFinalizeMessage("Nenhuma campanha disponivel para testar o envio.");
      return;
    }

    if (recipients.length === 0) {
      setFinalizeMessage("Informe pelo menos um destinatario para o teste.");
      return;
    }

    setIsSendingFinalizeTest(true);
    setFinalizeMessage(null);

    try {
      const response = await fetch("/api/admin/delivery-preview-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignIds,
          recipients,
          testMode: true,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Falha ao enviar email de teste.");
      }

      setFinalizeMessage(`Email de teste enviado para ${recipients.length} destinatario(s). Nenhuma campanha foi finalizada.`);
    } catch (error) {
      setFinalizeMessage(error instanceof Error ? error.message : "Falha ao enviar email de teste.");
    } finally {
      setIsSendingFinalizeTest(false);
    }
  };

  const toggleCampaignPause = async (campaign: Campaign) => {
    if (!isAdmin || campaign.status === "finalizada") return;
    const nextStatus = campaign.status === "pausada" ? "veiculando" : "pausada";
    const actionLabel = nextStatus === "pausada" ? "Pausar" : "Retomar";
    const confirmed = window.confirm(`${actionLabel} a campanha "${campaign.campaignName}"?`);
    if (!confirmed) return;

    setStatusUpdatingCampaignId(campaign.id);
    try {
      await updateCampaign(campaign.id, { status: nextStatus, boostStatus: "normal" });
    } finally {
      setStatusUpdatingCampaignId(null);
    }
  };

  const updateCampaignOperationalSelection = async (campaign: Campaign, selection: CampaignOperationalSelection) => {
    if (!isAdmin || campaign.status === "finalizada") return;

    if (selection === "pausada") {
      await updateCampaign(campaign.id, { status: "pausada", boostStatus: "normal" });
      return;
    }

    await updateCampaign(campaign.id, {
      status: campaign.status === "pausada" ? "veiculando" : campaign.status,
      boostStatus: selection,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-[22px] 2xl:rounded-[32px] border border-[#E9EDF5] p-10 2xl:p-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#355CFF]"></div>
      </div>
    );
  }

  return (
    <div id="campaign-table" className="bg-white rounded-[20px] 2xl:rounded-[32px] border border-[#E9EDF5] shadow-sm overflow-hidden flex flex-col">
      <div className="md:hidden">
        <div className="border-b border-[#E9EDF5] bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-[#1D1E2C]">Minhas Campanhas</h3>
              <p className="mt-1 text-xs font-medium text-[#8A94A6]">
                {filteredSmartCampaigns.length} de {smartCampaigns.length} campanha(s)
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={exportCampaignsToExcel}
                disabled={filteredSmartCampaigns.length === 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE7DF] text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Baixar planilha Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </button>
              {canFinalizeDeliveries && (
                <button
                  type="button"
                  onClick={openFinalizeDeliveriesModal}
                  disabled={finalizeCampaignCandidates.length === 0}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Finalizar entregas"
                >
                  <Archive className="h-4 w-4" />
                </button>
              )}
              {canSendDeliveryPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setIsReportModalOpen(true);
                    setReportMessage(null);
                    setSelectedReportCampaignIds(reportCampaignCandidates.map((campaign) => campaign.id));
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D9E3FF] bg-[#F8FAFF] text-[#355CFF] transition-colors hover:bg-[#EBF1FF]"
                  title="Enviar Relatorio Preview das Entregas"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
            <input
              type="text"
              placeholder="Buscar por campanha, PI ou cliente"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 w-full rounded-2xl border border-[#E2E8F3] bg-[#F8FAFC] py-2 pl-10 pr-4 text-sm text-[#1D1E2C] outline-none transition-all placeholder:text-[#A1A1AA] focus:border-[#D9E3FF] focus:bg-white focus:ring-2 focus:ring-[#355CFF]/10"
            />
          </div>

          <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {(["all", "immediate", "watch", "on_track", "delivered"] as SmartFilter[]).map((filter) => {
              const active = smartFilter === filter;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSmartFilter(filter)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors",
                    active
                      ? "border-[#D9E3FF] bg-[#F6F9FF] text-[#1D1E2C]"
                      : "border-[#E9EDF5] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", getFilterDotClass(filter))} />
                  {getFilterLabel(filter)}
                  <span className="tabular-nums text-[#8A94A6]">{filterCounts[filter]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#F8FAFC] px-3 py-3">
          {filteredSmartCampaigns.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D8E0EC] bg-white px-6 text-center text-[#A1A1AA]">
              <Inbox className="h-10 w-10 opacity-25" />
              <p className="mt-4 text-sm font-semibold text-[#71717A]">Nenhuma campanha encontrada</p>
              <p className="mt-1 text-xs">Ajuste a busca ou o filtro aplicado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSmartCampaigns.map((item, index) => {
                const { campaign: camp, intelligence, total, accent } = item;
                const remainingImpressions = Math.max(total - (camp.deliveredImpressions || 0), 0);
                const deliveryProgress = Math.min(intelligence.deliveryPct, 100);
                const latestMetricSnapshot = camp.metricHistory?.[0];
                const deliveredDelta = Math.max(Number(latestMetricSnapshot?.deliveredDelta || 0), 0);
                const showGroupHeader = index === 0 || filteredSmartCampaigns[index - 1]?.group !== item.group;
                const groupMeta = SMART_GROUP_META[item.group];

                const editDelivered = () => {
                  if (!isAdmin) return;
                  const newValueStr = window.prompt("Atualizar Impressoes Entregues:", camp.deliveredImpressions?.toString() || "0");
                  if (newValueStr !== null && newValueStr.trim() !== "") {
                    const newValue = parseInt(newValueStr.replace(/\./g, ""), 10);
                    if (!isNaN(newValue)) updateDeliveredImpressions(camp.id, newValue);
                  }
                };

                const editViewability = () => {
                  if (!isAdmin) return;
                  const newValueStr = window.prompt("Atualizar % de VA (ex: 75.5):", camp.viewabilityPercentage?.toString() || "0");
                  if (newValueStr !== null && newValueStr.trim() !== "") {
                    const newValue = parseFloat(newValueStr.replace(",", "."));
                    if (!isNaN(newValue)) updateViewabilityPercentage(camp.id, newValue);
                  }
                };

                return (
                  <Fragment key={camp.id}>
                    {showGroupHeader && (
                      <div className="px-1 pt-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", accent.rail)} />
                            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{groupMeta.title}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold text-[#A1A1AA]">{groupCounts[item.group]}</span>
                        </div>
                      </div>
                    )}

                    <article
                      onClick={() => setSelectedCampaign(camp)}
                      className="overflow-hidden rounded-2xl border border-[#E9EDF5] bg-white shadow-sm active:bg-[#FBFCFF]"
                    >
                      <div className={cn("h-1 w-full", accent.rail)} />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-[#F1F5F9] px-2 py-1 font-mono text-[10px] font-semibold text-[#64748B]">
                                PI {camp.piNumber || "-"}
                              </span>
                              <span className={cn("rounded-lg border px-2 py-1 text-[10px] font-semibold", accent.badge)}>
                                {intelligence.label}
                              </span>
                              {canViewActionsColumn && camp.status === "pausada" && (
                                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                  pausada
                                </span>
                              )}
                              {canViewActionsColumn && camp.status !== "pausada" && camp.boostStatus && camp.boostStatus !== "normal" && (
                                <span className={cn("rounded-lg border px-2 py-1 text-[10px] font-semibold", getBoostStatusBadgeClass(camp.boostStatus))}>
                                  {CAMPAIGN_BOOST_STATUS_LABELS[camp.boostStatus]}
                                </span>
                              )}
                            </div>
                            <h4 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-[#1D1E2C]">{camp.campaignName}</h4>
                            <p className="mt-1 truncate text-xs font-medium text-[#71717A]">{camp.client || "Cliente nao informado"}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-semibold text-[#64748B]">
                            {getRemainingDaysLabel(camp)}
                          </span>
                        </div>

                        <div className="mt-4">
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                            <span className={cn("font-semibold tabular-nums", accent.text)}>{intelligence.deliveryPct}% entregue</span>
                            <span className="font-medium text-[#8A94A6]">{formatDate(camp.startDate)} a {formatDate(camp.endDate)}</span>
                          </div>
                          <div className="campaign-progress-track relative h-2 overflow-hidden rounded-full bg-[#E9EDF5]">
                            <div className={cn("campaign-progress-fill relative h-full overflow-hidden rounded-full", accent.bar)} style={{ width: `${deliveryProgress}%` }}>
                              <span className="campaign-progress-glint" />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-x-4 border-y border-[#EEF2F8]">
                          <MobileMetric label="Contratado" value={total.toLocaleString("pt-BR")} />
                          <MobileMetric
                            label="Entregue"
                            value={formatNumber(camp.deliveredImpressions)}
                            helper={deliveredDelta > 0 ? `+${deliveredDelta.toLocaleString("pt-BR")} ult. atualizacao` : undefined}
                            tone="blue"
                            onClick={isAdmin ? editDelivered : undefined}
                          />
                          <MobileMetric
                            label="Restante"
                            value={remainingImpressions.toLocaleString("pt-BR")}
                            tone={remainingImpressions === 0 ? "green" : "default"}
                          />
                          <MobileMetric
                            label="VA"
                            value={`${camp.viewabilityPercentage || 0}%`}
                            tone="purple"
                            onClick={isAdmin ? editViewability : undefined}
                          />
                        </div>

                        {canViewActionsColumn && (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" onClick={(event) => event.stopPropagation()}>
                            {isAdmin && (
                              <select
                                value={getCampaignOperationalSelection(camp)}
                                onChange={(event) => updateCampaignOperationalSelection(camp, event.target.value as CampaignOperationalSelection)}
                                disabled={camp.status === "finalizada"}
                                className="h-9 min-w-[150px] shrink-0 rounded-full border border-[#D9E3FF] bg-[#F8FAFF] px-3 text-[11px] font-semibold text-[#1D1E2C] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                title="Estado operacional"
                              >
                                {CAMPAIGN_OPERATIONAL_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {camp.hasGamLink &&
                              (canViewOperationalInfo ? (
                                <a href={camp.gamLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#E9EDF5] bg-white px-3 text-[11px] font-semibold text-[#1D1E2C]">
                                  <img src="/GAM.png" alt="Google Ad Manager" className="h-4 w-4 object-contain" />
                                  GAM
                                </a>
                              ) : (
                                <AdminLock locked>
                                  <button type="button" className="inline-flex h-9 shrink-0 cursor-not-allowed items-center gap-2 rounded-full border border-[#E9EDF5] bg-white px-3 text-[11px] font-semibold text-[#71717A]">
                                    <img src="/GAM.png" alt="Google Ad Manager" className="h-4 w-4 object-contain" />
                                    GAM
                                  </button>
                                </AdminLock>
                              ))}
                            {camp.pdfUrl && (
                              <a href={camp.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#E9EDF5] bg-white px-3 text-[11px] font-semibold text-[#6D5BD0]">
                                <FileText className="h-4 w-4" />
                                PI
                              </a>
                            )}
                            {camp.gmailLink && (
                              <a href={camp.gmailLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#E9EDF5] bg-white px-3 text-[11px] font-semibold text-[#1D1E2C]">
                                <img src="/gmail.png" alt="Fluxo Gmail" className="h-4 w-4 object-contain" />
                                Gmail
                              </a>
                            )}
                            {camp.dashLink && (
                              <a href={camp.dashLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#D9E3FF] bg-[#F8FAFF] px-3 text-[11px] font-semibold text-[#355CFF]">
                                <ExternalLink className="h-4 w-4" />
                                Dashboard
                              </a>
                            )}
                            {isAdmin && camp.status !== "finalizada" && (
                              <button
                                type="button"
                                onClick={() => toggleCampaignPause(camp)}
                                disabled={statusUpdatingCampaignId === camp.id}
                                className={cn(
                                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-70",
                                  camp.status === "pausada"
                                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                    : "border-amber-100 bg-amber-50 text-amber-700"
                                )}
                              >
                                {statusUpdatingCampaignId === camp.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : camp.status === "pausada" ? (
                                  <Play className="h-4 w-4" />
                                ) : (
                                  <Pause className="h-4 w-4" />
                                )}
                                {camp.status === "pausada" ? "Retomar" : "Pausar"}
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => router.push(`/campaigns/edit/${camp.id}`)}
                                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#D9E3FF] bg-white px-3 text-[11px] font-semibold text-[#355CFF]"
                                >
                                  <Edit2 className="h-4 w-4" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("Deseja realmente excluir esta campanha?")) deleteCampaign(camp.id);
                                  }}
                                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-red-100 bg-white px-3 text-[11px] font-semibold text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[#E9EDF5] bg-white px-4 py-3">
          <p className="text-xs font-medium text-[#A1A1AA]">
            Filtro: {getFilterLabel(smartFilter)}
          </p>
        </div>
      </div>

      <div className="hidden bg-white px-4 py-4 md:block 2xl:px-8 2xl:py-7">
        <div className="flex min-w-0 flex-col items-start justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight text-[#1D1E2C]">Minhas Campanhas</h3>
          <p className="mt-1 text-xs font-medium text-[#8A94A6]">Gestao de veiculacoes cadastradas</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-[#64748B]">
            {overviewItems.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} />
                <span className="tabular-nums text-[#1D1E2C]">{item.value}</span>
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
          <button
            type="button"
            onClick={exportCampaignsToExcel}
            disabled={filteredSmartCampaigns.length === 0}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#DCE7DF] bg-white px-3.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Baixar planilha Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
          {canSendDeliveryPreview && (
            <button
              type="button"
              onClick={() => {
                setIsReportModalOpen(true);
                setReportMessage(null);
                setSelectedReportCampaignIds(reportCampaignCandidates.map((campaign) => campaign.id));
              }}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D9E3FF] bg-[#F8FAFF] px-3.5 text-xs font-semibold text-[#355CFF] transition-colors hover:bg-[#EBF1FF]"
              title="Enviar Relatorio Preview das Entregas"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar relatorio
            </button>
          )}
          {canFinalizeDeliveries && (
            <button
              type="button"
              onClick={openFinalizeDeliveriesModal}
              disabled={finalizeCampaignCandidates.length === 0}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Finalizar entregas e enviar para o historico"
            >
              <Archive className="h-3.5 w-3.5" />
              Finalizar entregas
            </button>
          )}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA] transition-colors group-hover:text-[#355CFF]" />
            <input
              type="text"
              placeholder="Buscar campanha..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-9 w-full rounded-xl border border-transparent bg-[#F5F7FB] py-2 pl-10 pr-4 text-sm text-[#1D1E2C] outline-none transition-all placeholder:text-[#A1A1AA] focus:border-[#D9E3FF] focus:bg-white focus:ring-2 focus:ring-[#355CFF]/10 sm:w-[210px] 2xl:w-[240px]"
            />
          </div>
        </div>
        </div>
        <div className="mt-4 flex overflow-x-auto rounded-2xl border border-[#E9EDF5] bg-[#F8FAFC] p-1">
          {(["all", "immediate", "watch", "on_track", "delivered"] as SmartFilter[]).map((filter) => {
            const active = smartFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setSmartFilter(filter)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors",
                  active
                    ? "border-[#E9EDF5] bg-white text-[#1D1E2C] shadow-sm"
                    : "border-transparent text-[#64748B] hover:bg-white hover:text-[#1D1E2C]"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", getFilterDotClass(filter))} />
                {getFilterLabel(filter)}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] tabular-nums", active ? "bg-[#F1F5F9] text-[#475569]" : "bg-white/70 text-[#8A94A6]")}>
                  {filterCounts[filter]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden overflow-x-auto -mx-0 md:block">
        <table className={cn("w-full table-fixed text-left border-collapse", canViewActionsColumn ? "min-w-[1240px] 2xl:min-w-[1380px]" : "min-w-[960px] 2xl:min-w-[1100px]")}>
          <colgroup>
            <col className="w-[72px] 2xl:w-[84px]" />
            <col className="w-[280px] 2xl:w-[340px]" />
            <col className="w-[132px] 2xl:w-[166px]" />
            <col className="w-[140px] 2xl:w-[160px]" />
            <col className="w-[108px] 2xl:w-[124px]" />
            <col className="w-[108px] 2xl:w-[124px]" />
            <col className="w-[108px] 2xl:w-[132px]" />
            <col className="w-[72px] 2xl:w-[92px]" />
            {canViewActionsColumn && <col className="w-[228px]" />}
          </colgroup>
          <thead>
            <tr className="bg-[#F8FAFC]/50 border-y border-[#E9EDF5]">
              <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] 2xl:px-8">PI</th>
              <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] 2xl:px-6">Campanha</th>
              <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] 2xl:px-6">Cliente</th>
              <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] 2xl:px-6">Progresso</th>
              <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] text-right 2xl:px-6">Contratado</th>
              <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] text-right 2xl:px-6">Entregue</th>
              <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] text-right 2xl:px-6">Restante</th>
              <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] text-right 2xl:px-6">VA %</th>
              {canViewActionsColumn && (
                <th className="px-4 py-3.5 text-[11px] font-semibold text-[#8A94A6] uppercase tracking-[0.08em] text-right 2xl:px-8">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {filteredSmartCampaigns.length === 0 ? (
              <tr>
                <td colSpan={tableColumnCount} className="px-4 py-20 text-center 2xl:px-8">
                  <div className="flex flex-col items-center gap-4 text-[#A1A1AA]">
                    <Inbox className="w-12 h-12 opacity-20" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#71717A]">Nenhuma campanha cadastrada</p>
                      <p className="text-xs">As campanhas que você criar aparecerão aqui.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSmartCampaigns.map((item, index) => {
                const { campaign: camp, intelligence, total, accent } = item;
                const remainingImpressions = Math.max(total - (camp.deliveredImpressions || 0), 0);
                const deliveryProgress = Math.min(intelligence.deliveryPct, 100);
                const latestMetricSnapshot = camp.metricHistory?.[0];
                const deliveredDelta = Math.max(Number(latestMetricSnapshot?.deliveredDelta || 0), 0);
                const showGroupHeader = index === 0 || filteredSmartCampaigns[index - 1]?.group !== item.group;
                const groupMeta = SMART_GROUP_META[item.group];

                return (
                <Fragment key={camp.id}>
                {showGroupHeader && (
                  <tr key={`${item.group}-header`} className="bg-[#FBFCFF]">
                    <td colSpan={tableColumnCount} className="border-y border-[#E9EDF5] px-4 py-3 2xl:px-8">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", accent.rail)} />
                          <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.08em] text-[#1D1E2C]">{groupMeta.title}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A94A6]">
                          {groupCounts[item.group]} campanha(s)
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  key={camp.id}
                  onClick={() => setSelectedCampaign(camp)}
                  className={cn("transition-colors group cursor-pointer text-sm font-medium", accent.row)}
                >
                  <td className="px-4 py-4 text-[#71717A] font-mono text-xs 2xl:px-8">{camp.piNumber || "-"}</td>
                  <td className="px-4 py-4 text-[#1D1E2C] transition-colors font-semibold 2xl:px-6">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="block min-w-0 truncate transition-colors group-hover:text-[#355CFF]" title={camp.campaignName}>
                        {camp.campaignName}
                      </span>
                      {canViewActionsColumn && camp.status === "pausada" && (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-amber-700">
                          pausada
                        </span>
                      )}
                      {canViewActionsColumn && camp.status !== "pausada" && camp.boostStatus && camp.boostStatus !== "normal" && (
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]", getBoostStatusBadgeClass(camp.boostStatus))}>
                          {CAMPAIGN_BOOST_STATUS_LABELS[camp.boostStatus]}
                        </span>
                      )}
                      <span
                        className="shrink-0 whitespace-nowrap text-[10px] font-medium text-[#8A94A6]"
                        title={`Veiculacao: ${formatDate(camp.startDate)} a ${formatDate(camp.endDate)}`}
                      >
                        {getRemainingDaysLabel(camp)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#71717A] 2xl:px-6">
                    <span className="block truncate" title={camp.client}>{camp.client}</span>
                  </td>
                  <td className="px-4 py-4 text-xs 2xl:px-6">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className={cn("font-semibold tabular-nums", accent.text)}>{intelligence.deliveryPct}%</span>
                        <span className="shrink-0 font-medium text-[#8A94A6]">entregue</span>
                      </div>
                      <div className="campaign-progress-track relative h-1.5 overflow-hidden rounded-full bg-[#E9EDF5]">
                        <div className={cn("campaign-progress-fill relative h-full overflow-hidden rounded-full", accent.bar)} style={{ width: `${deliveryProgress}%` }}>
                          <span className="campaign-progress-glint" />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right 2xl:px-6">
                    <span className="font-semibold tabular-nums text-[#1D1E2C]">{total.toLocaleString("pt-BR")}</span>
                  </td>
                  <td className="px-4 py-4 text-right 2xl:px-6">
                    {isAdmin ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newValueStr = window.prompt("Atualizar Impressões Entregues:", camp.deliveredImpressions?.toString() || "0");
                          if (newValueStr !== null && newValueStr.trim() !== "") {
                             const newValue = parseInt(newValueStr.replace(/\./g, ''), 10);
                             if (!isNaN(newValue)) {
                               updateDeliveredImpressions(camp.id, newValue);
                             }
                          }
                        }}
                        className="group/edit inline-flex items-center justify-end gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums text-[#2F57D6] transition-colors hover:bg-[#EBF1FF]"
                        title="Clique para editar"
                      >
                        <span>{camp.deliveredImpressions?.toLocaleString('pt-BR') || "0"}</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="inline-flex justify-end rounded-lg px-2 py-1 text-sm font-semibold tabular-nums text-[#2F57D6]">
                        {camp.deliveredImpressions?.toLocaleString('pt-BR') || "0"}
                      </span>
                    )}
                    {deliveredDelta > 0 && (
                      <span className="mt-0.5 block text-[10px] font-semibold tabular-nums text-emerald-600">
                        +{deliveredDelta.toLocaleString("pt-BR")} ult. atualizacao
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right 2xl:px-6">
                    <span className={cn("font-semibold tabular-nums", remainingImpressions === 0 ? "text-emerald-600" : "text-[#1D1E2C]")}>
                      {remainingImpressions.toLocaleString("pt-BR")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right 2xl:px-6">
                    {isAdmin ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newValueStr = window.prompt("Atualizar % de VA (ex: 75.5):", camp.viewabilityPercentage?.toString() || "0");
                          if (newValueStr !== null && newValueStr.trim() !== "") {
                             const newValue = parseFloat(newValueStr.replace(',', '.'));
                             if (!isNaN(newValue)) {
                               updateViewabilityPercentage(camp.id, newValue);
                             }
                          }
                        }}
                        className="group/edit inline-flex items-center justify-end gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums text-[#5B50D6] transition-colors hover:bg-[#EEF2FF]"
                        title="Clique para editar"
                      >
                        <span>{camp.viewabilityPercentage || "0"}%</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="inline-flex justify-end rounded-lg px-2 py-1 text-sm font-semibold tabular-nums text-[#5B50D6]">
                        {camp.viewabilityPercentage || "0"}%
                      </span>
                    )}
                  </td>
                  {canViewActionsColumn && (
                    <td className="px-4 py-3 2xl:px-8">
                      <div className="ml-auto flex max-w-[220px] flex-wrap items-center justify-end gap-1.5 2xl:max-w-none">
                         {isAdmin && (
                           <select
                             value={getCampaignOperationalSelection(camp)}
                             onChange={(event) => {
                               event.stopPropagation();
                               updateCampaignOperationalSelection(camp, event.target.value as CampaignOperationalSelection);
                             }}
                             onClick={(event) => event.stopPropagation()}
                             disabled={camp.status === "finalizada"}
                             className="h-8 w-[148px] rounded-xl border border-[#D9E3FF] bg-[#F8FAFF] px-2 text-[10px] font-semibold text-[#1D1E2C] outline-none transition-colors hover:bg-[#EBF1FF] disabled:cursor-not-allowed disabled:opacity-60"
                             title="Estado operacional"
                           >
                             {CAMPAIGN_OPERATIONAL_OPTIONS.map((option) => (
                               <option key={option.value} value={option.value}>
                                 {option.label}
                               </option>
                             ))}
                           </select>
                         )}
                         {camp.hasGamLink && (
                           canViewOperationalInfo ? (
                             <a 
                               href={camp.gamLink} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               title="Google Ad Manager"
                                className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-gray-100/80"
                               onClick={(e) => e.stopPropagation()}
                             >
                                <img src="/GAM.png" alt="Google Ad Manager" className="block h-5 w-5 min-h-5 min-w-5 max-h-6 max-w-6 object-contain" />
                             </a>
                           ) : (
                             <AdminLock locked>
                               <button
                                 type="button"
                                 onClick={(e) => e.stopPropagation()}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors cursor-not-allowed"
                               >
                                  <img src="/GAM.png" alt="Google Ad Manager" className="block h-5 w-5 min-h-5 min-w-5 max-h-6 max-w-6 object-contain" />
                               </button>
                             </AdminLock>
                           )
                         )}
                         {camp.pdfUrl && (
                           <a 
                             href={camp.pdfUrl} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             title="Visualizar PI"
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8B5CF6] transition-colors hover:bg-[#8B5CF6]/10"
                             onClick={(e) => e.stopPropagation()}
                           >
                              <FileText className="w-4 h-4" />
                           </a>
                         )}
                         {camp.gmailLink && (
                           <a 
                             href={camp.gmailLink} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             title="Fluxo (Gmail)"
                              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-gray-100/80"
                             onClick={(e) => e.stopPropagation()}
                           >
                              <img src="/gmail.png" alt="Fluxo Gmail" className="block h-5 w-5 min-h-5 min-w-5 max-h-6 max-w-6 object-contain" />
                           </a>
                         )}
                         {camp.dashLink && (
                           <a 
                             href={camp.dashLink} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             title="Relatório Principal"
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#355CFF] transition-colors hover:bg-[#355CFF]/10"
                             onClick={(e) => e.stopPropagation()}
                           >
                              <ExternalLink className="w-4 h-4" />
                           </a>
                         )}
                         {isAdmin && camp.status !== "finalizada" && (
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               toggleCampaignPause(camp);
                             }}
                             disabled={statusUpdatingCampaignId === camp.id}
                             title={camp.status === "pausada" ? "Retomar campanha" : "Pausar campanha"}
                             className={cn(
                               "flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                               camp.status === "pausada"
                                 ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                 : "text-amber-600 hover:bg-amber-50"
                             )}
                           >
                             {statusUpdatingCampaignId === camp.id ? (
                               <Loader2 className="h-4 w-4 animate-spin" />
                             ) : camp.status === "pausada" ? (
                               <Play className="h-4 w-4" />
                             ) : (
                               <Pause className="h-4 w-4" />
                             )}
                           </button>
                         )}
                         {isAdmin ? (
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               router.push(`/campaigns/edit/${camp.id}`);
                             }}
                             title="Editar"
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#355CFF] transition-colors hover:bg-[#355CFF]/10"
                           >
                              <Edit2 className="w-4 h-4" />
                           </button>
                         ) : (
                           <AdminLock locked>
                              <button type="button" onClick={(e) => e.stopPropagation()} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#355CFF] transition-colors cursor-not-allowed">
                                <Edit2 className="w-4 h-4" />
                             </button>
                           </AdminLock>
                         )}
                         {isAdmin ? (
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               if(confirm("Deseja realmente excluir esta campanha?")) deleteCampaign(camp.id);
                             }}
                             title="Excluir"
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#EF4444]/60 transition-colors hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                         ) : (
                           <AdminLock locked>
                              <button type="button" onClick={(e) => e.stopPropagation()} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#EF4444]/60 transition-colors cursor-not-allowed">
                                <Trash2 className="w-4 h-4" />
                             </button>
                           </AdminLock>
                         )}
                      </div>
                    </td>
                  )}
                </tr>
                </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="hidden p-4 2xl:p-6 md:flex items-center justify-between border-t border-[#E9EDF5]">
        <p className="text-xs text-[#A1A1AA] font-medium">
          {filteredSmartCampaigns.length} campanha(s) exibida(s) · filtro: {getFilterLabel(smartFilter)}
        </p>
      </div>

      {selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          isAdmin={isAdmin}
          canViewOperationalInfo={canViewOperationalInfo}
          onClose={() => setSelectedCampaign(null)}
          onEdit={() => router.push(`/campaigns/edit/${selectedCampaign.id}`)}
        />
      )}

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[270] flex items-center justify-center bg-[#0F172A]/70 px-4 py-6 backdrop-blur-sm" onClick={() => !isSendingReport && setIsReportModalOpen(false)}>
          <div className="w-full max-w-[720px] overflow-hidden rounded-[22px] border border-[#E9EDF5] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[#F1F5F9] p-5">
              <div>
                <h3 className="text-lg font-black text-[#1D1E2C]">Relatorio Preview das Entregas</h3>
                <p className="mt-1 text-sm font-medium leading-5 text-[#71717A]">Envio com metricas de ritmo, VA, melhores desempenhos e campanhas em acompanhamento.</p>
              </div>
              <button
                type="button"
                onClick={() => !isSendingReport && setIsReportModalOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#A1A1AA] transition-colors hover:bg-[#F5F7FB] hover:text-[#1D1E2C]"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A1A1AA]">Destinatarios</span>
                <textarea
                  value={reportRecipients}
                  onChange={(event) => setReportRecipients(event.target.value)}
                  placeholder="email@exemplo.com, outro@exemplo.com"
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-[#E2E8F3] bg-[#FBFCFF] px-4 py-3 text-sm font-semibold text-[#1D1E2C] outline-none transition-all placeholder:text-[#A1A1AA] focus:border-[#355CFF] focus:ring-4 focus:ring-[#355CFF]/10"
                />
              </label>

              <div className="rounded-2xl border border-[#E9EDF5] bg-[#F8FAFC] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#1D1E2C]">Campanhas no relatorio</p>
                    <p className="mt-1 text-xs font-bold text-[#A1A1AA]">{selectedReportCampaignIds.length} de {reportCampaignCandidates.length} selecionada(s)</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedReportCampaignIds(reportCampaignCandidates.map((campaign) => campaign.id))}
                      className="h-9 rounded-xl bg-white px-3 text-xs font-black text-[#355CFF] transition-colors hover:bg-[#EBF1FF]"
                    >
                      Selecionar todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedReportCampaignIds([])}
                      className="h-9 rounded-xl bg-white px-3 text-xs font-black text-[#71717A] transition-colors hover:bg-[#F1F5F9]"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {reportCampaignCandidates.length === 0 ? (
                    <p className="rounded-2xl bg-white px-4 py-4 text-sm font-bold text-[#A1A1AA]">Nenhuma campanha elegivel agora.</p>
                  ) : (
                    reportCampaignCandidates.map((campaign) => {
                      const checked = selectedReportCampaignIds.includes(campaign.id);
                      const total = calculateTotalImpressions(campaign);
                      const deliveryPct = getDeliveryPct(campaign);

                      return (
                        <label
                          key={campaign.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-3 transition-colors",
                            checked ? "border-[#D9E3FF] bg-[#F6F9FF]" : "border-[#EEF2F8] hover:border-[#D9E3FF]"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedReportCampaignIds((previous) =>
                                event.target.checked
                                  ? Array.from(new Set([...previous, campaign.id]))
                                  : previous.filter((id) => id !== campaign.id)
                              );
                            }}
                            className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#355CFF]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-[#1D1E2C]" title={campaign.campaignName}>{campaign.campaignName}</span>
                            <span className="mt-1 block truncate text-xs font-bold text-[#A1A1AA]" title={campaign.client}>
                              PI {campaign.piNumber || "-"} · {campaign.client || "Cliente nao informado"}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className={cn("block text-xs font-black", deliveryPct >= 100 ? "text-emerald-600" : "text-[#355CFF]")}>{deliveryPct}%</span>
                            <span className="mt-1 block text-[10px] font-bold text-[#A1A1AA]">{total.toLocaleString("pt-BR")}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {reportMessage && (
                <p className="rounded-2xl bg-[#F6F9FF] px-4 py-3 text-sm font-bold text-[#355CFF]">{reportMessage}</p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#F1F5F9] bg-[#FBFCFF] p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                disabled={isSendingReport}
                className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-black text-[#71717A] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendDeliveryPreviewReport}
                disabled={isSendingReport || selectedReportCampaignIds.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#355CFF] px-5 text-sm font-black text-white shadow-lg shadow-[#355CFF]/20 transition-colors hover:bg-[#2849D6] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSendingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar agora
              </button>
            </div>
          </div>
        </div>
      )}

      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-[275] flex items-center justify-center bg-[#0F172A]/70 px-4 py-6 backdrop-blur-sm" onClick={() => !isFinalizingDeliveries && !isSendingFinalizeTest && setIsFinalizeModalOpen(false)}>
          <div className="w-full max-w-[620px] overflow-hidden rounded-[22px] border border-[#E9EDF5] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[#F1F5F9] p-5">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                  <Archive className="h-3.5 w-3.5" />
                  Finalizar entregas
                </div>
                <h3 className="text-lg font-black text-[#1D1E2C]">{finalizeCampaignCandidates.length} campanha(s) para historico</h3>
                <p className="mt-1 text-sm font-medium leading-5 text-[#71717A]">As campanhas atuais serao marcadas como finalizadas.</p>
              </div>
              <button
                type="button"
                onClick={() => !isFinalizingDeliveries && !isSendingFinalizeTest && setIsFinalizeModalOpen(false)}
                disabled={isFinalizingDeliveries || isSendingFinalizeTest}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#A1A1AA] transition-colors hover:bg-[#F5F7FB] hover:text-[#1D1E2C] disabled:cursor-not-allowed disabled:opacity-60"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-[#E9EDF5] bg-[#F8FAFC] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A1A1AA]">Resumo</p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xl font-black text-[#1D1E2C]">{finalizeCampaignCandidates.length}</p>
                    <p className="text-[11px] font-bold text-[#8A94A6]">campanhas</p>
                  </div>
                  <div>
                    <p className="text-xl font-black text-emerald-600">{groupCounts.delivered}</p>
                    <p className="text-[11px] font-bold text-[#8A94A6]">entregues</p>
                  </div>
                  <div>
                    <p className="text-xl font-black text-[#355CFF]">{filterCounts.all}</p>
                    <p className="text-[11px] font-bold text-[#8A94A6]">no card</p>
                  </div>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E9EDF5] bg-white p-4">
                <input
                  type="checkbox"
                  checked={finalizeSendPreview}
                  onChange={(event) => setFinalizeSendPreview(event.target.checked)}
                  disabled={isFinalizingDeliveries || isSendingFinalizeTest}
                  className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#355CFF]"
                />
                <span>
                  <span className="block text-sm font-black text-[#1D1E2C]">Enviar Relatorio Preview das Entregas</span>
                  <span className="mt-1 block text-xs font-semibold text-[#8A94A6]">O email usa todas as campanhas finalizadas nesta acao.</span>
                </span>
              </label>

              {finalizeSendPreview && (
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A1A1AA]">Destinatarios</span>
                  <textarea
                    value={finalizeRecipients}
                    onChange={(event) => setFinalizeRecipients(event.target.value)}
                    disabled={isFinalizingDeliveries || isSendingFinalizeTest}
                    placeholder="email@exemplo.com, outro@exemplo.com"
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-[#E2E8F3] bg-[#FBFCFF] px-4 py-3 text-sm font-semibold text-[#1D1E2C] outline-none transition-all placeholder:text-[#A1A1AA] focus:border-[#355CFF] focus:ring-4 focus:ring-[#355CFF]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              )}

              {finalizeMessage && (
                <p className="rounded-2xl bg-[#F6F9FF] px-4 py-3 text-sm font-bold text-[#355CFF]">{finalizeMessage}</p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#F1F5F9] bg-[#FBFCFF] p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(false)}
                disabled={isFinalizingDeliveries || isSendingFinalizeTest}
                className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-black text-[#71717A] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendFinalizePreviewTest}
                disabled={isFinalizingDeliveries || isSendingFinalizeTest || finalizeCampaignCandidates.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9E3FF] bg-white px-5 text-sm font-black text-[#355CFF] transition-colors hover:bg-[#F6F9FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingFinalizeTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar teste
              </button>
              <button
                type="button"
                onClick={finalizeDeliveries}
                disabled={isFinalizingDeliveries || isSendingFinalizeTest || finalizeCampaignCandidates.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1D1E2C] px-5 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition-colors hover:bg-[#2C2E3F] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isFinalizingDeliveries ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Finalizar entregas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
