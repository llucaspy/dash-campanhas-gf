"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellRing, ExternalLink, FileText, MessageSquareText, Paperclip, Send, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { CAMPAIGN_STATUS_LABELS, type BoostStatus } from "../../lib/campaignHealth";

type UserInformationLevel = "light" | "adops";

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "important";
  created_at: string;
  author_name?: string;
  campaign_id?: string | null;
  campaign_pi?: string | null;
  campaign_name?: string | null;
  campaign_dashboard_url?: string | null;
  campaign_gam_link?: string | null;
  boost_status: BoostStatus;
}

interface Observation {
  id: string;
  subject: string;
  body: string;
  status: "open" | "reviewed" | "resolved";
  created_at: string;
  attachments: { id: string; fileName: string; fileSize: number; contentType: string }[];
}

const statusLabel = {
  open: "Enviado",
  reviewed: "Em analise",
  resolved: "Resolvido",
};

const boostLabel: Record<BoostStatus, string> = {
  sponsorship: CAMPAIGN_STATUS_LABELS.sponsorship_active,
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

function getAnnouncementTone(boostStatus: BoostStatus, isUserLightMode: boolean) {
  if (boostStatus === "sponsorship") {
    return isUserLightMode
      ? {
          card: "border-indigo-100 bg-[linear-gradient(135deg,#F7F8FF_0%,#FFFFFF_58%,#F4F8FF_100%)] shadow-[0_16px_42px_rgba(53,92,255,0.08)]",
          accent: "bg-[#355CFF]",
          badge: "bg-[#EBF1FF] text-[#355CFF]",
          icon: "text-[#355CFF]",
          label: "Acompanhamento especial",
        }
      : {
          card: "border-red-200 bg-[linear-gradient(135deg,#FFF7F7_0%,#FFFFFF_60%,#F8FAFC_100%)] shadow-[0_16px_42px_rgba(239,68,68,0.10)]",
          accent: "bg-red-500",
          badge: "bg-red-100 text-red-700",
          icon: "text-red-600",
          label: boostLabel.sponsorship,
        };
  }

  if (boostStatus === "high") {
    return {
      card: "border-amber-100 bg-[linear-gradient(135deg,#FFFBEB_0%,#FFFFFF_62%,#F8FAFC_100%)] shadow-[0_14px_36px_rgba(245,158,11,0.07)]",
      accent: "bg-amber-400",
      badge: "bg-amber-50 text-amber-700",
      icon: "text-amber-600",
      label: boostLabel.high,
    };
  }

  if (boostStatus === "low") {
    return {
      card: "border-slate-100 bg-[linear-gradient(135deg,#F8FAFC_0%,#FFFFFF_62%,#F8FAFC_100%)]",
      accent: "bg-slate-300",
      badge: "bg-slate-100 text-slate-500",
      icon: "text-slate-500",
      label: boostLabel.low,
    };
  }

  return {
    card: "border-blue-100 bg-[linear-gradient(135deg,#F6F9FF_0%,#FFFFFF_62%,#F8FAFC_100%)] shadow-[0_14px_36px_rgba(53,92,255,0.06)]",
    accent: "bg-[#355CFF]",
    badge: "bg-[#EBF1FF] text-[#355CFF]",
    icon: "text-[#355CFF]",
    label: boostLabel.normal,
  };
}

const COMMUNICATIONS_REFRESH_INTERVAL_MS = 20 * 1000;

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function CommunicationCenter() {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushStatus, setPushStatus] = useState<"checking" | "unsupported" | "inactive" | "active" | "denied">("checking");
  const [pushMessage, setPushMessage] = useState("");
  const [userInformationLevel, setUserInformationLevel] = useState<UserInformationLevel>("light");
  const isUserLightMode = !isAdmin && userInformationLevel === "light";

  const load = async () => {
    const response = await fetch("/api/communications", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setAnnouncements(data.announcements || []);
    setObservations(data.observations || []);
    setUserInformationLevel(data.userInformationLevel === "adops" ? "adops" : "light");
  };

  useEffect(() => {
    load();
    const intervalId = window.setInterval(load, COMMUNICATIONS_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotificationPermission("unsupported");
      setPushStatus("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);
    setPushStatus(Notification.permission === "denied" ? "denied" : "checking");

    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (Notification.permission === "denied") setPushStatus("denied");
        else setPushStatus(subscription ? "active" : "inactive");
      })
      .catch(() => setPushStatus("inactive"));
  }, []);

  const requestNotifications = async () => {
    setPushMessage("");

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotificationPermission("unsupported");
      setPushStatus("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "denied") {
      setPushStatus("denied");
      setPushMessage("Notificacoes bloqueadas neste navegador.");
      return;
    }

    if (permission !== "granted") {
      setPushStatus("inactive");
      return;
    }

    try {
      setPushStatus("checking");
      const keyResponse = await fetch("/api/push", { cache: "no-store" });
      const keyData = await keyResponse.json().catch(() => ({}));

      if (!keyResponse.ok || !keyData.publicKey) {
        setPushStatus("inactive");
        setPushMessage(keyData.error || "Push ainda nao configurado.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        }));

      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPushStatus("inactive");
        setPushMessage(data.error || "Falha ao ativar notificacoes.");
        return;
      }

      setPushStatus("active");
      setPushMessage("Notificacoes ativas neste navegador.");
    } catch (error) {
      console.error(error);
      setPushStatus("inactive");
      setPushMessage("Nao foi possivel ativar notificacoes neste navegador.");
    }

    if (permission === "granted") localStorage.removeItem("general-announcement-notifications");
  };

  const testNotification = () => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    navigator.serviceWorker.getRegistration("/sw.js").then((registration) => {
      if (!registration) {
        new Notification("Pop-ups ativos", {
          body: "As notificacoes do dashboard estao habilitadas neste navegador.",
        });
        return;
      }

      registration.showNotification("Pop-ups ativos", {
        body: "As notificacoes do dashboard estao habilitadas neste navegador.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "dashboard-gf-test",
      });
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsSending(true);

    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("body", body);
    Array.from(files || []).forEach((file) => formData.append("attachments", file));

    const response = await fetch("/api/communications", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    setIsSending(false);

    if (!response.ok) {
      setMessage(data.error || "Falha ao enviar observacao.");
      return;
    }

    setSubject("");
    setBody("");
    setFiles(null);
    setMessage("Observacao enviada para Lucas.");
    load();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:gap-6"
    >
      <div className="rounded-[20px] border border-[#E9EDF5] bg-white p-4 shadow-sm 2xl:rounded-[24px] 2xl:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-[#1D1E2C]">
              <Bell className="h-4 w-4 text-[#355CFF]" />
              Comunicados
            </h3>
            <p className="mt-1 text-xs font-medium text-[#A1A1AA]">Atualizacoes, tratativas e orientacoes internas.</p>
          </div>

          <div className="flex items-center gap-2">
            {pushStatus !== "active" && notificationPermission !== "denied" && notificationPermission !== "unsupported" && (
              <button
                type="button"
                onClick={requestNotifications}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#DCE6FF] bg-[#F6F9FF] px-3 text-[11px] font-bold text-[#355CFF] hover:bg-white"
              >
                <BellRing className="h-3.5 w-3.5" />
                {pushStatus === "checking" ? "Verificando..." : "Ativar notificacoes"}
              </button>
            )}
            {pushStatus === "active" && (
              <button
                type="button"
                onClick={testNotification}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 hover:bg-white"
              >
                <BellRing className="h-3.5 w-3.5" />
                Testar pop-up
              </button>
            )}
            {(notificationPermission === "denied" || pushStatus === "denied") && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 text-[11px] font-bold text-amber-700">
                Pop-ups bloqueados
              </span>
            )}
            {pushStatus === "unsupported" && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 text-[11px] font-bold text-slate-500">
                Push indisponivel
              </span>
            )}
            <span className="rounded-full bg-[#EBF1FF] px-2.5 py-1 text-xs font-bold text-[#355CFF]">{announcements.length}</span>
          </div>
        </div>

        {pushMessage && <p className="mb-4 rounded-2xl bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#71717A]">{pushMessage}</p>}

        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-5 text-sm font-medium text-[#71717A]">
              Nenhum comunicado ativo no momento.
            </div>
          ) : (
            announcements.map((item) => {
              const tone = getAnnouncementTone(item.boost_status || "normal", isUserLightMode);

              return (
              <article
                key={item.id}
                className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 ${tone.card}`}
              >
                <div className={`absolute inset-y-0 left-0 w-1 ${tone.accent}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.boost_status === "sponsorship" && !isUserLightMode && <ShieldAlert className={`h-4 w-4 ${tone.icon}`} />}
                      <h4 className="text-sm font-black text-[#1D1E2C]">{item.title}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tone.badge}`}>
                        {tone.label}
                      </span>
                    </div>

                    {item.campaign_name && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#525866]">
                        <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">PI {item.campaign_pi || "-"}</span>
                        <span className="max-w-full truncate rounded-full bg-white px-2.5 py-1 shadow-sm">{item.campaign_name}</span>
                      </div>
                    )}

                    <p className="mt-2 text-sm leading-6 text-[#71717A]">{item.body}</p>

                    {item.boost_status === "sponsorship" && !isUserLightMode && (
                      <p className="mt-3 rounded-2xl border border-red-100 bg-white/80 px-3 py-2 text-xs font-semibold leading-5 text-red-700">
                        Patrocinio ativo: acompanhe impressoes de perto para evitar overdelivery.
                      </p>
                    )}
                    {item.boost_status === "sponsorship" && isUserLightMode && (
                      <p className="mt-3 rounded-2xl border border-[#E5EAF4] bg-white/80 px-3 py-2 text-xs font-semibold leading-5 text-[#71717A]">
                        Campanha em acompanhamento especial pela equipe operacional.
                      </p>
                    )}

                    {(item.campaign_dashboard_url || item.campaign_gam_link) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.campaign_dashboard_url && (
                          <a
                            href={item.campaign_dashboard_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5EAF4] bg-white px-3 text-xs font-bold text-[#355CFF] hover:bg-[#F6F9FF]"
                          >
                            Dashboard
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {item.campaign_gam_link && (
                          <a
                            href={item.campaign_gam_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5EAF4] bg-white px-3 text-xs font-bold text-[#355CFF] hover:bg-[#F6F9FF]"
                          >
                            GAM
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {item.priority === "important" && (
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 shadow-sm">
                      Importante
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] font-medium text-[#A1A1AA]">
                  {new Date(item.created_at).toLocaleDateString("pt-BR")} - {item.author_name || "Lucas"}
                </p>
              </article>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-[20px] border border-[#E9EDF5] bg-white p-4 shadow-sm 2xl:rounded-[24px] 2xl:p-6">
        <div className="mb-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-[#1D1E2C]">
            <MessageSquareText className="h-4 w-4 text-[#355CFF]" />
            Observacao para Lucas
          </h3>
          <p className="mt-1 text-xs font-medium text-[#A1A1AA]">Envie comentarios, solicitacoes ou documentos diretamente para Lucas.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Assunto"
            className="h-11 w-full rounded-2xl border border-[#E5EAF4] px-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Escreva sua observacao..."
            className="min-h-[100px] w-full resize-none rounded-2xl border border-[#E5EAF4] p-4 text-sm outline-none focus:border-[#355CFF]/60 focus:ring-4 focus:ring-[#355CFF]/10"
          />
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-[#DCE6FF] bg-[#F8FAFC] px-4 py-3 text-xs font-semibold text-[#71717A] transition-colors hover:border-[#355CFF]/40 hover:bg-[#F6F9FF]">
            <span className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-[#355CFF]" />
              {files?.length ? `${files.length} arquivo(s) selecionado(s)` : "Anexar documentos"}
            </span>
            <input type="file" multiple className="hidden" onChange={(event) => setFiles(event.target.files)} />
          </label>

          {message && <p className="text-xs font-semibold text-[#355CFF]">{message}</p>}

          <button
            disabled={isSending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#355CFF] text-sm font-bold text-white shadow-[0_12px_28px_rgba(53,92,255,0.18)] transition-colors hover:bg-[#2F52E8] disabled:cursor-wait disabled:opacity-70"
          >
            <Send className="h-4 w-4" />
            {isSending ? "Enviando..." : "Enviar observacao"}
          </button>
        </form>

        {observations.length > 0 && (
          <div className="mt-5 border-t border-[#F1F5F9] pt-4">
            <p className="mb-3 text-xs font-bold uppercase text-[#A1A1AA]">Meus envios recentes</p>
            <div className="space-y-2">
              {observations.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#F8FAFC] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-bold text-[#1D1E2C]">{item.subject}</p>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#71717A]">{statusLabel[item.status]}</span>
                  </div>
                  {item.attachments?.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#A1A1AA]">
                      <FileText className="h-3 w-3" />
                      {item.attachments.length} anexo(s)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
