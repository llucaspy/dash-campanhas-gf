"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, CalendarClock, ChevronDown, Clock3, Maximize2, MessageCircle, Minimize2, Send, Sparkles, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCampaigns } from "../../context/CampaignContext";
import { buildOpecAssistantReport, createAssistantAnswer, type AssistantInsight, type AssistantMood, type AssistantReport } from "../../lib/opecAssistant";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  relatedInsightIds?: string[];
  intent?: string;
}

const IGNORED_SMARTCARD_CAMPAIGNS_KEY = "dashboard-gf-smartcard-ignored-campaigns";
const IGNORED_SMARTCARD_CAMPAIGNS_EVENT = "dashboard-gf-smartcard-ignored-campaigns-updated";
const ASSISTANT_REMINDERS_KEY = "dashboard-gf-assistant-reminders";

interface AssistantReminder {
  id: string;
  campaignId: string;
  campaignName: string;
  dueAt: number;
  createdAt: number;
}

const EMPTY_ASSISTANT_REPORT: AssistantReport = {
  mood: "calm",
  moodLabel: "organizado",
  summary: "Leitura operacional disponivel para Lucas.",
  counts: {
    active: 0,
    immediate: 0,
    watch: 0,
    adjust: 0,
    almostDone: 0,
    done: 0,
    healthy: 0,
  },
  insights: [],
  allInsights: [],
  quickReplies: [],
};

