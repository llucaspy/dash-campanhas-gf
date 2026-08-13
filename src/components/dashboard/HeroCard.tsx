"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, BellRing, CheckCircle2, Clock3, ExternalLink, EyeOff, Megaphone, RotateCcw, ShieldAlert, Sparkles, Target, TrendingUp } from "lucide-react";
import { useCampaigns } from "../../context/CampaignContext";
import { useAuth } from "../../context/AuthContext";
import { AdminLock } from "../auth/AdminLock";
import { getCampaignIntelligence, getCampaignIntelligenceSummary, SPONSORSHIP_SMARTCARD_HOURS, type CampaignTone } from "../../lib/campaignHealth";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";

function getSaoPauloEndOfDay(dateValue: string) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    const fallback = new Date(dateValue);
    fallback.setHours(23, 59, 59, 999);
    return fallback.getTime();
  }

  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), 26, 59, 59, 999);
}

const statusIcons = {
  delivered: CheckCircle2,
  almost_delivered: TrendingUp,
  on_track: BarChart3,
  attention: ShieldAlert,
  material_pending: Clock3,
  sponsorship_active: ShieldAlert,
};

const IGNORED_SMARTCARD_CAMPAIGNS_KEY = "dashboard-gf-smartcard-ignored-campaigns";
const IGNORED_SMARTCARD_CAMPAIGNS_EVENT = "dashboard-gf-smartcard-ignored-campaigns-updated";
const ACKNOWLEDGED_SPONSORSHIP_KEY = "dashboard-gf-smartcard-acknowledged-sponsorships";

interface SponsorshipAnnouncement {
  id: string;
  campaign_id: string | null;
  boost_status: string | null;
  created_at: string;
}

interface SponsorshipSmartAlert extends SponsorshipAnnouncement {
  ageHours: number;
  campaign_id: string;
}

function getHeroToneStyles(tone?: CampaignTone) {
  if (tone === "danger") {
    return {
      panel: "bg-red-500/10 border-red-300/20",
      icon: "bg-red-500/20 border-red-400/30 text-red-200",
      pill: "bg-red-500/20 text-red-100",
      glow: "bg-red-500/20",
    };
  }

  if (tone === "success") {
    return {
      panel: "bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(255,255,255,0.06)_52%,rgba(34,197,94,0.10))] border-emerald-300/25",
      icon: "bg-emerald-400/20 border-emerald-300/30 text-emerald-100",
      pill: "bg-emerald-400/20 text-emerald-100",
      glow: "bg-emerald-400/20",
    };
  }

  if (tone === "warning") {
    return {
      panel: "bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(255,255,255,0.06)_54%,rgba(251,191,36,0.10))] border-amber-300/25",
      icon: "bg-amber-400/20 border-amber-300/30 text-amber-100",
      pill: "bg-amber-400/20 text-amber-100",
      glow: "bg-amber-300/18",
    };
  }

  if (tone === "sponsorship") {
    return {
      panel: "bg-[linear-gradient(135deg,rgba(239,68,68,0.14),rgba(255,255,255,0.06)_52%,rgba(53,92,255,0.12))] border-red-300/25",
      icon: "bg-red-400/20 border-red-300/30 text-red-100",
      pill: "bg-red-400/20 text-red-100",
      glow: "bg-red-300/18",
    };
  }

  if (tone === "info") {
    return {
      panel: "bg-[linear-gradient(135deg,rgba(96,165,250,0.18),rgba(255,255,255,0.06)_50%,rgba(56,189,248,0.10))] border-sky-300/25",
      icon: "bg-sky-400/20 border-sky-300/30 text-sky-100",
      pill: "bg-sky-400/20 text-sky-100",
      glow: "bg-sky-300/18",
    };
  }

  return {
    panel: "bg-white/5 border-white/10",
    icon: "bg-white/10 border-white/10 text-white",
    pill: "bg-white/10 text-white/80",
    glow: "bg-blue-300/10",
  };
}

