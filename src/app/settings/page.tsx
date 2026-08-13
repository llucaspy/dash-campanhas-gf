"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AtSign, Bell, CheckCircle2, Copy, Database, ExternalLink, Inbox, KeyRound, Mail, RefreshCw, Save, Search, Send, Shield, Sparkles, ToggleLeft, ToggleRight, Trash2, UserPlus } from "lucide-react";

import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { useCampaigns } from "../../context/CampaignContext";
import type { UserRole } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

interface ManagedUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  active: boolean;
}

interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "important";
  active: boolean;
  created_at: string;
  campaign_id?: string | null;
  campaign_pi?: string | null;
  campaign_name?: string | null;
  campaign_dashboard_url?: string | null;
  campaign_gam_link?: string | null;
  boost_status: BoostStatus;
}

interface AdminObservation {
  id: string;
  subject: string;
  body: string;
  status: "open" | "reviewed" | "resolved";
  created_at: string;
  user_name: string;
  user_email: string;
  attachments: { id: string; fileName: string; fileSize: number; contentType: string }[];
}

interface DbUsage {
  databaseBytes: number;
  limitBytes: number | null;
  usagePercent: number | null;
  status: "monitoring" | "healthy" | "warning" | "critical";
  attachmentBytes: number;
  counts: {
    campaigns: number;
    users: number;
    announcements: number;
    observations: number;
  };
  tables: { tableName: string; totalBytes: number }[];
}

interface SponsorshipEmailAlerts {
  enabled: boolean;
  recipients: string[];
}

type GmailAlertVisibility = "lucas_only" | "admin";

interface GmailIntelligenceSettings {
  enabled: boolean;
  monitoredMailbox: string;
  monitoredTargets: string[];
  strongKeywords: string[];
  ignoredSenders: string[];
  importantSenders: string[];
  importantSenderColor: string;
  googleCloudProjectId: string;
  pubsubTopic: string;
  pubsubSubscription: string;
  alertVisibility: GmailAlertVisibility;
  webhookUrl: string;
  credentialsConfigured: {
    clientId: boolean;
    clientSecret: boolean;
    refreshTokenLucas: boolean;
    webhookSecret: boolean;
  };
}

interface GmailDraftSecrets {
  clientId: string;
  clientSecret: string;
  refreshTokenLucas: string;
  webhookSecret: string;
  monitoredTargets: string;
  strongKeywords: string;
  ignoredSenders: string;
  importantSenders: string;
}

const emptyForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "USER" as UserRole,
  active: true,
};

const defaultGmailIntelligenceSettings: GmailIntelligenceSettings = {
  enabled: false,
  monitoredMailbox: "lucas.mendonca@metropoles.com",
  monitoredTargets: ["lucas.mendonca@metropoles.com", "opec.gov@metropoles.com", "Lucas", "OPEC"],
  strongKeywords: [
    "PI",
    "campanha",
    "veiculacao",
    "entrega",
    "patrocinio",
    "sponsorship",
    "aprovacao",
    "urgente",
    "erro",
    "prazo",
    "Tags",
    "Tag",
    "metrike",
    "brasil adserver",
    "adforce",
    "adserver",
    "Governo Federal",
    "programar",
    "banner",
    "subir",
    "verification",
    "abatimento",
    "BS",
    "viewability",
    "VA",
    "brand safety",
  ],
  ignoredSenders: ["noreply", "no-reply", "newsletter"],
  importantSenders: [
    "checking@metrike.com",
    "operacional@aheadserver.com.br",
    "suporte@adxspace.com.br",
    "suporte@brasiladserver.com",
    "joao@adforce.com.br",
    "suporte@vetta.net.br",
    "suporte@adserverstart.com",
  ],
  importantSenderColor: "#2563EB",
  googleCloudProjectId: "",
  pubsubTopic: "",
  pubsubSubscription: "",
  alertVisibility: "lucas_only",
  webhookUrl: "https://dashboardgf-llucaspaim.vercel.app/api/integrations/gmail/pubsub",
  credentialsConfigured: {
    clientId: false,
    clientSecret: false,
    refreshTokenLucas: false,
    webhookSecret: false,
  },
};

function listToDraft(value: string[]) {
  return value.join("\n");
}

function safeHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#2563EB";
}

type BoostStatus = "sponsorship" | "high" | "normal" | "low";
type UserInformationLevel = "light" | "adops";

const boostLabels: Record<BoostStatus, string> = {
  sponsorship: "Patrocínio",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#F1F5F9] bg-[#FBFCFF] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A1A1AA]">{label}</p>
      <p className="mt-2 truncate text-sm font-black text-[#1D1E2C]">{value}</p>
    </div>
  );
}

