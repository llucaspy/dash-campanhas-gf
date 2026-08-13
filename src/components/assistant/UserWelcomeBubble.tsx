"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, CheckCircle2, MessageCircle, TimerReset } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const READ_SECONDS = 4;

const welcomeHighlights = [
  {
    icon: CheckCircle2,
    title: "Campanhas",
    description: "Confira status, prazos e entregas em andamento.",
  },
  {
    icon: BellRing,
    title: "Pontos de atenção",
    description: "Priorize o que precisa de resposta da OPEC.",
  },
  {
    icon: MessageCircle,
    title: "Assistente",
    description: "Use o chat para resumir ações e próximos passos.",
  },
];

export function UserWelcomeBubble() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(READ_SECONDS);

  const shouldShow = Boolean(user && user.hasSeenWelcome === false && !dismissed);
  const firstName = user?.name?.split(" ")[0] || "bem-vindo";
  const canContinue = secondsLeft === 0;

  useEffect(() => {
    if (!shouldShow) {
      setSecondsLeft(READ_SECONDS);
      return;
    }

    setSecondsLeft(READ_SECONDS);
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [shouldShow]);

  const dismiss = async () => {
    if (!canContinue) return;

    setDismissed(true);
    window.dispatchEvent(new Event("dashboard-welcome-dismissed"));
    await fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-start justify-center bg-slate-950/82 px-4 pt-[7vh] backdrop-blur-md print:hidden sm:pt-[9vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[640px] overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="relative flex items-start gap-4 border-b border-slate-200 pb-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 shadow-sm">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                  Primeiro acesso
                </div>
                <p className="text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">Bem-vindo ao Dashboard - Governo Federal</p>
                <p className="mt-3 max-w-[500px] text-sm leading-6 text-slate-600 sm:text-base">
                  Olá, {firstName}. Antes de entrar, veja rapidamente onde estão as informações que mais evitam retrabalho no dia a dia.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {welcomeHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-white text-slate-800 shadow-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-bold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-500">
                {!canContinue && (
                  <>
                    <TimerReset className="h-4 w-4 text-amber-600" />
                    <span>Libera em {secondsLeft}s para garantir uma leitura rápida.</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={dismiss}
                disabled={!canContinue}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#355CFF] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(53,92,255,0.24)] transition-colors hover:bg-[#2F52E8] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
              >
                Começar no dashboard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