export function HeroCard({ animationsReady = true }: { animationsReady?: boolean }) {
  const { campaigns, canViewOperationalInfo } = useCampaigns();
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);
  const { user, isAdmin } = useAuth();
  const [greeting, setGreeting] = useState("Ola");
  const [nowPulse, setNowPulse] = useState(new Date().getTime());
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
  const [ignoredCampaignIds, setIgnoredCampaignIds] = useState<string[]>([]);
  const [acknowledgedSponsorshipIds, setAcknowledgedSponsorshipIds] = useState<string[]>([]);
  const [sponsorshipAnnouncements, setSponsorshipAnnouncements] = useState<SponsorshipAnnouncement[]>([]);
  const playedImmediateAlertsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const updateGreetingData = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) setGreeting("Bom dia");
      else if (hour >= 12 && hour < 18) setGreeting("Boa tarde");
      else setGreeting("Boa noite");
    };

    updateGreetingData();
    const interval = setInterval(() => {
      setNowPulse(new Date().getTime());
      updateGreetingData();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAdmin || typeof window === "undefined") return;

    const syncIgnoredCampaignIds = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(IGNORED_SMARTCARD_CAMPAIGNS_KEY) || "[]");
        setIgnoredCampaignIds(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : []);
      } catch (_) {
        setIgnoredCampaignIds([]);
      }
    };

    syncIgnoredCampaignIds();
    window.addEventListener(IGNORED_SMARTCARD_CAMPAIGNS_EVENT, syncIgnoredCampaignIds);
    window.addEventListener("storage", syncIgnoredCampaignIds);

    return () => {
      window.removeEventListener(IGNORED_SMARTCARD_CAMPAIGNS_EVENT, syncIgnoredCampaignIds);
      window.removeEventListener("storage", syncIgnoredCampaignIds);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || typeof window === "undefined") return;

    try {
      const saved = JSON.parse(localStorage.getItem(ACKNOWLEDGED_SPONSORSHIP_KEY) || "[]");
      setAcknowledgedSponsorshipIds(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : []);
    } catch (_) {
      setAcknowledgedSponsorshipIds([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setSponsorshipAnnouncements([]);
      return;
    }

    let isMounted = true;

    const loadSponsorshipAnnouncements = async () => {
      try {
        const response = await fetch("/api/communications", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const announcements = Array.isArray(data.announcements) ? data.announcements : [];

        if (isMounted) {
          setSponsorshipAnnouncements(
            announcements
              .filter((item: SponsorshipAnnouncement) => item?.boost_status === "sponsorship" && item?.campaign_id && item?.created_at)
              .map((item: SponsorshipAnnouncement) => ({
                id: String(item.id),
                campaign_id: item.campaign_id ? String(item.campaign_id) : null,
                boost_status: item.boost_status,
                created_at: item.created_at,
              }))
          );
        }
      } catch (_) {}
    };

    loadSponsorshipAnnouncements();
    const interval = window.setInterval(loadSponsorshipAnnouncements, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [isAdmin]);

  const saveIgnoredCampaignIds = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    setIgnoredCampaignIds(uniqueIds);

    if (typeof window !== "undefined") {
      localStorage.setItem(IGNORED_SMARTCARD_CAMPAIGNS_KEY, JSON.stringify(uniqueIds));
      window.dispatchEvent(new CustomEvent(IGNORED_SMARTCARD_CAMPAIGNS_EVENT));
    }
  };

  const saveAcknowledgedSponsorshipIds = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    setAcknowledgedSponsorshipIds(uniqueIds);

    if (typeof window !== "undefined") {
      localStorage.setItem(ACKNOWLEDGED_SPONSORSHIP_KEY, JSON.stringify(uniqueIds));
    }
  };

  const pulse = useMemo(() => {
    const active = currentCampaigns.filter((c) => c.status === "veiculando");
    const today = new Date(nowPulse);
    const summary = getCampaignIntelligenceSummary(currentCampaigns, { isAdmin: canViewOperationalInfo, today });
    const attention = [...summary.attention, ...summary.materialPending, ...summary.sponsorshipActive];
    const acknowledgedSponsorships = new Set(acknowledgedSponsorshipIds);
    const sponsorshipByCampaign = new Map<string, SponsorshipSmartAlert>();

    if (isAdmin) {
      sponsorshipAnnouncements.forEach((announcement) => {
        if (!announcement.campaign_id || acknowledgedSponsorships.has(announcement.id)) return;

        const createdAt = new Date(announcement.created_at);
        if (Number.isNaN(createdAt.getTime())) return;

        const ageHours = Math.max(0, (today.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
        if (ageHours < SPONSORSHIP_SMARTCARD_HOURS) return;

        const existing = sponsorshipByCampaign.get(announcement.campaign_id);
        if (!existing || ageHours > existing.ageHours) {
          sponsorshipByCampaign.set(announcement.campaign_id, {
            ...announcement,
            campaign_id: announcement.campaign_id,
            ageHours,
          });
        }
      });
    }

    const scoredCampaigns = currentCampaigns
      .filter((campaign) => campaign.status !== "finalizada")
      .map((campaign) => {
        const sponsorshipAlert = sponsorshipByCampaign.get(campaign.id);

        return {
          campaign,
          sponsorshipAlert,
          status: getCampaignIntelligence(campaign, {
            isAdmin: canViewOperationalInfo,
            today,
            boostStatus: sponsorshipAlert ? "sponsorship" : null,
            sponsorshipStartedAt: sponsorshipAlert?.created_at,
            sponsorshipAcknowledged: false,
          }),
          endAt: campaign.endDate ? getSaoPauloEndOfDay(campaign.endDate) : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort(
        (a, b) =>
          b.status.priorityScore - a.status.priorityScore ||
          a.status.rank - b.status.rank ||
          b.status.underAbsolute - a.status.underAbsolute ||
          a.endAt - b.endAt
      );

    const ignoredIds = isAdmin ? new Set(ignoredCampaignIds) : new Set<string>();
    const visibleScoredCampaigns = scoredCampaigns.filter((item) => !ignoredIds.has(item.campaign.id));
    const focus = visibleScoredCampaigns[0] || null;

    return {
      active,
      delivered: summary.delivered,
      almostDelivered: summary.almostDelivered,
      attention,
      focus,
    };
  }, [acknowledgedSponsorshipIds, canViewOperationalInfo, currentCampaigns, ignoredCampaignIds, isAdmin, nowPulse, sponsorshipAnnouncements]);

  const focusCampaign = pulse.focus?.campaign;
  const focusStatus = pulse.focus?.status;
  const focusSponsorshipAlert = pulse.focus?.sponsorshipAlert;
  const FocusIcon = focusStatus ? statusIcons[focusStatus.status] : Sparkles;
  const isImmediateFocus = Boolean(canViewOperationalInfo && focusStatus?.priorityLevel === "immediate_action");
  const needsSmartCardAcknowledgement = Boolean(focusSponsorshipAlert && focusStatus?.needsAcknowledgement);
  const smartCardTone = isImmediateFocus || (canViewOperationalInfo && (focusStatus?.status === "attention" || focusStatus?.isCritical)) ? "danger" : focusStatus?.tone;
  const toneStyles = getHeroToneStyles(smartCardTone);

  const revealItem = {
    hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  };

  useEffect(() => {
    if (!focusCampaign?.endDate) return;

    const tick = () => {
      const now = new Date().getTime();
      const end = getSaoPauloEndOfDay(focusCampaign.endDate);
      const diff = Math.max(0, end - now);

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [focusCampaign?.id, focusCampaign?.endDate]);

  useEffect(() => {
    if (!isImmediateFocus || !focusCampaign || !focusStatus) return;

    const alertKey = `${focusCampaign.id}-${focusStatus.priorityLevel}-${focusSponsorshipAlert?.id || focusStatus.status}`;
    if (playedImmediateAlertsRef.current.has(alertKey)) return;

    playedImmediateAlertsRef.current.add(alertKey);

    if (typeof window === "undefined") return;

    try {
      window.navigator.vibrate?.([90, 60, 90]);
    } catch (_) {}

    const playSoftAlert = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const context = new AudioContextClass();
        if (context.state === "suspended") await context.resume();

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.12);
        oscillator.frequency.exponentialRampToValueAtTime(740, now + 0.24);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.4);
      } catch (_) {}
    };

    playSoftAlert();
  }, [focusCampaign, focusSponsorshipAlert?.id, focusStatus, isImmediateFocus]);

  const userName = user?.name?.split(" ")[0] || "Equipe";
  const advancedCount = pulse.delivered.length + pulse.almostDelivered.length;
  const headline = isAdmin
    ? `${pulse.attention.length > 0 ? `${pulse.attention.length} ponto${pulse.attention.length > 1 ? "s" : ""} pede acompanhamento` : "OPEC em bom ritmo"} hoje.`
    : advancedCount > 0
      ? `${advancedCount} campanha${advancedCount !== 1 ? "s" : ""} em fase avancada de entrega.`
      : "campanhas em acompanhamento pela OPEC.";
  const hasIgnoredCampaigns = isAdmin && ignoredCampaignIds.length > 0;
  const isFocusIgnored = Boolean(focusCampaign && ignoredCampaignIds.includes(focusCampaign.id));

  const ignoreFocusCampaign = () => {
    if (!focusCampaign) return;
    saveIgnoredCampaignIds([...ignoredCampaignIds, focusCampaign.id]);
  };

  const resetIgnoredCampaigns = () => {
    saveIgnoredCampaignIds([]);
  };

  const acknowledgeFocusSponsorship = () => {
    if (!focusSponsorshipAlert?.id || !focusCampaign?.id) return;
    const campaignSponsorshipIds = sponsorshipAnnouncements
      .filter((announcement) => announcement.campaign_id === focusCampaign.id)
      .map((announcement) => announcement.id);
    saveAcknowledgedSponsorshipIds([...acknowledgedSponsorshipIds, ...campaignSponsorshipIds, focusSponsorshipAlert.id]);
  };

  return (
    <motion.div
      initial={animationsReady ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animationsReady ? { duration: 0.7, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
      className="hero-live-surface relative flex items-center overflow-hidden rounded-[16px] p-4 text-white shadow-2xl sm:p-5 xl:rounded-[20px] xl:p-5 2xl:p-10"
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:54px_54px] opacity-45 [mask-image:radial-gradient(circle_at_62%_45%,black,transparent_78%)]" />
      <div className="absolute right-0 top-0 h-full w-1/3 translate-x-20 skew-x-[-20deg] bg-white/5" />
      <motion.div
        className="absolute bottom-[-70px] right-10 h-[340px] w-[340px] rounded-full bg-cyan-200/10 blur-[82px]"
        animate={animationsReady ? { x: [0, -28, 12, 0], y: [0, -12, 18, 0], opacity: [0.35, 0.7, 0.45, 0.35] } : { x: 0, y: 0, opacity: 0.35 }}
        transition={animationsReady ? { duration: 14, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
      />
      <motion.div
        className="absolute left-[34%] top-[-120px] h-[260px] w-[260px] rounded-full bg-[#FFB079]/10 blur-[74px]"
        animate={animationsReady ? { x: [0, 42, -16, 0], opacity: [0.15, 0.45, 0.25, 0.15] } : { x: 0, opacity: 0.15 }}
        transition={animationsReady ? { duration: 18, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -inset-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
          style={{ animation: animationsReady ? "heroShimmer 4s ease-in-out infinite" : "none", transform: "skewX(-20deg)" }}
        />
      </div>

      <motion.div
        className="relative z-10 flex w-full min-w-0 flex-col gap-4 xl:gap-4 2xl:gap-8"
        initial={animationsReady ? "hidden" : false}
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
        }}
      >
        <motion.div
          layout
          variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
          className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start"
        >
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60 backdrop-blur-md 2xl:mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              SmartCard
            </div>
            <h2 className="mb-1 text-xl font-semibold tracking-tight xl:text-[24px] 2xl:mb-2 2xl:text-[26px]">
              {greeting}, <span className="text-[#FFB079]">{userName}!</span>
            </h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={headline}
                initial={animationsReady ? { opacity: 0, y: 6, filter: "blur(4px)" } : false}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={animationsReady ? { duration: 0.35, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
                className="max-w-2xl text-xs font-medium text-white/65 xl:text-[13px] 2xl:text-sm"
              >
                {headline}
              </motion.p>
            </AnimatePresence>
            {hasIgnoredCampaigns && (
              <button
                type="button"
                onClick={resetIgnoredCampaigns}
                className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                title="Voltar campanhas ignoradas para o SmartCard"
              >
                <RotateCcw className="h-3 w-3" />
                Restaurar ignoradas
              </button>
            )}
          </div>

          <motion.div
            layout
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            className="grid grid-cols-3 gap-2 xl:w-[310px] 2xl:w-[430px]"
          >
            <PulseMetric animationsReady={animationsReady} label="Saudaveis" value={Math.max(pulse.active.length - pulse.attention.length, 0)} tone="blue" />
            <PulseMetric animationsReady={animationsReady} label="Fase avancada" value={pulse.delivered.length + pulse.almostDelivered.length} tone="green" />
            <PulseMetric animationsReady={animationsReady} label={canViewOperationalInfo ? "Acompanhar" : "Monitoradas"} value={canViewOperationalInfo ? pulse.attention.length : pulse.active.length} tone={canViewOperationalInfo && pulse.attention.length > 0 ? "red" : "slate"} />
          </motion.div>
        </motion.div>

        <motion.div
          layout
          variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
          className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(190px,320px)_minmax(0,1fr)] xl:items-stretch xl:gap-4 2xl:grid-cols-12 2xl:gap-8"
        >
          <motion.div
            layout
            whileHover={{ y: -2 }}
            className="hero-glass-tile col-span-1 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md sm:p-4 xl:gap-3 xl:px-4 2xl:col-span-3 2xl:gap-4 2xl:px-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 shadow-lg backdrop-blur-md xl:h-11 xl:w-11 xl:rounded-2xl 2xl:h-14 2xl:w-14">
              <Megaphone className="h-4 w-4 text-white xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
            </div>
            <div>
              <motion.p
                key={pulse.active.length}
                initial={animationsReady ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-bold tracking-tight xl:text-xl 2xl:text-2xl"
              >
                {pulse.active.length}
              </motion.p>
              <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-white/50 xl:text-[10px] 2xl:text-[11px]">Ativas</p>
            </div>
          </motion.div>

          {focusCampaign && focusStatus ? (
            <motion.div
              key={focusCampaign.id}
              layout
              initial={animationsReady ? { opacity: 0, x: 18, filter: "blur(8px)" } : false}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -18, filter: "blur(8px)" }}
              transition={animationsReady ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
                className={`hero-glass-tile relative col-span-1 flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-2xl border p-3 backdrop-blur-md sm:p-4 xl:px-4 2xl:col-span-9 2xl:px-6 ${toneStyles.panel} ${isImmediateFocus ? "smartcard-critical-pulse" : ""}`}
            >
              <motion.div
                className={`pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full blur-[42px] ${toneStyles.glow}`}
                animate={animationsReady ? { scale: [1, 1.2, 1], opacity: [0.55, 0.85, 0.55] } : { scale: 1, opacity: 0.55 }}
                transition={animationsReady ? { duration: 5, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
              />

              <motion.div
                className="relative z-10 grid h-full w-full min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center 2xl:gap-4"
                initial={animationsReady ? "hidden" : false}
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.06 } } }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 2xl:gap-4">
                  <motion.div variants={revealItem} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border xl:h-11 xl:w-11 xl:rounded-2xl 2xl:h-14 2xl:w-14 ${toneStyles.icon}`}>
                    <FocusIcon className="h-4 w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
                  </motion.div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <motion.div variants={revealItem} className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider 2xl:text-[11px] ${toneStyles.pill}`}>
                        {focusStatus.label}
                      </span>
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-black tabular-nums text-white/80">
                        PI {focusCampaign.piNumber || "N/D"}
                      </span>
                      {focusCampaign.endDate && (
                        <div className="flex items-center gap-1">
                          <TimerPill value={countdown.days} label="d" />
                          <span className="text-[10px] font-bold text-white/30">:</span>
                          <TimerPill value={String(countdown.hours).padStart(2, "0")} label="h" />
                          <span className="text-[10px] font-bold text-white/30">:</span>
                          <TimerPill value={String(countdown.minutes).padStart(2, "0")} label="m" />
                        </div>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={ignoreFocusCampaign}
                          disabled={isFocusIgnored}
                          className="inline-flex h-6 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-white/55 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          title="Ignorar esta campanha como prioridade do SmartCard"
                        >
                          <EyeOff className="h-3 w-3" />
                          Ignorar
                        </button>
                      )}
                    </motion.div>

                    <motion.p variants={revealItem} className="block w-full max-w-full truncate border-b border-white/10 pb-0.5 text-sm font-bold tracking-tight xl:text-[15px] 2xl:text-lg" title={focusCampaign.campaignName}>
                      {focusCampaign.campaignName}
                    </motion.p>
                    <motion.p variants={revealItem} className="mt-1 block w-full max-w-full truncate text-xs font-medium text-white/60">{focusStatus.message}</motion.p>
                    {needsSmartCardAcknowledgement && (
                      <motion.div
                        variants={revealItem}
                        className="mt-2 flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-red-200/20 bg-red-500/10 px-2.5 py-2 text-[11px] font-semibold text-red-50"
                      >
                        <BellRing className="h-3.5 w-3.5 shrink-0 text-red-100" />
                        <span className="min-w-0 flex-1 truncate">
                          Confirmacao pendente ha {Math.floor(focusSponsorshipAlert?.ageHours || 0)}h.
                        </span>
                        <button
                          type="button"
                          onClick={acknowledgeFocusSponsorship}
                          className="shrink-0 rounded-lg border border-white/15 bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white transition-all hover:bg-white/20"
                        >
                          Confirmar que vi
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>

                <motion.div variants={revealItem} className="flex h-full w-full min-w-0 flex-row flex-wrap items-center gap-2 xl:ml-auto xl:w-[330px] xl:shrink-0 xl:justify-end 2xl:w-auto 2xl:max-w-[460px] 2xl:flex-nowrap">
                  {focusCampaign.hasGamLink && (
                    canViewOperationalInfo ? (
                      <a href={focusCampaign.gamLink} target="_blank" rel="noreferrer" className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#1D1E2C] shadow-sm transition-colors hover:bg-gray-50 xl:h-9 xl:flex-none xl:px-2.5 xl:text-[11px] 2xl:h-10 2xl:px-5 2xl:text-xs">
                        <img src="/GAM.png" alt="Acessar GAM" className="block h-4 w-4 min-h-4 min-w-4 max-h-4 max-w-4 shrink-0 object-contain drop-shadow-sm 2xl:h-5 2xl:w-5 2xl:min-h-5 2xl:min-w-5 2xl:max-h-5 2xl:max-w-5" />
                        <span className="hidden 2xl:inline">Acessar GAM</span>
                        <span className="2xl:hidden">GAM</span>
                      </a>
                    ) : (
                      <AdminLock locked className="flex h-10 flex-1 xl:flex-none">
                        <div className="flex h-10 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#1D1E2C] shadow-sm xl:h-9 xl:flex-none xl:px-2.5 xl:text-[11px] 2xl:h-10 2xl:px-5 2xl:text-xs">
                          <img src="/GAM.png" alt="Acessar GAM" className="block h-4 w-4 min-h-4 min-w-4 max-h-4 max-w-4 shrink-0 object-contain drop-shadow-sm 2xl:h-5 2xl:w-5 2xl:min-h-5 2xl:min-w-5 2xl:max-h-5 2xl:max-w-5" />
                          <span className="hidden 2xl:inline">Acessar GAM</span>
                          <span className="2xl:hidden">GAM</span>
                        </div>
                      </AdminLock>
                    )
                  )}
                  {focusCampaign.dashLink && (
                    <a href={focusCampaign.dashLink} target="_blank" rel="noreferrer" className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/40 xl:h-9 xl:flex-none xl:px-2.5 xl:text-[11px] 2xl:h-10 2xl:px-5 2xl:text-xs">
                      <Target className="h-3.5 w-3.5" />
                      <span className="hidden 2xl:inline">Dashboard</span>
                      <span className="2xl:hidden">Dash</span>
                    </a>
                  )}
                  {!focusCampaign.dashLink && (
                    <a href="#campaign-table" className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/15 xl:h-9 xl:flex-none xl:px-2.5 xl:text-[11px] 2xl:h-10 2xl:px-5 2xl:text-xs">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="hidden 2xl:inline">Ver lista</span>
                      <span className="2xl:hidden">Lista</span>
                    </a>
                  )}
                  {focusCampaign.gmailLink && (
                    <a href={focusCampaign.gmailLink} target="_blank" rel="noreferrer" className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#1D1E2C] shadow-sm transition-colors hover:bg-gray-50 xl:h-9 xl:flex-none xl:px-2.5 xl:text-[11px] 2xl:h-10 2xl:px-5 2xl:text-xs">
                      <img src="/gmail.png" alt="Fluxo Gmail" className="block h-4 w-4 min-h-4 min-w-4 max-h-4 max-w-4 shrink-0 object-contain drop-shadow-sm 2xl:h-5 2xl:w-5 2xl:min-h-5 2xl:min-w-5 2xl:max-h-5 2xl:max-w-5" />
                      Fluxo
                    </a>
                  )}
                </motion.div>
              </motion.div>
            </motion.div>
          ) : (
            <div className="col-span-1 flex items-center rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md xl:col-span-9 xl:px-5 2xl:px-6">
              <span className="text-sm font-medium text-white/50">Nenhuma campanha ativa para destacar agora.</span>
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function PulseMetric({
  label,
  value,
  tone,
  animationsReady = true,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "red" | "slate";
  animationsReady?: boolean;
}) {
  const color =
    tone === "green"
      ? "bg-emerald-400/15 text-emerald-100 border-emerald-300/20"
      : tone === "red"
        ? "bg-red-400/15 text-red-100 border-red-300/20"
      : tone === "amber"
        ? "bg-amber-400/15 text-amber-100 border-amber-300/20"
        : tone === "blue"
          ? "bg-blue-400/15 text-blue-100 border-blue-300/20"
          : "bg-white/5 text-white/70 border-white/10";

  return (
    <motion.div layout whileHover={{ y: -2 }} className={`hero-glass-tile rounded-2xl border px-3 py-2 backdrop-blur-md ${color}`}>
      <motion.p key={value} initial={animationsReady ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} className="text-lg font-black tabular-nums leading-none">
        {value}
      </motion.p>
      <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.08em] opacity-70">{label}</p>
    </motion.div>
  );
}

function TimerPill({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-white/10 px-1.5 py-0.5">
      <span className="text-[11px] font-black tabular-nums text-white 2xl:text-xs">{value}</span>
      <span className="text-[8px] font-bold uppercase text-white/40">{label}</span>
    </div>
  );
}
