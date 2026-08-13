"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, BrainCircuit, CheckCircle2, Cloud, EyeOff, MessageCircle, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";

import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { useAuth } from "../../context/AuthContext";
import { useCampaigns } from "../../context/CampaignContext";
import { buildOpecAssistantReport, type AssistantMood } from "../../lib/opecAssistant";

const moodCopy: Record<AssistantMood, { title: string; text: string; color: string; bg: string }> = {
  stressed: {
    title: "Nuvem em modo alerta",
    text: "Existem campanhas pedindo leitura operacional hoje.",
    color: "text-red-600",
    bg: "bg-red-50 border-red-100",
  },
  thinking: {
    title: "Nuvem em modo analise",
    text: "A operação está controlada, mas tem pontos que merecem acompanhamento.",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-100",
  },
  calm: {
    title: "Nuvem em modo calmo",
    text: "O painel está com leitura saudável no momento.",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-100",
  },
};

function AssistantCloudPreview({ mood }: { mood: AssistantMood }) {
  const moodColor = mood === "stressed" ? "from-red-500 to-amber-400" : mood === "thinking" ? "from-amber-400 to-[#355CFF]" : "from-emerald-400 to-[#355CFF]";

  return (
    <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-[28px] border border-[#E9EDF5] bg-[#FBFCFF]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(53,92,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(53,92,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <motion.div
        animate={{ y: [0, -7, 0], rotate: mood === "stressed" ? [-1, 1, -1] : [0, 0.5, 0] }}
        transition={{ duration: mood === "stressed" ? 1.4 : 3.5, repeat: Infinity, ease: "easeInOut" }}
        className="relative h-24 w-32"
      >
        <div className={`absolute inset-x-3 bottom-2 h-16 rounded-[34px] bg-gradient-to-br ${moodColor} shadow-[0_24px_60px_rgba(53,92,255,0.24)]`} />
        <span className="absolute left-1 top-8 h-14 w-14 rounded-full bg-white shadow-sm" />
        <span className="absolute left-9 top-3 h-16 w-16 rounded-full bg-white shadow-sm" />
        <span className="absolute right-3 top-7 h-14 w-14 rounded-full bg-white shadow-sm" />
        <div className="absolute left-1/2 top-12 z-10 flex -translate-x-1/2 flex-col items-center">
          <div className="flex gap-3">
            <span className={`h-2 w-3 rounded-full bg-slate-800 ${mood === "stressed" ? "rotate-[24deg]" : ""}`} />
            <span className={`h-2 w-3 rounded-full bg-slate-800 ${mood === "stressed" ? "rotate-[-24deg]" : ""}`} />
          </div>
          <span className={`mt-3 block border-slate-800 ${mood === "stressed" ? "h-2 w-5 rounded-t-full border-t-2" : mood === "thinking" ? "h-3 w-3 rounded-full border-2 border-l-0" : "h-2 w-7 rounded-b-full border-b-2"}`} />
        </div>
      </motion.div>
    </div>
  );
}

export default function AssistantPage() {
  const { campaigns } = useCampaigns();
  const { user, isAdmin, isLoading } = useAuth();
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const report = useMemo(() => buildOpecAssistantReport(campaigns, { isAdmin }), [campaigns, isAdmin]);
  const mood = moodCopy[report.mood];

  useEffect(() => {
    if (!user) return;

    fetch("/api/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setAssistantEnabled(data?.assistantEnabled ?? true))
      .catch(() => setAssistantEnabled(true));
  }, [user]);

  const toggleAssistant = async () => {
    if (!isAdmin) return;
    const nextValue = !assistantEnabled;
    setAssistantEnabled(nextValue);
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assistantEnabled: nextValue }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setAssistantEnabled(!nextValue);
      setMessage(data.error || "Falha ao atualizar assistente.");
      return;
    }

    setAssistantEnabled(data.assistantEnabled ?? nextValue);
    setMessage(nextValue ? "Assistente OPEC ativo para Lucas." : "Assistente OPEC pausado nas configurações. Usuários comuns não veem o assistente.");
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#355CFF]/20 border-t-[#355CFF]" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC]">
      <Sidebar />
      <main className="relative w-full max-w-full flex-1 overflow-x-hidden bg-[#F8FAFC] xl:ml-[232px] 2xl:ml-[260px]">
        <Topbar />

        <div className="w-full min-w-0 space-y-5 p-3 sm:p-4 xl:p-5 2xl:space-y-6 2xl:p-8">
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[28px] border border-[#E9EDF5] bg-white p-6 shadow-sm 2xl:p-8"
            >
              <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#355CFF]/8 blur-3xl" />
              <div className="relative">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                  <Bot className="h-6 w-6" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A1A1AA]">Assistente OPEC</p>
                <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-[#1D1E2C]">
                  Orientações diárias baseadas nos dados reais do dashboard.
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#71717A]">
                  Este MVP não usa API de IA. Ele interpreta o motor de campanhas, separa prioridades e transforma os sinais em orientações práticas para Lucas.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Metric label="Ativas" value={report.counts.active} />
                  <Metric label="Radar" value={report.counts.immediate + report.counts.watch} tone="danger" />
                  <Metric label="Ajustar ritmo" value={report.counts.adjust} tone="warning" />
                  <Metric label="Entregues/quase" value={report.counts.done + report.counts.almostDone} tone="success" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="rounded-[28px] border border-[#E9EDF5] bg-white p-5 shadow-sm"
            >
              <AssistantCloudPreview mood={report.mood} />
              <div className={`mt-4 rounded-2xl border px-4 py-3 ${mood.bg}`}>
                <p className={`text-sm font-black ${mood.color}`}>{mood.title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#71717A]">{mood.text}</p>
              </div>
            </motion.div>
          </section>

          {message && (
            <div className="rounded-2xl border border-[#DCE6FF] bg-white px-4 py-3 text-sm font-semibold text-[#355CFF] shadow-sm">
              {message}
            </div>
          )}

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[28px] border border-[#E9EDF5] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#1D1E2C]">Controle global</h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-[#A1A1AA]">
                    Usuários comuns não veem o chat flutuante. Este controle fica reservado para a operação do Lucas.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleAssistant}
                disabled={!isAdmin || saving}
                className={`mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all ${
                  assistantEnabled
                    ? "bg-[#355CFF] text-white shadow-[0_14px_30px_rgba(53,92,255,0.18)] hover:bg-[#2F52E8]"
                    : "border border-[#E5EAF4] bg-[#F8FAFC] text-[#71717A] hover:bg-white"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {assistantEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                {assistantEnabled ? "Assistente ativo" : "Assistente pausado"}
              </button>

              {!isAdmin && (
                <div className="mt-4 rounded-2xl border border-[#F1F5F9] bg-[#FBFCFF] px-4 py-3 text-xs font-semibold leading-5 text-[#71717A]">
                  Esta configuração fica disponível apenas para Lucas.
                </div>
              )}

              {isAdmin && !assistantEnabled && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-700">
                  <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                  Usuários comuns não veem o assistente flutuante.
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-[28px] border border-[#E9EDF5] bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-[#F1F5F9] p-5">
                <div>
                  <h2 className="text-sm font-black text-[#1D1E2C]">Orientações separadas agora</h2>
                  <p className="mt-1 text-xs font-medium text-[#A1A1AA]">{report.summary}</p>
                </div>
                <MessageCircle className="h-5 w-5 text-[#355CFF]" />
              </div>

              <div className="divide-y divide-[#F1F5F9]">
                {report.insights.map((insight) => (
                  <div key={insight.id} className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                          insight.kind === "urgent"
                            ? "bg-red-50 text-red-600"
                            : insight.kind === "watch"
                              ? "bg-amber-50 text-amber-600"
                              : insight.kind === "delivery"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-[#EBF1FF] text-[#355CFF]"
                        }`}>
                          {insight.title}
                        </span>
                        {insight.piNumber && <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-bold text-[#71717A]">PI {insight.piNumber}</span>}
                      </div>
                      <p className="truncate text-sm font-black text-[#1D1E2C]">{insight.campaignName || "Campanha"}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-[#71717A]">{insight.message}</p>
                    </div>
                    <div className="rounded-2xl border border-[#F1F5F9] bg-[#FBFCFF] px-4 py-3 text-xs font-semibold leading-5 text-[#525866] lg:max-w-[260px]">
                      {insight.action}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <InfoCard icon={BrainCircuit} title="Motor próprio" text="As recomendações saem das regras do SmartCard, não de texto genérico." />
            <InfoCard icon={Cloud} title="Identidade viva" text="A nuvem muda de humor conforme o volume de risco operacional do dia." />
            <InfoCard icon={CheckCircle2} title="Seguro para a equipe" text="Usuários recebem leitura calma. Alertas fortes continuam focados em Lucas." />
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" | "warning" | "success" }) {
  const color =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "success"
          ? "text-emerald-600"
          : "text-[#355CFF]";

  return (
    <div className="rounded-2xl border border-[#F1F5F9] bg-[#FBFCFF] px-4 py-3">
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.1em] text-[#A1A1AA]">{label}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-[#E9EDF5] bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-black text-[#1D1E2C]">{title}</h3>
      <p className="mt-2 text-xs font-medium leading-5 text-[#71717A]">{text}</p>
    </div>
  );
}
