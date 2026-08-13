"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Eye,
  LockKeyhole,
  MessageCircle,
  ShieldAlert,
  Target,
  Timer,
  TrendingUp,
  UserRound,
} from "lucide-react";

import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { HeroCard } from "../components/dashboard/HeroCard";
import { KPICard } from "../components/dashboard/KPICard";
import { PerformanceChart } from "../components/dashboard/PerformanceChart";
import { SmartAlerts } from "../components/dashboard/SmartAlerts";
import { AttentionPlacements } from "../components/dashboard/AttentionPlacements";
import { CampaignTable } from "../components/dashboard/CampaignTable";
import { CommunicationCenter } from "../components/dashboard/CommunicationCenter";
import { PrintReport } from "../components/dashboard/PrintReport";
import { GlobalToaster } from "../components/dashboard/GlobalToaster";
import { NewCampaignToaster } from "../components/dashboard/NewCampaignToaster";
import { useCampaigns } from "../context/CampaignContext";
import { useAuth } from "../context/AuthContext";
import { calculateTotalImpressions, getCampaignIntelligenceSummary } from "../lib/campaignHealth";
import { splitCampaignsByArchive } from "../lib/campaignArchive";

const whatsappHref =
  "https://wa.me/5561995680763?text=Ol%C3%A1!%20Gostaria%20de%20solicitar%20acesso%20%C3%A0%20plataforma.";