function SecretStatus({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#EEF2F8] bg-[#FBFCFF] px-3 py-2">
      <span className="truncate text-[11px] font-black uppercase tracking-[0.10em] text-[#71717A]">{label}</span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        {configured ? "Configurado" : "Pendente"}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { campaigns } = useCampaigns();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingAllAccess, setIsSendingAllAccess] = useState(false);
  const [sendingAccessUserId, setSendingAccessUserId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [observations, setObservations] = useState<AdminObservation[]>([]);
  const [dbUsage, setDbUsage] = useState<DbUsage | null>(null);
  const [communicationsEnabled, setCommunicationsEnabled] = useState(true);
  const [userInformationLevel, setUserInformationLevel] = useState<UserInformationLevel>("light");
  const [sponsorshipEmailAlerts, setSponsorshipEmailAlerts] = useState<SponsorshipEmailAlerts>({
    enabled: false,
    recipients: ["lucas.mendonca@metropoles.com"],
  });
  const [sponsorshipEmailDraft, setSponsorshipEmailDraft] = useState("lucas.mendonca@metropoles.com");
  const [isSendingSponsorshipAlert, setIsSendingSponsorshipAlert] = useState(false);
  const [canManageGmailIntelligence, setCanManageGmailIntelligence] = useState(false);
  const [gmailIntelligence, setGmailIntelligence] = useState<GmailIntelligenceSettings>(defaultGmailIntelligenceSettings);
  const [gmailDrafts, setGmailDrafts] = useState<GmailDraftSecrets>({
    clientId: "",
    clientSecret: "",
    refreshTokenLucas: "",
    webhookSecret: "",
    monitoredTargets: listToDraft(defaultGmailIntelligenceSettings.monitoredTargets),
    strongKeywords: listToDraft(defaultGmailIntelligenceSettings.strongKeywords),
    ignoredSenders: listToDraft(defaultGmailIntelligenceSettings.ignoredSenders),
    importantSenders: listToDraft(defaultGmailIntelligenceSettings.importantSenders),
  });
  const [isSavingGmailIntelligence, setIsSavingGmailIntelligence] = useState(false);
  const [isTestingGmailIntelligence, setIsTestingGmailIntelligence] = useState(false);
  const [isSyncingGmailIntelligence, setIsSyncingGmailIntelligence] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    body: "",
    priority: "normal" as "normal" | "important",
    active: true,
    campaignId: "",
    boostStatus: "normal" as BoostStatus,
  });
  const [campaignQuery, setCampaignQuery] = useState("");

  const campaignSuggestions = campaignQuery.trim()
    ? campaigns
        .filter((campaign) => {
          const query = campaignQuery.toLowerCase();
          return campaign.campaignName.toLowerCase().includes(query) || (campaign.piNumber || "").toLowerCase().includes(query);
        })
        .slice(0, 6)
    : [];

  const selectedCampaign = campaigns.find((campaign) => campaign.id === announcementForm.campaignId);

  const loadUsers = async () => {
    setIsLoading(true);
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await response.json();
    setUsers(data.users || []);
    setIsLoading(false);
  };

  const loadCommunications = async () => {
    const response = await fetch("/api/admin/communications", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setAnnouncements(data.announcements || []);
    setObservations(data.observations || []);
    setCommunicationsEnabled(data.communicationsEnabled ?? true);
    setUserInformationLevel(data.userInformationLevel === "adops" ? "adops" : "light");
    if (data.sponsorshipEmailAlerts) {
      const recipients = Array.isArray(data.sponsorshipEmailAlerts.recipients)
        ? data.sponsorshipEmailAlerts.recipients
        : ["lucas.mendonca@metropoles.com"];
      setSponsorshipEmailAlerts({
        enabled: Boolean(data.sponsorshipEmailAlerts.enabled),
        recipients,
      });
      setSponsorshipEmailDraft(recipients.join(", "));
    }
  };

  const loadAdminSettings = async () => {
    const response = await fetch("/api/admin/settings", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();

    setCommunicationsEnabled(data.communicationsEnabled ?? true);
    setUserInformationLevel(data.userInformationLevel === "adops" ? "adops" : "light");
    if (data.sponsorshipEmailAlerts) {
      const recipients = Array.isArray(data.sponsorshipEmailAlerts.recipients)
        ? data.sponsorshipEmailAlerts.recipients
        : ["lucas.mendonca@metropoles.com"];
      setSponsorshipEmailAlerts({
        enabled: Boolean(data.sponsorshipEmailAlerts.enabled),
        recipients,
      });
      setSponsorshipEmailDraft(recipients.join(", "));
    }
    setCanManageGmailIntelligence(Boolean(data.canManageGmailIntelligence));
    if (data.gmailIntelligence) {
      const nextGmail = {
        ...defaultGmailIntelligenceSettings,
        ...data.gmailIntelligence,
        credentialsConfigured: {
          ...defaultGmailIntelligenceSettings.credentialsConfigured,
          ...(data.gmailIntelligence.credentialsConfigured || {}),
        },
      };
      setGmailIntelligence(nextGmail);
      setGmailDrafts({
        clientId: "",
        clientSecret: "",
        refreshTokenLucas: "",
        webhookSecret: "",
        monitoredTargets: listToDraft(nextGmail.monitoredTargets),
        strongKeywords: listToDraft(nextGmail.strongKeywords),
        ignoredSenders: listToDraft(nextGmail.ignoredSenders),
        importantSenders: listToDraft(nextGmail.importantSenders),
      });
    }
  };

  const loadDbUsage = async () => {
    const response = await fetch("/api/admin/system/db-usage", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setDbUsage(data);
  };

  useEffect(() => {
    loadUsers();
    loadCommunications();
    loadAdminSettings();
    loadDbUsage();
  }, []);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Falha ao criar usuário.");
      return;
    }
    setForm(emptyForm);
    setMessage("Usuário criado com sucesso.");
    loadUsers();
  };

  const updateUser = async (id: string, updates: Partial<ManagedUser> & { password?: string }) => {
    setMessage("");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Falha ao atualizar usuário.");
      return;
    }
    setMessage("Usuário atualizado.");
    loadUsers();
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Remover este usuário?")) return;
    const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Falha ao remover usuário.");
      return;
    }
    setMessage("Usuário removido.");
    loadUsers();
  };

  const sendAccessEmails = async (userId?: string) => {
    const isBulk = !userId;
    if (isBulk && !confirm("Enviar usuário e nova senha temporária para todos os membros ativos com email válido?")) return;

    setMessage("");
    if (isBulk) setIsSendingAllAccess(true);
    else setSendingAccessUserId(userId);

    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId } : { all: true }),
      });
      const data = await response.json().catch(() => ({}));
      const failedDetails = Array.isArray(data.results)
        ? data.results
            .filter((result: { ok?: boolean }) => !result.ok)
            .slice(0, 3)
            .map((result: { name?: string; error?: string }) => `${result.name || "Usuário"}: ${result.error || "falha no envio"}`)
            .join(" | ")
        : "";

      if (!response.ok) {
        setMessage(data.error || failedDetails || "Falha ao enviar acessos.");
        return;
      }

      const sent = Number(data.sent || 0);
      const failed = Number(data.failed || 0);
      setMessage(
        failed > 0
          ? `Acessos enviados para ${sent} usuário(s). ${failed} envio(s) falharam. ${failedDetails}`
          : userId
            ? "Email de acesso enviado para o usuário selecionado."
            : `Acessos enviados para ${sent} usuário(s).`
      );
      loadUsers();
    } finally {
      setIsSendingAllAccess(false);
      setSendingAccessUserId(null);
    }
  };

  const createAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(announcementForm),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Falha ao criar comunicado.");
      return;
    }
    setAnnouncementForm({ title: "", body: "", priority: "normal", active: true, campaignId: "", boostStatus: "normal" });
    setCampaignQuery("");
    setMessage("Comunicado publicado.");
    loadCommunications();
  };

  const updateAnnouncement = async (id: string, updates: Partial<AdminAnnouncement>) => {
    await fetch(`/api/admin/communications/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    loadCommunications();
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("Remover este comunicado?")) return;
    await fetch(`/api/admin/communications/announcements/${id}`, { method: "DELETE" });
    loadCommunications();
  };

  const toggleCommunications = async () => {
    const nextValue = !communicationsEnabled;
    setCommunicationsEnabled(nextValue);
    setMessage("");

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communicationsEnabled: nextValue }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setCommunicationsEnabled(!nextValue);
      setMessage(data.error || "Falha ao atualizar comunicados.");
      return;
    }

    setMessage(nextValue ? "Comunicados visiveis para todos." : "Comunicados ocultos para todos.");
  };

  const updateUserInformationLevel = async (level: UserInformationLevel) => {
    setUserInformationLevel(level);
    setMessage("");

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userInformationLevel: level }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error || "Falha ao atualizar nível de informação.");
      loadCommunications();
      return;
    }

    setUserInformationLevel(data.userInformationLevel === "adops" ? "adops" : "light");
    setMessage(level === "adops" ? "Usuários em modo AdOps." : "Usuários em modo leve.");
  };

  const saveSponsorshipEmailAlerts = async (enabled = sponsorshipEmailAlerts.enabled) => {
    setMessage("");
    const recipients = sponsorshipEmailDraft
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);

    const previous = sponsorshipEmailAlerts;
    setSponsorshipEmailAlerts({ enabled, recipients });

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorshipEmailAlerts: { enabled, recipients } }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setSponsorshipEmailAlerts(previous);
      setMessage(data.error || "Falha ao atualizar alerta de email.");
      return;
    }

    setSponsorshipEmailAlerts(data.sponsorshipEmailAlerts);
    setSponsorshipEmailDraft(data.sponsorshipEmailAlerts.recipients.join(", "));
    setMessage(enabled ? "Alerta operacional por email ativado." : "Alerta operacional por email pausado.");
  };

  const sendManualSponsorshipAlert = async () => {
    const recipients = sponsorshipEmailDraft
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      setMessage("Informe pelo menos um email para enviar o alerta operacional.");
      return;
    }

    setIsSendingSponsorshipAlert(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/sponsorship-alerts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Falha ao enviar alerta operacional.");
      }

      if (data.skipped) {
        setMessage(data.reason || "Nenhuma campanha elegivel para o alerta operacional.");
        return;
      }

      setMessage(`Alerta operacional enviado para ${data.sent || recipients.length} destinatario(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao enviar alerta operacional.");
    } finally {
      setIsSendingSponsorshipAlert(false);
    }
  };

  const saveGmailIntelligenceSettings = async () => {
    setIsSavingGmailIntelligence(true);
    setMessage("");

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gmailIntelligence: {
          enabled: gmailIntelligence.enabled,
          monitoredMailbox: gmailIntelligence.monitoredMailbox,
          monitoredTargets: gmailDrafts.monitoredTargets,
          strongKeywords: gmailDrafts.strongKeywords,
          ignoredSenders: gmailDrafts.ignoredSenders,
          importantSenders: gmailDrafts.importantSenders,
          importantSenderColor: gmailIntelligence.importantSenderColor,
          googleCloudProjectId: gmailIntelligence.googleCloudProjectId,
          pubsubTopic: gmailIntelligence.pubsubTopic,
          pubsubSubscription: gmailIntelligence.pubsubSubscription,
          alertVisibility: gmailIntelligence.alertVisibility,
          clientId: gmailDrafts.clientId,
          clientSecret: gmailDrafts.clientSecret,
          refreshTokenLucas: gmailDrafts.refreshTokenLucas,
          webhookSecret: gmailDrafts.webhookSecret,
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    setIsSavingGmailIntelligence(false);

    if (!response.ok) {
      setMessage(data.error || "Falha ao salvar Gmail Inteligente.");
      return;
    }

    const nextGmail = {
      ...defaultGmailIntelligenceSettings,
      ...data.gmailIntelligence,
      credentialsConfigured: {
        ...defaultGmailIntelligenceSettings.credentialsConfigured,
        ...(data.gmailIntelligence?.credentialsConfigured || {}),
      },
    };
    setGmailIntelligence(nextGmail);
    setGmailDrafts({
      clientId: "",
      clientSecret: "",
      refreshTokenLucas: "",
      webhookSecret: "",
      monitoredTargets: listToDraft(nextGmail.monitoredTargets),
      strongKeywords: listToDraft(nextGmail.strongKeywords),
      ignoredSenders: listToDraft(nextGmail.ignoredSenders),
      importantSenders: listToDraft(nextGmail.importantSenders),
    });
    setMessage("Gmail Inteligente salvo. Segredos sensiveis permanecem mascarados.");
  };

  const testGmailIntelligenceSettings = async () => {
    setIsTestingGmailIntelligence(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/gmail/test-config", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha ao validar Gmail Inteligente.");
      setMessage(data.message || "Validacao concluida.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao validar Gmail Inteligente.");
    } finally {
      setIsTestingGmailIntelligence(false);
    }
  };

  const copyGmailWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(gmailIntelligence.webhookUrl);
      setMessage("URL do webhook copiada.");
    } catch {
      setMessage("Não foi possível copiar a URL automaticamente.");
    }
  };

  const syncGmailIntelligenceNow = async () => {
    setIsSyncingGmailIntelligence(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/gmail/sync-now", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha ao sincronizar Gmail.");
      setMessage(data.message || "Gmail sincronizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar Gmail.");
    } finally {
      setIsSyncingGmailIntelligence(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC]">
      <Sidebar />
      <main className="relative w-full max-w-full flex-1 overflow-x-hidden bg-[#F8FAFC] xl:ml-[232px] 2xl:ml-[260px]">
        <Topbar />

        <div className="w-full min-w-0 space-y-5 p-3 sm:p-4 xl:p-5 2xl:space-y-6 2xl:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">Configurações</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#1D1E2C]">Gerenciamento de usuários</h1>
            <p className="mt-1 text-sm font-medium text-[#71717A]">
              Controle acesso, permissões e status dos membros da equipe.
            </p>
          </div>

          {message && (
            <div className="rounded-2xl border border-[#DCE6FF] bg-white px-4 py-3 text-sm font-semibold text-[#355CFF] shadow-sm">
              {message}
            </div>
          )}

          <div className="flex flex-wrap gap-2 rounded-[22px] border border-[#E9EDF5] bg-white p-2 shadow-sm">
            {[
              { href: "#banco-de-dados", label: "Banco" },
              { href: "#usuarios", label: "Usuários" },
              { href: "#comunicacoes", label: "Comunicações" },
              ...(canManageGmailIntelligence ? [{ href: "#gmail-inteligente", label: "Gmail Inteligente" }] : []),
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-2xl px-4 py-2 text-xs font-black text-[#71717A] transition-colors hover:bg-[#F6F9FF] hover:text-[#355CFF]"
              >
                {item.label}
              </a>
            ))}
          </div>

          <section id="banco-de-dados" className="grid scroll-mt-24 grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-[#E9EDF5] bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#1D1E2C]">Banco de dados</h2>
                    <p className="mt-1 text-xs font-medium text-[#A1A1AA]">
                      Monitoramento interno de volume, anexos e tabelas principais.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#F1F5F9] bg-[#FBFCFF] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A1A1AA]">Status</p>
                  <p className={`mt-1 text-sm font-black ${
                    dbUsage?.status === "critical"
                      ? "text-red-600"
                      : dbUsage?.status === "warning"
                        ? "text-amber-600"
                        : "text-emerald-600"
                  }`}>
                    {dbUsage?.status === "critical"
                      ? "Uso crítico"
                      : dbUsage?.status === "warning"
                        ? "Acompanhar crescimento"
                        : dbUsage?.status === "healthy"
                          ? "Espaço saudável"
                          : "Monitorando uso real"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Metric label="Uso atual" value={dbUsage ? formatBytes(dbUsage.databaseBytes) : "..."} />
                <Metric label="Anexos" value={dbUsage ? formatBytes(dbUsage.attachmentBytes) : "..."} />
                <Metric label="Campanhas" value={dbUsage?.counts?.campaigns ?? 0} />
                <Metric label="Usuários" value={dbUsage?.counts?.users ?? 0} />
                <Metric label="Solicitações" value={dbUsage?.counts?.observations ?? observations.length} />
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#71717A]">
                  <span>{dbUsage?.limitBytes ? "Limite configurado" : "Limite do plano não configurado no app"}</span>
                  <span>{dbUsage?.usagePercent !== null && dbUsage?.usagePercent !== undefined ? `${dbUsage.usagePercent}%` : "sem percentual"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#EEF2F8]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      dbUsage?.status === "critical"
                        ? "bg-red-500"
                        : dbUsage?.status === "warning"
                          ? "bg-amber-500"
                          : "bg-[#355CFF]"
                    }`}
                    style={{ width: `${dbUsage?.usagePercent ?? 12}%` }}
                  />
                </div>
                {!dbUsage?.limitBytes && (
                  <p className="mt-2 text-xs font-medium text-[#A1A1AA]">
                    Para alerta percentual real, configure DATABASE_SIZE_LIMIT_BYTES com o limite do seu plano.
                  </p>
                )}
              </div>

              {dbUsage?.tables?.length ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {dbUsage.tables.slice(0, 4).map((table) => (
                    <div key={table.tableName} className="rounded-2xl border border-[#F1F5F9] bg-[#FBFCFF] px-4 py-3">
                      <p className="truncate text-xs font-black text-[#1D1E2C]">{table.tableName.replace("public.", "")}</p>
                      <p className="mt-1 text-xs font-semibold text-[#A1A1AA]">{formatBytes(table.totalBytes)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              className="rounded-[24px] border border-[#E9EDF5] bg-white p-6 shadow-sm"
            >
              <div className="flex h-full flex-col justify-between gap-5">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-sm font-black text-[#1D1E2C]">Solicitações da equipe</h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#A1A1AA]">
                    A caixa de entrada agora fica em uma página dedicada, limpa e apenas para visualização.
                  </p>
                </div>
                <Link
                  href="/requests"
                  className="flex h-11 items-center justify-center rounded-2xl bg-[#355CFF] text-sm font-bold text-white shadow-[0_12px_28px_rgba(53,92,255,0.18)] transition-colors hover:bg-[#2F52E8]"
                >
                  Abrir solicitacoes
                </Link>
              </div>
            </motion.div>
          </section>

          <div id="usuarios" className="grid scroll-mt-24 grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            <motion.form
              onSubmit={createUser}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-[#E9EDF5] bg-white p-6 shadow-sm"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#1D1E2C]">Novo usuário</h2>
                  <p className="text-xs font-medium text-[#A1A1AA]">Crie acessos internos com role definida.</p>
                </div>
              </div>

              <div className="space-y-4">
                <input className="h-12 w-full rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="h-12 w-full rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10" placeholder="Usuário" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                <input className="h-12 w-full rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10" placeholder="Email opcional" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className="h-12 w-full rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10" placeholder="Senha inicial" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <select className="h-12 rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                    <option value="USER">Equipe</option>
                    <option value="ADMIN">Lucas</option>
                  </select>
                  <label className="flex h-12 items-center gap-2 rounded-2xl border border-[#E5EAF4] px-4 text-sm font-semibold text-[#525866]">
                    <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                    Ativo
                  </label>
                </div>
              </div>

              <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#355CFF] text-sm font-bold text-white shadow-[0_12px_28px_rgba(53,92,255,0.20)] transition-colors hover:bg-[#2F52E8]">
                <UserPlus className="h-4 w-4" />
                Criar usuário
              </button>
            </motion.form>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-[24px] border border-[#E9EDF5] bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-[#F1F5F9] p-6">
                <div>
                  <h2 className="text-sm font-black text-[#1D1E2C]">Usuários cadastrados</h2>
                  <p className="text-xs font-medium text-[#A1A1AA]">{users.length} acesso(s) no sistema</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sendAccessEmails()}
                    disabled={isSendingAllAccess}
                    className="flex h-10 items-center gap-2 rounded-2xl border border-[#DCE6FF] bg-[#F6F9FF] px-4 text-xs font-black text-[#355CFF] transition-colors hover:bg-[#EBF1FF] disabled:cursor-wait disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {isSendingAllAccess ? "Enviando..." : "Enviar acessos"}
                  </button>
                  <Shield className="h-5 w-5 text-[#355CFF]" />
                </div>
              </div>

              <div className="divide-y divide-[#F1F5F9]">
                {isLoading ? (
                  <div className="p-8 text-sm font-semibold text-[#A1A1AA]">Carregando usuários...</div>
                ) : (
                  users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onUpdate={updateUser}
                      onDelete={deleteUser}
                      onInvite={sendAccessEmails}
                      isInviting={sendingAccessUserId === user.id}
                    />
                  ))
                )}
              </div>
            </motion.div>
          </div>

          <section id="comunicacoes" className="grid scroll-mt-24 grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-[#E9EDF5] bg-white p-5 shadow-sm xl:col-span-2"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#1D1E2C]">Modulo de comunicacoes</h2>
                    <p className="text-xs font-medium text-[#A1A1AA]">
                      Mostra ou oculta os cards de comunicados e observacoes no dashboard de todos.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:items-end">
                  <button
                    type="button"
                    onClick={toggleCommunications}
                    className={`flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition-all ${
                      communicationsEnabled
                        ? "bg-[#355CFF] text-white shadow-[0_12px_28px_rgba(53,92,255,0.18)] hover:bg-[#2F52E8]"
                        : "border border-[#E5EAF4] bg-[#F8FAFC] text-[#71717A] hover:bg-white"
                    }`}
                  >
                    {communicationsEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    {communicationsEnabled ? "Visivel para todos" : "Oculto para todos"}
                  </button>

                  <div className="flex rounded-2xl border border-[#E5EAF4] bg-[#F8FAFC] p-1">
                    <button
                      type="button"
                      onClick={() => updateUserInformationLevel("light")}
                      className={`h-9 rounded-xl px-4 text-xs font-black transition-all ${
                        userInformationLevel === "light" ? "bg-white text-[#355CFF] shadow-sm" : "text-[#71717A] hover:text-[#1D1E2C]"
                      }`}
                    >
                      Nivel leve
                    </button>
                    <button
                      type="button"
                      onClick={() => updateUserInformationLevel("adops")}
                      className={`h-9 rounded-xl px-4 text-xs font-black transition-all ${
                        userInformationLevel === "adops" ? "bg-white text-[#355CFF] shadow-sm" : "text-[#71717A] hover:text-[#1D1E2C]"
                      }`}
                    >
                      Nivel AdOps
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-[#E9EDF5] bg-white p-5 shadow-sm xl:col-span-2"
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_420px] lg:items-center">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#1D1E2C]">Alerta de Sponsorship</h2>
                    <p className="mt-1 text-xs font-medium leading-5 text-[#A1A1AA]">
                      Envia alertas operacionais para campanhas em Sponsorship, Pausada ou com métricas que exigem verificação. O disparo automático só acontece quando estiver ativado aqui.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <textarea
                    className="min-h-[76px] w-full resize-none rounded-2xl border border-[#E5EAF4] p-3 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                    value={sponsorshipEmailDraft}
                    onChange={(e) => setSponsorshipEmailDraft(e.target.value)}
                    placeholder="email@dominio.com, outro@dominio.com"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={sendManualSponsorshipAlert}
                      disabled={isSendingSponsorshipAlert}
                      className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-xs font-black text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {isSendingSponsorshipAlert ? "Enviando..." : "Enviar agora"}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveSponsorshipEmailAlerts(sponsorshipEmailAlerts.enabled)}
                      className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#DCE6FF] bg-[#F6F9FF] px-4 text-xs font-black text-[#355CFF] transition-colors hover:bg-[#EBF1FF]"
                    >
                      <Save className="h-4 w-4" />
                      Salvar emails
                    </button>
                    <button
                      type="button"
                      onClick={() => saveSponsorshipEmailAlerts(!sponsorshipEmailAlerts.enabled)}
                      className={`flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-black transition-all ${
                        sponsorshipEmailAlerts.enabled
                          ? "bg-[#355CFF] text-white shadow-[0_12px_28px_rgba(53,92,255,0.18)] hover:bg-[#2F52E8]"
                          : "border border-[#E5EAF4] bg-[#F8FAFC] text-[#71717A] hover:bg-white"
                      }`}
                    >
                      {sponsorshipEmailAlerts.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                      {sponsorshipEmailAlerts.enabled ? "Disparo ativo" : "Disparo pausado"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {canManageGmailIntelligence && (
              <motion.div
                id="gmail-inteligente"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="scroll-mt-24 rounded-[24px] border border-[#DCE6FF] bg-white p-5 shadow-sm xl:col-span-2"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-[#1D1E2C]">Gmail Inteligente</h2>
                      <p className="mt-1 max-w-3xl text-xs font-medium leading-5 text-[#A1A1AA]">
                        Monitoramento da caixa Lucas com alvos OPEC. Quando ativo, o Dash sincroniza sozinho a cada 5 minutos enquanto estiver aberto.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGmailIntelligence((current) => ({ ...current, enabled: !current.enabled }))}
                    className={`flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition-all ${
                      gmailIntelligence.enabled
                        ? "bg-[#355CFF] text-white shadow-[0_12px_28px_rgba(53,92,255,0.18)] hover:bg-[#2F52E8]"
                        : "border border-[#E5EAF4] bg-[#F8FAFC] text-[#71717A] hover:bg-white"
                    }`}
                  >
                    {gmailIntelligence.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    {gmailIntelligence.enabled ? "Monitoramento ativo" : "Monitoramento pausado"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.10em] text-[#71717A]">Caixa monitorada</span>
                        <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5EAF4] bg-white px-4 focus-within:border-[#355CFF]/60 focus-within:ring-4 focus-within:ring-[#355CFF]/10">
                          <AtSign className="h-4 w-4 text-[#A1A1AA]" />
                          <input
                            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                            value={gmailIntelligence.monitoredMailbox}
                            onChange={(e) => setGmailIntelligence((current) => ({ ...current, monitoredMailbox: e.target.value }))}
                          />
                        </div>
                      </label>

                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.10em] text-[#71717A]">Visibilidade</span>
                        <select
                          className="h-12 w-full rounded-2xl border border-[#E5EAF4] bg-white px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                          value={gmailIntelligence.alertVisibility}
                          onChange={(e) => setGmailIntelligence((current) => ({ ...current, alertVisibility: e.target.value as GmailAlertVisibility }))}
                        >
                          <option value="lucas_only">Somente Lucas</option>
                          <option value="admin">Lucas e administradores</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.10em] text-[#71717A]">Alvos monitorados</span>
                        <textarea
                          className="min-h-[126px] w-full resize-none rounded-2xl border border-[#E5EAF4] p-3 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                          value={gmailDrafts.monitoredTargets}
                          onChange={(e) => setGmailDrafts((current) => ({ ...current, monitoredTargets: e.target.value }))}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.10em] text-[#71717A]">Palavras fortes</span>
                        <textarea
                          className="min-h-[126px] w-full resize-none rounded-2xl border border-[#E5EAF4] p-3 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                          value={gmailDrafts.strongKeywords}
                          onChange={(e) => setGmailDrafts((current) => ({ ...current, strongKeywords: e.target.value }))}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.10em] text-[#71717A]">Remetentes ignorados</span>
                        <textarea
                          className="min-h-[126px] w-full resize-none rounded-2xl border border-[#E5EAF4] p-3 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                          value={gmailDrafts.ignoredSenders}
                          onChange={(e) => setGmailDrafts((current) => ({ ...current, ignoredSenders: e.target.value }))}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.10em] text-[#71717A]">Remetentes importantes</span>
                        <textarea
                          className="min-h-[112px] w-full resize-none rounded-2xl border border-[#E5EAF4] p-3 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                          value={gmailDrafts.importantSenders}
                          onChange={(e) => setGmailDrafts((current) => ({ ...current, importantSenders: e.target.value }))}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.10em] text-[#71717A]">Cor dos adservers</span>
                        <div className="flex h-[112px] flex-col justify-between rounded-2xl border border-[#E5EAF4] bg-white p-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={safeHexColor(gmailIntelligence.importantSenderColor)}
                              onChange={(e) => setGmailIntelligence((current) => ({ ...current, importantSenderColor: e.target.value }))}
                              className="h-11 w-14 cursor-pointer rounded-xl border border-[#E5EAF4] bg-white p-1"
                            />
                            <input
                              className="h-11 min-w-0 flex-1 rounded-xl border border-[#E5EAF4] px-3 text-sm font-bold uppercase outline-none focus:border-[#355CFF]/60"
                              value={gmailIntelligence.importantSenderColor}
                              onChange={(e) => setGmailIntelligence((current) => ({ ...current, importantSenderColor: e.target.value }))}
                            />
                          </div>
                          <span
                            className="inline-flex h-8 items-center justify-center rounded-xl px-3 text-[11px] font-black uppercase tracking-[0.10em] text-white"
                            style={{ backgroundColor: safeHexColor(gmailIntelligence.importantSenderColor) }}
                          >
                            Adserver
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <input
                        className="h-12 rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                        placeholder="Google Cloud Project ID"
                        value={gmailIntelligence.googleCloudProjectId}
                        onChange={(e) => setGmailIntelligence((current) => ({ ...current, googleCloudProjectId: e.target.value }))}
                      />
                      <input
                        className="h-12 rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                        placeholder="Pub/Sub topic"
                        value={gmailIntelligence.pubsubTopic}
                        onChange={(e) => setGmailIntelligence((current) => ({ ...current, pubsubTopic: e.target.value }))}
                      />
                      <input
                        className="h-12 rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                        placeholder="Pub/Sub subscription"
                        value={gmailIntelligence.pubsubSubscription}
                        onChange={(e) => setGmailIntelligence((current) => ({ ...current, pubsubSubscription: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-[22px] border border-[#F1F5F9] bg-[#FBFCFF] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#355CFF]">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-[#1D1E2C]">Credenciais seguras</h3>
                        <p className="mt-1 text-[11px] font-medium leading-4 text-[#A1A1AA]">Campos sensiveis ficam mascarados depois de salvar.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <SecretStatus label="Client ID" configured={gmailIntelligence.credentialsConfigured.clientId} />
                      <SecretStatus label="Client Secret" configured={gmailIntelligence.credentialsConfigured.clientSecret} />
                      <SecretStatus label="Refresh Token" configured={gmailIntelligence.credentialsConfigured.refreshTokenLucas} />
                      <SecretStatus label="Webhook Secret" configured={gmailIntelligence.credentialsConfigured.webhookSecret} />
                    </div>

                    <div className="space-y-3">
                      <input
                        className="h-11 w-full rounded-2xl border border-[#E5EAF4] bg-white px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                        placeholder={gmailIntelligence.credentialsConfigured.clientId ? "Client ID ja configurado" : "Client ID"}
                        value={gmailDrafts.clientId}
                        onChange={(e) => setGmailDrafts((current) => ({ ...current, clientId: e.target.value }))}
                      />
                      <input
                        className="h-11 w-full rounded-2xl border border-[#E5EAF4] bg-white px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                        placeholder={gmailIntelligence.credentialsConfigured.clientSecret ? "Client Secret ja configurado" : "Client Secret"}
                        type="password"
                        value={gmailDrafts.clientSecret}
                        onChange={(e) => setGmailDrafts((current) => ({ ...current, clientSecret: e.target.value }))}
                      />
                      <input
                        className="h-11 w-full rounded-2xl border border-[#E5EAF4] bg-white px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                        placeholder={gmailIntelligence.credentialsConfigured.refreshTokenLucas ? "Refresh Token Lucas ja configurado" : "Refresh Token Lucas"}
                        type="password"
                        value={gmailDrafts.refreshTokenLucas}
                        onChange={(e) => setGmailDrafts((current) => ({ ...current, refreshTokenLucas: e.target.value }))}
                      />
                      <input
                        className="h-11 w-full rounded-2xl border border-[#E5EAF4] bg-white px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                        placeholder={gmailIntelligence.credentialsConfigured.webhookSecret ? "Webhook Secret ja configurado" : "Webhook Secret"}
                        type="password"
                        value={gmailDrafts.webhookSecret}
                        onChange={(e) => setGmailDrafts((current) => ({ ...current, webhookSecret: e.target.value }))}
                      />
                    </div>

                    <div className="rounded-2xl border border-[#E5EAF4] bg-white p-3">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#A1A1AA]">Webhook</p>
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[#525866]">{gmailIntelligence.webhookUrl}</p>
                        <button
                          type="button"
                          onClick={copyGmailWebhookUrl}
                          title="Copiar webhook"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5EAF4] text-[#71717A] transition-colors hover:bg-[#F6F9FF] hover:text-[#355CFF]"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={testGmailIntelligenceSettings}
                        disabled={isTestingGmailIntelligence}
                        className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#DCE6FF] bg-white px-4 text-xs font-black text-[#355CFF] transition-colors hover:bg-[#F6F9FF] disabled:cursor-wait disabled:opacity-60"
                      >
                        {isTestingGmailIntelligence ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Validar preparo
                      </button>
                      <button
                        type="button"
                        onClick={syncGmailIntelligenceNow}
                        disabled={isSyncingGmailIntelligence}
                        className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        <RefreshCw className={cn("h-4 w-4", isSyncingGmailIntelligence && "animate-spin")} />
                        {isSyncingGmailIntelligence ? "Sincronizando..." : "Sincronizar agora"}
                      </button>
                      <button
                        type="button"
                        onClick={saveGmailIntelligenceSettings}
                        disabled={isSavingGmailIntelligence}
                        className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#355CFF] px-4 text-xs font-black text-white shadow-[0_12px_28px_rgba(53,92,255,0.18)] transition-colors hover:bg-[#2F52E8] disabled:cursor-wait disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {isSavingGmailIntelligence ? "Salvando..." : "Salvar configuração"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.form
              onSubmit={createAnnouncement}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-[#E9EDF5] bg-white p-6 shadow-sm"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#1D1E2C]">Novo comunicado</h2>
                  <p className="text-xs font-medium text-[#A1A1AA]">Mensagem visivel para toda a equipe.</p>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  className="h-12 w-full rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                  placeholder="Título"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                />
                <textarea
                  className="min-h-[120px] w-full resize-none rounded-2xl border border-[#E5EAF4] p-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
                  placeholder="Comunicado"
                  value={announcementForm.body}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
                />
                <div className="relative">
                  <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5EAF4] bg-white px-4 focus-within:border-[#355CFF]/60 focus-within:ring-4 focus-within:ring-[#355CFF]/10">
                    <Search className="h-4 w-4 text-[#A1A1AA]" />
                    <input
                      className="h-full w-full bg-transparent text-sm outline-none placeholder:text-[#A1A1AA]"
                      placeholder="Vincular campanha por nome ou PI (opcional)"
                      value={selectedCampaign ? `${selectedCampaign.piNumber || "Sem PI"} - ${selectedCampaign.campaignName}` : campaignQuery}
                      onChange={(e) => {
                        setAnnouncementForm({ ...announcementForm, campaignId: "" });
                        setCampaignQuery(e.target.value);
                      }}
                    />
                    {selectedCampaign && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnnouncementForm({ ...announcementForm, campaignId: "" });
                          setCampaignQuery("");
                        }}
                        className="text-xs font-bold text-[#A1A1AA] hover:text-[#355CFF]"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  {!selectedCampaign && campaignSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[54px] z-20 overflow-hidden rounded-2xl border border-[#E5EAF4] bg-white shadow-[0_18px_48px_rgba(18,24,38,0.12)]">
                      {campaignSuggestions.map((campaign) => (
                        <button
                          key={campaign.id}
                          type="button"
                          onClick={() => {
                            setAnnouncementForm({ ...announcementForm, campaignId: campaign.id });
                            setCampaignQuery("");
                          }}
                          className="block w-full px-4 py-3 text-left transition-colors hover:bg-[#F8FAFC]"
                        >
                          <span className="block text-xs font-black text-[#1D1E2C]">{campaign.campaignName}</span>
                          <span className="mt-0.5 block text-[11px] font-semibold text-[#A1A1AA]">PI {campaign.piNumber || "-"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className="h-12 rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60"
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value as "normal" | "important" })}
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Importante</option>
                  </select>
                  <label className="flex h-12 items-center gap-2 rounded-2xl border border-[#E5EAF4] px-4 text-sm font-semibold text-[#525866]">
                    <input type="checkbox" checked={announcementForm.active} onChange={(e) => setAnnouncementForm({ ...announcementForm, active: e.target.checked })} />
                    Ativo
                  </label>
                </div>
                <select
                  className={`h-12 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#355CFF]/60 ${
                    announcementForm.boostStatus === "sponsorship"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-[#E5EAF4] bg-white text-[#525866]"
                  }`}
                  value={announcementForm.boostStatus}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, boostStatus: e.target.value as BoostStatus })}
                >
                  <option value="sponsorship">Patrocínio</option>
                  <option value="high">Alta</option>
                  <option value="normal">Normal</option>
                  <option value="low">Baixa</option>
                </select>
                {announcementForm.boostStatus === "sponsorship" && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">
                    Patrocínio exige acompanhamento próximo: a entrega pode ficar sem limite de impressões e gerar overdelivery.
                  </div>
                )}
              </div>

              <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#355CFF] text-sm font-bold text-white shadow-[0_12px_28px_rgba(53,92,255,0.20)] transition-colors hover:bg-[#2F52E8]">
                <Send className="h-4 w-4" />
                Publicar comunicado
              </button>
            </motion.form>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-[#E9EDF5] bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-[#F1F5F9] p-6">
                <div>
                  <h2 className="text-sm font-black text-[#1D1E2C]">Comunicados publicados</h2>
                  <p className="text-xs font-medium text-[#A1A1AA]">{announcements.length} comunicado(s)</p>
                </div>
                <Bell className="h-5 w-5 text-[#355CFF]" />
              </div>
              <div className="divide-y divide-[#F1F5F9]">
                {announcements.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-[#1D1E2C]">{item.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {item.active ? "Ativo" : "Inativo"}
                        </span>
                        {item.priority === "important" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Importante</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.boost_status === "sponsorship"
                            ? "bg-red-50 text-red-700"
                            : item.boost_status === "high"
                              ? "bg-orange-50 text-orange-700"
                              : item.boost_status === "low"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-[#EBF1FF] text-[#355CFF]"
                        }`}>
                          {boostLabels[item.boost_status || "normal"]}
                        </span>
                      </div>
                      {item.campaign_name && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#525866]">
                          <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1">PI {item.campaign_pi || "-"}</span>
                          <span className="max-w-full truncate rounded-full bg-[#F8FAFC] px-2.5 py-1">{item.campaign_name}</span>
                          {item.campaign_gam_link && (
                            <a
                              href={item.campaign_gam_link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-[#E5EAF4] px-2.5 py-1 text-[#355CFF] hover:bg-[#F6F9FF]"
                            >
                              GAM
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {item.campaign_dashboard_url && (
                            <a
                              href={item.campaign_dashboard_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-[#E5EAF4] px-2.5 py-1 text-[#355CFF] hover:bg-[#F6F9FF]"
                            >
                              Dashboard
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                      <p className="mt-1 text-sm leading-6 text-[#71717A]">{item.body}</p>
                      {item.boost_status === "sponsorship" && (
                        <p className="mt-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                          Patrocínio ativo: acompanhar impressões para evitar overdelivery.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateAnnouncement(item.id, { active: !item.active })} className="rounded-2xl border border-[#E5EAF4] px-3 py-2 text-xs font-bold text-[#525866] hover:bg-[#F8FAFC]">
                        {item.active ? "Desativar" : "Ativar"}
                      </button>
                      <button onClick={() => deleteAnnouncement(item.id)} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500 hover:bg-red-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {announcements.length === 0 && <div className="p-8 text-sm font-semibold text-[#A1A1AA]">Nenhum comunicado publicado.</div>}
              </div>
            </motion.div>
          </section>

        </div>
      </main>
    </div>
  );
}

function UserRow({
  user,
  onUpdate,
  onDelete,
  onInvite,
  isInviting,
}: {
  user: ManagedUser;
  onUpdate: (id: string, updates: Partial<ManagedUser> & { password?: string }) => void;
  onDelete: (id: string) => void;
  onInvite: (id: string) => void;
  isInviting: boolean;
}) {
  const [draft, setDraft] = useState(user);
  const [password, setPassword] = useState("");
  const canInvite = Boolean(draft.active && draft.email && !draft.email.toLowerCase().endsWith("@dashboard.local"));

  useEffect(() => {
    setDraft(user);
  }, [user]);

  return (
    <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_auto] lg:items-center lg:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF1FF] text-sm font-black text-[#355CFF]">
          {draft.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <input className="w-full rounded-xl border border-transparent px-2 py-1 text-sm font-bold text-[#1D1E2C] outline-none hover:border-[#E5EAF4] focus:border-[#355CFF]/60" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="w-full rounded-xl border border-transparent px-2 py-1 text-xs font-medium text-[#71717A] outline-none hover:border-[#E5EAF4] focus:border-[#355CFF]/60" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
        </div>
      </div>

      <input className="h-10 rounded-2xl border border-[#E5EAF4] px-3 text-sm outline-none focus:border-[#355CFF]/60" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
      <select className="h-10 rounded-2xl border border-[#E5EAF4] px-3 text-sm font-semibold outline-none focus:border-[#355CFF]/60" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}>
        <option value="USER">Equipe</option>
        <option value="ADMIN">Lucas</option>
      </select>
      <label className="flex h-10 items-center gap-2 rounded-2xl border border-[#E5EAF4] px-3 text-sm font-semibold text-[#525866]">
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
        Ativo
      </label>

      <div className="flex items-center justify-end gap-2">
        <input className="h-10 w-32 rounded-2xl border border-[#E5EAF4] px-3 text-xs outline-none focus:border-[#355CFF]/60" placeholder="Nova senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          type="button"
          onClick={() => onInvite(user.id)}
          disabled={!canInvite || isInviting}
          title={canInvite ? "Enviar email com usuário e nova senha temporária" : "Cadastre um email válido para enviar acesso"}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#DCE6FF] bg-[#F6F9FF] text-[#355CFF] transition-colors hover:bg-[#EBF1FF] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Send className="h-4 w-4" />
        </button>
        <button onClick={() => onUpdate(user.id, { ...draft, password: password || undefined })} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#355CFF] text-white transition-colors hover:bg-[#2F52E8]">
          <Save className="h-4 w-4" />
        </button>
        <button onClick={() => onDelete(user.id)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500 transition-colors hover:bg-red-100">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