const moodStyles: Record<AssistantMood, { bg: string; ring: string; text: string; bubble: string; label: string; halo: string }> = {
  stressed: {
    bg: "from-[#FF9F7A] via-[#F87171] to-[#355CFF]",
    ring: "ring-orange-100",
    text: "text-rose-600",
    bubble: "border-rose-100 bg-white/95 text-rose-700",
    label: "atenção",
    halo: "bg-rose-400/[0.14]",
  },
  thinking: {
    bg: "from-[#FACC15] via-[#60A5FA] to-[#355CFF]",
    ring: "ring-amber-100",
    text: "text-amber-600",
    bubble: "border-amber-100 bg-white/95 text-amber-700",
    label: "análise",
    halo: "bg-amber-300/[0.16]",
  },
  calm: {
    bg: "from-[#34D399] via-[#60A5FA] to-[#355CFF]",
    ring: "ring-sky-100",
    text: "text-[#355CFF]",
    bubble: "border-sky-100 bg-white/95 text-[#355CFF]",
    label: "tranquilo",
    halo: "bg-[#355CFF]/[0.12]",
  },
};

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCampaignCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function AssistantFace({ mood, compact = false }: { mood: AssistantMood; compact?: boolean }) {
  const styles = moodStyles[mood];
  const mouthPath =
    mood === "stressed"
      ? "M35 47 C39 42 45 42 49 47"
      : mood === "thinking"
        ? "M38 47 C41 49 45 49 48 47"
        : "M35 45 C39 50 46 50 50 45";
  const browLeft = mood === "stressed" ? "M30 31 L38 28" : mood === "thinking" ? "M31 29 L38 31" : "M31 30 L38 30";
  const browRight = mood === "stressed" ? "M56 28 L64 31" : mood === "thinking" ? "M56 31 L63 29" : "M56 30 L63 30";

  return (
    <motion.div
      className={`relative shrink-0 ${compact ? "h-12 w-14" : "h-16 w-20"}`}
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: mood === "stressed" ? 2 : 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className={`absolute inset-1 rounded-[24px] bg-gradient-to-br ${styles.bg} opacity-20 blur-xl`}
        animate={{ scale: mood === "stressed" ? [1, 1.08, 1] : [1, 1.03, 1] }}
        transition={{ duration: mood === "stressed" ? 1.8 : 3.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg viewBox="0 0 92 68" className="relative h-full w-full drop-shadow-[0_12px_22px_rgba(53,92,255,0.16)]" aria-hidden="true">
        <defs>
          <linearGradient id={`opec-cloud-${mood}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={mood === "stressed" ? "#fff7ed" : mood === "thinking" ? "#fffbeb" : "#f0fdfa"} />
            <stop offset="100%" stopColor="#eff6ff" />
          </linearGradient>
        </defs>
        <path
          d="M22 52C12 52 6 46 6 38c0-7 5-13 13-14C22 14 31 8 42 8c12 0 22 7 26 18 10 1 18 8 18 18 0 11-9 18-21 18H23c-.3 0-.7 0-1-.1Z"
          fill={`url(#opec-cloud-${mood})`}
          stroke={mood === "stressed" ? "#fecaca" : mood === "thinking" ? "#fde68a" : "#bfdbfe"}
          strokeWidth="2"
        />
        <path d={browLeft} stroke="#334155" strokeWidth="2.4" strokeLinecap="round" />
        <path d={browRight} stroke="#334155" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="34" cy="37" r={mood === "thinking" ? "3" : "2.7"} fill="#0f172a" />
        <circle cx="60" cy="37" r={mood === "thinking" ? "3" : "2.7"} fill="#0f172a" />
        <path d={mouthPath} fill="none" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="21" cy="43" r="3" fill={mood === "stressed" ? "#fecdd3" : "#dbeafe"} opacity="0.85" />
        <circle cx="70" cy="43" r="3" fill={mood === "stressed" ? "#fecdd3" : "#dbeafe"} opacity="0.85" />
      </svg>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-[#EEF2F8] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-1.5 w-1.5 rounded-full bg-[#A1A1AA]"
              animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.12, ease: "easeInOut" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AssistantMessageContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isCampaignBlock =
          /^\d+\.\s/.test(lines[0] || "") &&
          lines.some((line) => line.startsWith("Leitura:") || /^Pr[oó]ximo passo:/i.test(line) || /^PI\s/.test(line));

        if (!isCampaignBlock) {
          const [first, ...rest] = lines;
          return (
            <div key={`${block}-${index}`} className="space-y-1">
              {first && <p className="text-[12px] font-black text-[#1D1E2C]">{first}</p>}
              {rest.length > 0 && <p className="whitespace-pre-line text-[12px] leading-5 text-[#647084]">{rest.join("\n")}</p>}
            </div>
          );
        }

        const title = lines[0].replace(/^\d+\.\s*/, "");
        const meta = lines.find((line) => line.startsWith("PI ")) || "";
        const reading = lines.find((line) => line.startsWith("Leitura:"))?.replace("Leitura:", "").trim();
        const action = lines.find((line) => /^Pr[oó]ximo passo:/i.test(line))?.replace(/^Pr[oó]ximo passo:\s*/i, "").trim();

        return (
          <div key={`${block}-${index}`} className="rounded-2xl border border-[#E9EDF5] bg-white p-3 shadow-sm">
            <p className="text-[12px] font-black leading-5 text-[#1D1E2C]">{title}</p>
            {meta && <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#A1A1AA]">{meta}</p>}
            {reading && <p className="mt-2 text-[12px] leading-5 text-[#647084]">{reading}</p>}
            {action && (
              <div className="mt-2 rounded-xl border border-[#DCE6FF] bg-[#F6F9FF] px-3 py-2 text-[11px] font-bold leading-5 text-[#355CFF]">
                {action}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AssistantActionStrip({
  insights,
  isAdmin,
  onAsk,
  onIgnore,
  onRemind,
}: {
  insights: AssistantInsight[];
  isAdmin: boolean;
  onAsk: (insight: AssistantInsight) => void;
  onIgnore: (campaignId: string) => void;
  onRemind: (insight: AssistantInsight) => void;
}) {
  const visibleInsights = insights.slice(0, 3);

  if (!visibleInsights.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {visibleInsights.map((insight) => (
        <div key={insight.id} className="rounded-2xl border border-[#E9EDF5] bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black text-[#1D1E2C]">{insight.campaignName || "Campanha"}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#A1A1AA]">
                PI {insight.piNumber || "-"} | {insight.deliveryPct}% entregue
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAsk(insight)}
              className="shrink-0 rounded-full border border-[#E5EAF4] px-2.5 py-1 text-[10px] font-black text-[#355CFF] transition-colors hover:bg-[#F6F9FF]"
            >
              Detalhar
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {insight.dashLink && (
              <a
                href={insight.dashLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#DCE6FF] bg-[#F6F9FF] px-3 py-1.5 text-[10px] font-black text-[#355CFF] transition-colors hover:bg-[#EBF1FF]"
              >
                Dashboard
              </a>
            )}
            {isAdmin && insight.hasGamLink && insight.gamLink && (
              <a
                href={insight.gamLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#E5EAF4] bg-white px-3 py-1.5 text-[10px] font-black text-[#525866] transition-colors hover:bg-[#F8FAFC]"
              >
                GAM
              </a>
            )}
            {insight.gmailLink && (
              <a
                href={insight.gmailLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#E5EAF4] bg-white px-3 py-1.5 text-[10px] font-black text-[#525866] transition-colors hover:bg-[#F8FAFC]"
              >
                Fluxo
              </a>
            )}
            {insight.pdfUrl && (
              <a
                href={insight.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#E5EAF4] bg-white px-3 py-1.5 text-[10px] font-black text-[#525866] transition-colors hover:bg-[#F8FAFC]"
              >
                PDF
              </a>
            )}
            <button
              type="button"
              onClick={() => onRemind(insight)}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5EAF4] bg-white px-3 py-1.5 text-[10px] font-black text-[#525866] transition-colors hover:bg-[#F8FAFC]"
            >
              <Clock3 className="h-3 w-3" />
              Revisar em 40min
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onIgnore(insight.campaignId)}
                className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-700 transition-colors hover:bg-amber-100"
              >
                Ignorar SmartCard
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AssistantAgendaSummary({
  report,
  onAsk,
}: {
  report: AssistantReport;
  onAsk: (insight: AssistantInsight) => void;
}) {
  const urgent = report.allInsights.filter((insight) => insight.kind === "urgent" || insight.kind === "watch").slice(0, 2);
  const pace = report.allInsights.filter((insight) => insight.kind === "pace").slice(0, 2);
  const delivery = report.allInsights.filter((insight) => insight.kind === "delivery").slice(0, 2);
  const sections = [
    { title: "Começar agora", tone: "text-rose-600 bg-rose-50 border-rose-100", items: urgent, empty: "Sem urgência no momento." },
    { title: "Revisar depois", tone: "text-amber-700 bg-amber-50 border-amber-100", items: pace, empty: "Ritmo sem ajuste moderado." },
    { title: "Para reporte", tone: "text-emerald-700 bg-emerald-50 border-emerald-100", items: delivery, empty: "Sem entrega pronta para destacar." },
  ];

  return (
    <div className="border-b border-[#F1F5F9] bg-white px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#8A91A3]">
        <CalendarClock className="h-3.5 w-3.5 text-[#355CFF]" />
        Mesa OPEC
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className={`rounded-2xl border px-3 py-2.5 ${section.tone}`}>
            <p className="text-[11px] font-black uppercase tracking-[0.08em]">{section.title}</p>
            <div className="mt-2 space-y-1.5">
              {section.items.length ? (
                section.items.map((insight) => (
                  <button
                    key={insight.id}
                    type="button"
                    onClick={() => onAsk(insight)}
                    className="block w-full rounded-xl bg-white/70 px-2.5 py-2 text-left text-[11px] font-bold leading-4 text-[#1D1E2C] transition-colors hover:bg-white"
                  >
                    <span className="line-clamp-1">{insight.campaignName || "Campanha"}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-[#7B8496]">
                      PI {insight.piNumber || "-"} | {insight.deliveryPct}% entregue
                    </span>
                  </button>
                ))
              ) : (
                <p className="rounded-xl bg-white/65 px-2.5 py-2 text-[11px] font-semibold leading-4 text-[#7B8496]">{section.empty}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OpecAssistantWidget() {
  const { user, isAdmin } = useAuth();
  const { campaigns } = useCampaigns();
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [lastInsightId, setLastInsightId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [reminders, setReminders] = useState<AssistantReminder[]>([]);
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = Boolean(user && isAdmin);
  const report = useMemo(() => (visible ? buildOpecAssistantReport(campaigns, { isAdmin }) : EMPTY_ASSISTANT_REPORT), [campaigns, isAdmin, visible]);
  const insightById = useMemo(() => new Map(report.allInsights.map((insight) => [insight.id, insight])), [report.allInsights]);
  const styles = moodStyles[report.mood];
  const attentionTotal = report.counts.immediate + report.counts.watch;
  const attentionLabel = attentionTotal > 0 ? formatCampaignCount(attentionTotal, "campanha para revisar", "campanhas para revisar") : "Nenhuma campanha urgente";
  const dueReminders = useMemo(() => reminders.filter((reminder) => reminder.dueAt <= now).slice(0, 3), [now, reminders]);
  const quickReplies = useMemo(() => {
    if (report.mood === "stressed") {
      return ["Agenda OPEC do dia", "O que vejo primeiro?", "Quanto falta entregar?", "Risco de overdelivery", "Campanhas entregues"];
    }
    if (report.mood === "thinking") {
      return ["Agenda OPEC do dia", "Ajustes de ritmo", "Resumo para executivo", "Campanhas quase entregues", "Quanto falta entregar?"];
    }
    return ["Resumo para executivo", "Campanhas saudáveis", "Campanhas entregues", "Agenda OPEC do dia"];
  }, [report.mood]);

  useEffect(() => {
    if (!visible) return;

    let mounted = true;
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (mounted) setAssistantEnabled(data.assistantEnabled ?? true);
      } catch (_) {}
    };

    loadSettings();
    const interval = window.setInterval(loadSettings, 60000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setMessages((current) =>
      current.length
        ? current
        : [
            {
              id: "intro",
              role: "assistant",
              content: `Oi, ${user?.name?.split(" ")[0] || "equipe"}.\n\n${report.summary}`,
            },
          ]
    );
  }, [report.summary, user?.name, visible]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen, isTyping]);

  useEffect(() => {
    if (!visible) return;
    try {
      const saved = JSON.parse(localStorage.getItem(ASSISTANT_REMINDERS_KEY) || "[]");
      const valid = Array.isArray(saved)
        ? saved.filter((item): item is AssistantReminder => {
            return (
              typeof item?.id === "string" &&
              typeof item?.campaignId === "string" &&
              typeof item?.campaignName === "string" &&
              typeof item?.dueAt === "number" &&
              typeof item?.createdAt === "number"
            );
          })
        : [];
      setReminders(valid);
    } catch (_) {
      setReminders([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, [visible]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  const sendPrompt = (prompt: string) => {
    const clean = prompt.trim();
    if (!clean || isTyping) return;

    const answer = createAssistantAnswer(clean, report, { lastInsightId });
    setMessages((current) => [...current, { id: createMessageId("u"), role: "user", content: clean }]);
    setInput("");
    setIsOpen(true);
    setIsTyping(true);
    if (answer.relatedInsightIds[0]) setLastInsightId(answer.relatedInsightIds[0]);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("a"),
          role: "assistant",
          content: answer.content,
          relatedInsightIds: answer.relatedInsightIds,
          intent: answer.intent,
        },
      ]);
      setIsTyping(false);
    }, 650 + Math.min(450, clean.length * 10));
  };

  const handleQuickReply = (reply: string) => {
    if (isTyping) return;
    sendPrompt(reply);
  };

  const saveReminders = (nextReminders: AssistantReminder[]) => {
    setReminders(nextReminders);
    localStorage.setItem(ASSISTANT_REMINDERS_KEY, JSON.stringify(nextReminders));
  };

  const remindCampaign = (insight: AssistantInsight) => {
    if (typeof window === "undefined") return;
    const reminder: AssistantReminder = {
      id: createMessageId("reminder"),
      campaignId: insight.campaignId,
      campaignName: insight.campaignName || "Campanha",
      dueAt: Date.now() + 40 * 60 * 1000,
      createdAt: Date.now(),
    };
    const nextReminders = [...reminders.filter((item) => item.campaignId !== reminder.campaignId), reminder];
    saveReminders(nextReminders);
    setNotice(`Combinado. Vou lembrar de revisar ${reminder.campaignName} em 40 minutos.`);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const dismissReminder = (reminderId: string) => {
    saveReminders(reminders.filter((reminder) => reminder.id !== reminderId));
  };

  const ignoreSmartCardCampaign = (campaignId: string) => {
    if (typeof window === "undefined") return;

    try {
      const saved = JSON.parse(localStorage.getItem(IGNORED_SMARTCARD_CAMPAIGNS_KEY) || "[]");
      const ids = Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
      const nextIds = Array.from(new Set([...ids, campaignId]));
      localStorage.setItem(IGNORED_SMARTCARD_CAMPAIGNS_KEY, JSON.stringify(nextIds));
      window.dispatchEvent(new CustomEvent(IGNORED_SMARTCARD_CAMPAIGNS_EVENT));
      setNotice("Campanha ignorada no SmartCard deste navegador.");
      window.setTimeout(() => setNotice(""), 2800);
    } catch (_) {
      setNotice("Não consegui salvar essa preferência agora.");
      window.setTimeout(() => setNotice(""), 2800);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendPrompt(input);
  };

  return (
    <div className={isExpanded ? "fixed inset-3 z-[110] print:hidden sm:inset-4" : "fixed bottom-4 right-3 z-[110] print:hidden sm:right-6"}>
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.div
            key="closed"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="relative flex items-end gap-3"
          >
            <div className="pointer-events-none mb-1 hidden flex-col items-end gap-2 sm:flex">
              <motion.div
                animate={{ y: [0, -4, 0], opacity: [0.74, 1, 0.74] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                className={`rounded-2xl border px-3 py-2 text-xs font-bold shadow-[0_12px_34px_rgba(15,23,42,0.08)] backdrop-blur-md ${styles.bubble}`}
              >
                {report.mood === "stressed" ? "Prioridades separadas" : report.mood === "thinking" ? "Leitura do dia pronta" : "Tudo organizado por aqui"}
              </motion.div>
              <motion.div
                animate={{ x: [0, -3, 0], opacity: [0.55, 0.88, 0.55] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-full border border-[#E9EDF5] bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#71717A] shadow-sm"
              >
                {attentionLabel}
              </motion.div>
            </div>

            <motion.button
              type="button"
              onClick={() => setIsOpen(true)}
              whileHover={{ y: -3, scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="relative flex h-[72px] w-[88px] items-center justify-center rounded-[26px] border border-white/80 bg-white/95 p-2 shadow-[0_18px_54px_rgba(18,24,38,0.16)] backdrop-blur-xl"
              title="Abrir Assistente OPEC"
            >
              <span className={`absolute inset-2 rounded-[22px] blur-2xl ${styles.halo}`} />
              <AssistantFace mood={report.mood} compact />
              <span className={`absolute -right-1 -top-1 rounded-full border border-white bg-white px-2 py-1 text-[9px] font-black uppercase shadow-sm ${styles.text}`}>
                {styles.label}
              </span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.section
            key="open"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 31 }}
            className={`flex flex-col overflow-hidden rounded-[28px] border border-[#E5EAF4] bg-white/95 shadow-[0_26px_90px_rgba(15,23,42,0.22)] backdrop-blur-xl ${
              isExpanded ? "h-full w-full" : "w-[calc(100vw-24px)] max-h-[calc(100vh-32px)] sm:w-[520px] lg:w-[560px]"
            }`}
          >
            <div className="relative border-b border-[#EEF2F8] bg-white px-4 py-3">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.bg}`} />
              <div className={`absolute right-6 top-3 h-20 w-20 rounded-full blur-3xl ${styles.halo}`} />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AssistantFace mood={report.mood} compact />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#1D1E2C]">Assistente OPEC</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#8A91A3]">{report.moodLabel}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsExpanded(false);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[#71717A] transition-colors hover:bg-[#F5F7FB] hover:text-[#1D1E2C]"
                    title="Minimizar"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExpanded((current) => !current)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[#71717A] transition-colors hover:bg-[#F5F7FB] hover:text-[#1D1E2C]"
                    title={isExpanded ? "Reduzir chat" : "Expandir chat"}
                  >
                    {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsExpanded(false);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[#71717A] transition-colors hover:bg-[#F5F7FB] hover:text-[#1D1E2C]"
                    title="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {isAdmin && !assistantEnabled && (
                <div className="relative mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Visível somente para Lucas. A equipe está com o assistente desativado.
                </div>
              )}
              {notice && (
                <div className="relative mt-3 rounded-2xl border border-[#DCE6FF] bg-[#F6F9FF] px-3 py-2 text-xs font-semibold text-[#355CFF]">
                  {notice}
                </div>
              )}
              {dueReminders.length > 0 && (
                <div className="relative mt-3 space-y-2 rounded-2xl border border-[#DCE6FF] bg-[#F6F9FF] p-2">
                  {dueReminders.map((reminder) => {
                    const insight = report.allInsights.find((item) => item.campaignId === reminder.campaignId);
                    return (
                      <div key={reminder.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
                        <Clock3 className="h-3.5 w-3.5 text-[#355CFF]" />
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#1D1E2C]">Revisar agora: {reminder.campaignName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (insight) sendPrompt(`fale sobre ${insight.piNumber || insight.campaignName || reminder.campaignName}`);
                            dismissReminder(reminder.id);
                          }}
                          className="rounded-full bg-[#355CFF] px-3 py-1.5 text-[10px] font-black text-white transition-colors hover:bg-[#2F52E8]"
                        >
                          Abrir leitura
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissReminder(reminder.id)}
                          className="rounded-full border border-[#E5EAF4] px-3 py-1.5 text-[10px] font-black text-[#647084] transition-colors hover:bg-[#F8FAFC]"
                        >
                          Ok
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-b border-[#F1F5F9] bg-[#FBFCFF] px-4 py-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-[#EEF2F8] bg-white px-3 py-2 text-center">
                  <p className="text-base font-black text-[#1D1E2C]">{report.counts.active}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#A1A1AA]">ativas</p>
                </div>
                <div className="rounded-2xl border border-[#EEF2F8] bg-white px-3 py-2 text-center">
                  <p className="text-base font-black text-rose-500">{report.counts.immediate + report.counts.watch}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#A1A1AA]">atenção</p>
                </div>
                <div className="rounded-2xl border border-[#EEF2F8] bg-white px-3 py-2 text-center">
                  <p className="text-base font-black text-emerald-500">{report.counts.done + report.counts.almostDone}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#A1A1AA]">avanco</p>
                </div>
              </div>
            </div>

            {isExpanded && <AssistantAgendaSummary report={report} onAsk={(insight) => sendPrompt(`fale sobre ${insight.piNumber || insight.campaignName || "essa campanha"}`)} />}

            <div
              ref={scrollRef}
              className={`${isExpanded ? "min-h-0 flex-1" : "h-[54vh] min-h-[320px] max-h-[460px]"} space-y-3 overflow-y-auto bg-[#FCFDFF] p-4`}
            >
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-5 ${
                      message.role === "user"
                        ? "bg-[#355CFF] text-white shadow-[0_12px_24px_rgba(53,92,255,0.16)]"
                        : "border border-[#EEF2F8] bg-[#F8FAFC] text-[#525866]"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <>
                        <AssistantMessageContent content={message.content} />
                        <AssistantActionStrip
                          insights={(message.relatedInsightIds || []).map((id) => insightById.get(id)).filter((item): item is AssistantInsight => Boolean(item))}
                          isAdmin={isAdmin}
                          onAsk={(insight) => sendPrompt(`fale sobre ${insight.piNumber || insight.campaignName || "essa campanha"}`)}
                          onIgnore={ignoreSmartCardCampaign}
                          onRemind={remindCampaign}
                        />
                      </>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {isTyping && <TypingIndicator />}
            </div>

            <div className="space-y-3 border-t border-[#F1F5F9] bg-white p-4">
              <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      handleQuickReply(reply);
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleQuickReply(reply);
                      }
                    }}
                    disabled={isTyping}
                    className="shrink-0 rounded-full border border-[#E5EAF4] bg-white px-3 py-1.5 text-[11px] font-bold text-[#525866] transition-colors hover:border-[#355CFF]/30 hover:text-[#355CFF] disabled:cursor-wait disabled:opacity-50"
                  >
                    {reply}
                  </button>
                ))}
              </div>
              <form onSubmit={submit} className="flex items-center gap-2">
                <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl border border-[#E5EAF4] bg-white px-3 focus-within:border-[#355CFF]/60 focus-within:ring-4 focus-within:ring-[#355CFF]/10">
                  <MessageCircle className="h-4 w-4 text-[#A1A1AA]" />
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={isTyping ? "Organizando leitura..." : "Pergunte sobre o dia..."}
                    disabled={isTyping}
                    className="h-full w-full bg-transparent text-xs font-semibold text-[#1D1E2C] outline-none placeholder:text-[#A1A1AA] disabled:cursor-wait"
                  />
                </div>
                <button
                  disabled={isTyping}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#355CFF] text-white shadow-[0_12px_24px_rgba(53,92,255,0.18)] transition-colors hover:bg-[#2F52E8] disabled:cursor-wait disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[#A1A1AA]">
                <Bot className="h-3.5 w-3.5" />
                <span>Leitura por regras da OPEC. Sem API externa neste MVP.</span>
                <Sparkles className="ml-auto h-3.5 w-3.5" />
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