function LoginScreen() {
  const { login, refresh } = useAuth();
  const [isAccessCard, setIsAccessCard] = useState(false);
  const [backCardMode, setBackCardMode] = useState<"access" | "password">("access");
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [welcomeName, setWelcomeName] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await login(username, password, { deferUser: true });
    setIsLoading(false);
    if (!result.ok) setError(result.error || "Falha ao autenticar.");
    else if (result.user?.mustChangePassword) {
      setWelcomeName(result.user.name || result.user.username || "usuário");
      setBackCardMode("password");
      setIsAccessCard(true);
    }
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("A nova senha precisa ter no mínimo 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não conferem.");
      return;
    }

    setIsChangingPassword(true);
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: password, newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    setIsChangingPassword(false);

    if (!response.ok) {
      setPasswordError(data.error || "Não foi possível alterar a senha.");
      return;
    }

    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    await refresh();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F7F8FB] px-5 py-10 text-[#1D1E2C]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(53,92,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(53,92,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]" />
      <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-[#355CFF]/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.96),rgba(247,248,251,0.7)_42%,rgba(247,248,251,1)_78%)]" />

      <section className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E1E7F5] bg-white text-[#355CFF] shadow-sm">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#151724]">Dash campanhas - GF</p>
            <p className="text-[11px] font-medium text-[#8A91A3]">Analytics interno</p>
          </div>
        </div>

        <div className="[perspective:1200px]">
          <motion.div
            className="relative min-h-[508px] w-full [transform-style:preserve-3d]"
            animate={{ rotateY: isAccessCard ? 180 : 0 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <form
              onSubmit={handleSubmit}
              className="absolute inset-0 flex flex-col justify-between rounded-[28px] border border-white/80 bg-white/82 p-7 shadow-[0_22px_70px_rgba(18,24,38,0.10)] backdrop-blur-xl [backface-visibility:hidden] sm:p-8"
              style={{ transform: "rotateY(0deg)" }}
            >
              <div>
                <div className="text-center">
                  <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[#111827]">Bem-vindo de volta</h1>
                  <p className="mt-2 text-sm leading-6 text-[#71717A]">Acesse o painel interno de analytics.</p>
                </div>

                <div className="mt-8 space-y-4">
                  <label className="group block">
                    <span className="mb-2 block text-xs font-medium text-[#525866]">Usuário</span>
                    <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5EAF4] bg-white px-4 transition-all duration-200 group-focus-within:border-[#355CFF]/60 group-focus-within:shadow-[0_0_0_4px_rgba(53,92,255,0.08)]">
                      <UserRound className="h-4 w-4 text-[#9AA3B2] transition-colors group-focus-within:text-[#355CFF]" />
                      <input
                        type="text"
                        placeholder="Digite seu usuário"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className="h-full w-full bg-transparent text-sm font-medium text-[#151724] outline-none placeholder:text-[#B6BDCA]"
                      />
                    </div>
                  </label>

                  <label className="group block">
                    <span className="mb-2 block text-xs font-medium text-[#525866]">Senha</span>
                    <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5EAF4] bg-white px-4 transition-all duration-200 group-focus-within:border-[#355CFF]/60 group-focus-within:shadow-[0_0_0_4px_rgba(53,92,255,0.08)]">
                      <LockKeyhole className="h-4 w-4 text-[#9AA3B2] transition-colors group-focus-within:text-[#355CFF]" />
                      <input
                        type="password"
                        placeholder="Digite sua senha"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-full w-full bg-transparent text-sm font-medium text-[#151724] outline-none placeholder:text-[#B6BDCA]"
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                    {error}
                  </div>
                )}
                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={isLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#355CFF] text-sm font-semibold text-white shadow-[0_12px_28px_rgba(53,92,255,0.22)] transition-all hover:bg-[#2F52E8] disabled:cursor-wait"
                >
                  {isLoading ? (
                    <motion.span
                      className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                    />
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    setBackCardMode("access");
                    setIsAccessCard(true);
                  }}
                  className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#E5EAF4] bg-white text-sm font-semibold text-[#355CFF] transition-all hover:border-[#CAD6F7] hover:bg-[#F8FAFF]"
                >
                  Solicitar acesso
                </button>
              </div>
            </form>

            <div
              className="absolute inset-0 flex flex-col justify-between rounded-[28px] border border-white/80 bg-white/86 p-7 shadow-[0_22px_70px_rgba(18,24,38,0.10)] backdrop-blur-xl [backface-visibility:hidden] sm:p-8"
              style={{ transform: "rotateY(180deg)" }}
            >
              {backCardMode === "password" ? (
                <>
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                      <LockKeyhole className="h-5 w-5" />
                    </div>
                    <div className="mt-5 text-center">
                      <h2 className="text-2xl font-semibold tracking-[-0.01em] text-[#111827]">
                        Bem-vindo, {welcomeName.split(" ")[0] || "usuário"}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#71717A]">
                        Antes de acessar o dashboard, defina uma nova senha pessoal.
                      </p>
                    </div>

                    <form id="initial-password-form" onSubmit={handlePasswordChange} className="mt-7 space-y-4">
                      <label className="group block">
                        <span className="mb-2 block text-xs font-medium text-[#525866]">Nova senha</span>
                        <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5EAF4] bg-white px-4 transition-all duration-200 group-focus-within:border-[#355CFF]/60 group-focus-within:shadow-[0_0_0_4px_rgba(53,92,255,0.08)]">
                          <LockKeyhole className="h-4 w-4 text-[#9AA3B2] transition-colors group-focus-within:text-[#355CFF]" />
                          <input
                            type="password"
                            placeholder="Mínimo de 8 caracteres"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            className="h-full w-full bg-transparent text-sm font-medium text-[#151724] outline-none placeholder:text-[#B6BDCA]"
                          />
                        </div>
                      </label>

                      <label className="group block">
                        <span className="mb-2 block text-xs font-medium text-[#525866]">Confirmar senha</span>
                        <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5EAF4] bg-white px-4 transition-all duration-200 group-focus-within:border-[#355CFF]/60 group-focus-within:shadow-[0_0_0_4px_rgba(53,92,255,0.08)]">
                          <ShieldAlert className="h-4 w-4 text-[#9AA3B2] transition-colors group-focus-within:text-[#355CFF]" />
                          <input
                            type="password"
                            placeholder="Repita a nova senha"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className="h-full w-full bg-transparent text-sm font-medium text-[#151724] outline-none placeholder:text-[#B6BDCA]"
                          />
                        </div>
                      </label>
                    </form>
                  </div>

                  <div className="space-y-3">
                    {passwordError && (
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                        {passwordError}
                      </div>
                    )}
                    <motion.button
                      type="submit"
                      form="initial-password-form"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      disabled={isChangingPassword}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#355CFF] text-sm font-semibold text-white shadow-[0_12px_28px_rgba(53,92,255,0.22)] transition-all hover:bg-[#2F52E8] disabled:cursor-wait"
                    >
                      {isChangingPassword ? "Salvando..." : "Salvar nova senha e entrar"}
                      {!isChangingPassword && <ArrowRight className="h-4 w-4" />}
                    </motion.button>
                  </div>
                </>
              ) : (
                <>
              <button
                type="button"
                onClick={() => setIsAccessCard(false)}
                className="w-fit rounded-full border border-[#E5EAF4] bg-white px-3 py-1.5 text-xs font-medium text-[#525866] transition-all hover:border-[#CAD6F7] hover:text-[#355CFF]"
              >
                Voltar
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <div className="absolute inset-[-10px] rounded-full bg-[#355CFF]/10 blur-xl" />
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-[#EEF2F8] bg-[#F5F7FB] shadow-sm">
                    <img
                      src="https://images.metroimg.com/2026/02/foto-lucas-paim.png"
                      alt="Lucas Paim"
                      className="h-full w-full object-cover grayscale"
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                </div>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </div>

                <h2 className="mt-6 text-2xl font-semibold tracking-[-0.01em] text-[#111827]">Solicite acesso à plataforma</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[#71717A]">Envie uma mensagem para liberar seu acesso ao painel interno.</p>
              </div>

              <div className="space-y-3">
                <motion.a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#355CFF] text-sm font-semibold text-white shadow-[0_12px_28px_rgba(53,92,255,0.20)] transition-all hover:bg-[#2F52E8]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </motion.a>
                <p className="text-center text-xs font-medium text-[#8A91A3]">+55 61 99568-0763</p>
              </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

function DashboardHome({ animationsReady }: { animationsReady: boolean }) {
  const { campaigns, canViewOperationalInfo } = useCampaigns();
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);
  const [communicationsEnabled, setCommunicationsEnabled] = useState(true);
  const [showCommunicationCenter, setShowCommunicationCenter] = useState(false);
  const hasPlayedCommunicationIntro = useRef(false);
  const containerVariants = {
    static: { opacity: 1 },
    hidden: { opacity: 1 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };
  const sectionVariants = {
    static: { opacity: 1, y: 0 },
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  useEffect(() => {
    let isMounted = true;

    fetch("/api/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isMounted) setCommunicationsEnabled(data?.communicationsEnabled ?? true);
      })
      .catch(() => {
        if (isMounted) setCommunicationsEnabled(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalImpressions = currentCampaigns.reduce((acc, camp) => {
    return acc + calculateTotalImpressions(camp);
  }, 0);

  const totalDelivered = currentCampaigns.reduce((acc, camp) => acc + (camp.deliveredImpressions || 0), 0);

  const viewabilityCamps = currentCampaigns.filter((c) => c.viewabilityPercentage !== undefined && c.viewabilityPercentage > 0);
  const avgViewability =
    viewabilityCamps.length > 0
      ? (viewabilityCamps.reduce((acc, c) => acc + (c.viewabilityPercentage || 0), 0) / viewabilityCamps.length).toFixed(1) + "%"
      : "0,00%";

  const intelligenceSummary = getCampaignIntelligenceSummary(currentCampaigns, { isAdmin: canViewOperationalInfo });
  const attentionCampaigns =
    intelligenceSummary.attention.length + intelligenceSummary.materialPending.length + intelligenceSummary.sponsorshipActive.length;

  const activeCampaigns = currentCampaigns.filter((c) => c.status === "veiculando").length;
  useEffect(() => {
    if (!animationsReady) {
      setShowCommunicationCenter(false);
      return;
    }

    if (!communicationsEnabled) {
      setShowCommunicationCenter(false);
      return;
    }

    if (hasPlayedCommunicationIntro.current) {
      setShowCommunicationCenter(true);
      return;
    }

    setShowCommunicationCenter(false);
    const timer = window.setTimeout(() => {
      hasPlayedCommunicationIntro.current = true;
      setShowCommunicationCenter(true);
    }, 2900);
    return () => window.clearTimeout(timer);
  }, [animationsReady, communicationsEnabled]);

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC] print:bg-white">
      <Sidebar />
      <main className="relative w-full max-w-full flex-1 overflow-x-hidden bg-[#F8FAFC] print:ml-0 print:bg-white xl:ml-[232px] 2xl:ml-[260px]">
        <Topbar />

        <motion.div
          key={animationsReady ? "dashboard-animated" : "dashboard-static"}
          initial={animationsReady ? "hidden" : false}
          animate={animationsReady ? "visible" : "static"}
          variants={containerVariants}
          className="flex w-full min-w-0 flex-col gap-4 p-3 print:hidden sm:p-4 xl:gap-5 xl:p-5 2xl:gap-7 2xl:p-8"
        >
          <motion.div variants={sectionVariants} className="order-1">
            <HeroCard animationsReady={animationsReady} />
          </motion.div>

          <motion.div
            variants={sectionVariants}
            className="order-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:order-2 xl:grid-cols-3 xl:gap-4 2xl:grid-cols-6 2xl:gap-5"
          >
            <KPICard animationsReady={animationsReady} label="Impressões Contratadas" value={totalImpressions.toLocaleString("pt-BR") || "0"} icon={Eye} iconBg="bg-[#EBF1FF]" iconColor="text-[#355CFF]" />
            <KPICard animationsReady={animationsReady} label="Total Entregue" value={totalDelivered.toLocaleString("pt-BR")} icon={TrendingUp} iconBg="bg-[#F0FDF4]" iconColor="text-[#22C55E]" />
            <KPICard animationsReady={animationsReady} label="Viewability (VA)" value={avgViewability} icon={Target} iconBg="bg-[#EEF2FF]" iconColor="text-[#6366F1]" />
            <KPICard animationsReady={animationsReady} label="Acompanhar" value={attentionCampaigns.toString()} icon={ShieldAlert} iconBg="bg-[#FEF2F2]" iconColor="text-[#EF4444]" />
            <KPICard animationsReady={animationsReady} label="Campanhas Ativas" value={activeCampaigns.toString()} icon={Timer} iconBg="bg-[#FFFBEB]" iconColor="text-[#F59E0B]" />
            <KPICard
              animationsReady={animationsReady}
              label="Pendente Material"
              value={intelligenceSummary.materialPending.length.toString()}
              icon={ShieldAlert}
              iconBg="bg-[#F5F3FF]"
              iconColor="text-[#8B5CF6]"
              className="hidden xl:flex"
            />
          </motion.div>

          <AnimatePresence>
            {communicationsEnabled && showCommunicationCenter && (
              <motion.div
                key="communication-center"
                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.985 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="order-4 xl:order-3"
              >
                <CommunicationCenter />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            variants={sectionVariants}
            className="order-5 mb-5 grid grid-cols-1 gap-5 overflow-hidden xl:order-4 xl:h-[640px] xl:min-h-0 xl:grid-cols-12 2xl:h-[780px] 2xl:gap-7"
          >
            <div className="min-h-0 min-w-0 h-full xl:col-span-8">
              <PerformanceChart animationsReady={animationsReady} />
            </div>
            <div className="flex min-w-0 h-full min-h-0 flex-col gap-5 xl:col-span-4">
              <SmartAlerts />
              <AttentionPlacements />
            </div>
          </motion.div>

          <motion.div id="campaign-section" variants={sectionVariants} className="order-2 xl:order-5">
            <CampaignTable />
          </motion.div>
        </motion.div>
        <PrintReport />
        <GlobalToaster />
        <NewCampaignToaster />
      </main>
    </div>
  );
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const [welcomeReleased, setWelcomeReleased] = useState(false);
  const [dashboardAnimationsReady, setDashboardAnimationsReady] = useState(false);
  const releaseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setWelcomeReleased(false);
    setDashboardAnimationsReady(Boolean(user && user.hasSeenWelcome !== false));
    if (releaseTimerRef.current) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, [user?.id, user?.hasSeenWelcome]);

  useEffect(() => {
    const releaseWelcome = () => {
      setWelcomeReleased(true);
      setDashboardAnimationsReady(false);
      if (releaseTimerRef.current) window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = window.setTimeout(() => {
        setDashboardAnimationsReady(true);
        releaseTimerRef.current = null;
      }, 1000);
    };

    window.addEventListener("dashboard-welcome-dismissed", releaseWelcome);
    return () => {
      window.removeEventListener("dashboard-welcome-dismissed", releaseWelcome);
      if (releaseTimerRef.current) window.clearTimeout(releaseTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F8FB]">
        <motion.div
          className="h-6 w-6 rounded-full border-2 border-[#355CFF]/20 border-t-[#355CFF]"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
      </main>
    );
  }

  if (!user) return <LoginScreen />;

  return <DashboardHome animationsReady={dashboardAnimationsReady || (user.hasSeenWelcome !== false && !welcomeReleased)} />;
}
