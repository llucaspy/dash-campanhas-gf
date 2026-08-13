"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { useCampaigns } from "../../context/CampaignContext";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, AlertTriangle, Target, Eye, Activity, ChevronDown, ChevronUp, Zap, Award, BarChart3, Shield } from "lucide-react";
import { calculateTotalImpressions, getCampaignIntelligence, getCampaignPacing } from "../../lib/campaignHealth";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";
import { getCampaignMonitoringInsight, getInventoryRedistributionSuggestion } from "../../lib/campaignMonitoring";

type ViewMode = "pacing" | "viewability" | "ranking";
type SortMode = "critical" | "best" | "alpha";

const confidenceLabels = {
  low: "baixa",
  medium: "media",
  high: "alta",
};

const inventorySignalLabels = {
  speed_up: "aumentar ritmo",
  slow_down: "reduzir ritmo",
  hold: "manter",
  watch: "acompanhar",
};

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

export function PerformanceChart({ animationsReady = true }: { animationsReady?: boolean }) {
  const { campaigns, canViewOperationalInfo } = useCampaigns();
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);
  const [viewMode, setViewMode] = useState<ViewMode>("pacing");
  const [sortMode, setSortMode] = useState<SortMode>("critical");
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);

  // ========== DADOS INTELIGENTES ==========
  const allCampaignData = useMemo(() => {
    const today = new Date();

    return currentCampaigns
      .filter(c => c.status === "veiculando" && c.startDate && c.endDate)
      .map(camp => {
        const start = new Date(camp.startDate);
        const end = new Date(camp.endDate);

        const pacing = getCampaignPacing(camp, today);
        const totalAim = pacing?.totalAim ?? calculateTotalImpressions(camp);
        const delivered = pacing?.delivered ?? (camp.deliveredImpressions || 0);
        const totalDuration = pacing?.totalDuration ?? 1;
        const passedDuration = pacing?.passedDuration ?? 0;
        const expectedPct = pacing?.expectedPct ?? 0;
        const actualPct = pacing?.actualPct ?? 0;
        const va = camp.viewabilityPercentage || 0;
        const daysLeft = pacing?.daysLeft ?? Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24)));
        const gap = pacing?.gap ?? actualPct - expectedPct;
        const intelligence = getCampaignIntelligence(camp, { isAdmin: canViewOperationalInfo, today });
        const monitoring = getCampaignMonitoringInsight(camp, today);

        // Projeção: se mantem o ritmo atual, onde vai terminar?
        const dailyRate = passedDuration > 0 ? actualPct / passedDuration : 0;
        const pacingProjection = Math.round(dailyRate * totalDuration);
        const projectedFinal = monitoring.projectedDeliveryPct ?? pacingProjection;

        let shortName = camp.campaignName;
        if (shortName.length > 22) shortName = shortName.substring(0, 20) + "…";

        return {
          id: camp.id,
          name: shortName,
          fullName: camp.campaignName,
          piNumber: camp.piNumber,
          esperado: expectedPct,
          entregue: actualPct,
          va,
          gap,
          daysLeft,
          healthScore: intelligence.score,
          priorityLevel: intelligence.priorityLevel,
          priorityScore: intelligence.priorityScore,
          projectedFinal,
          projectionSource: monitoring.projectedDeliveryPct !== null ? "historico" : "pacing",
          monitoring,
          lastDelta: Math.max(monitoring.lastDelta, 0),
          lastDeliveryPctDelta: monitoring.lastDeliveryPctDelta,
          monitoringConfidence: monitoring.confidence,
          inventorySignal: monitoring.inventorySignal,
          totalAim,
          delivered,
          status: intelligence.status,
          statusLabel: intelligence.label,
          isUnder: ["immediate_action", "watch_today", "adjust_pace"].includes(intelligence.priorityLevel),
          isCritical: intelligence.isCritical,
          isExcellent: ["delivered", "almost_delivered", "on_track"].includes(intelligence.status) && (pacing?.isExcellent ?? gap >= 0),
        };
      });
  }, [currentCampaigns, canViewOperationalInfo]);

  // Sorting inteligente
  const sortedData = useMemo(() => {
    const data = [...allCampaignData];
    switch (sortMode) {
      case "critical":
        data.sort((a, b) => a.gap - b.gap); // Piores primeiro
        break;
      case "best":
        data.sort((a, b) => b.gap - a.gap); // Melhores primeiro
        break;
      case "alpha":
        data.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
    }
    return showAllCampaigns ? data : data.slice(0, 10);
  }, [allCampaignData, sortMode, showAllCampaigns]);

  // ========== INSIGHTS INTELIGENTES AUTOMATIZADOS ==========
  const insights = useMemo(() => {
    if (allCampaignData.length === 0) return [];
    const results: { icon: any; label: string; color: string; bgColor: string }[] = [];

    const criticalCount = allCampaignData.filter(c => c.priorityLevel === "immediate_action" || c.priorityLevel === "watch_today").length;
    const excellentCount = allCampaignData.filter(c => c.isExcellent).length;
    const avgGap = Math.round(allCampaignData.reduce((a, c) => a + c.gap, 0) / allCampaignData.length);
    const lowVA = allCampaignData.filter(c => c.va > 0 && c.va < 50).length;
    const monitoredCount = allCampaignData.filter(c => c.monitoringConfidence !== "low").length;
    const evolvedCount = allCampaignData.filter(c => c.lastDelta > 0).length;

    if (monitoredCount > 0) {
      results.push({ icon: Activity, label: `${monitoredCount} com historico preditivo`, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-500/10 border-blue-200/60 dark:border-blue-500/20" });
    }
    if (evolvedCount > 0) {
      results.push({ icon: TrendingUp, label: `${evolvedCount} evoluiram na ultima atualizacao`, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20" });
    }
    if (criticalCount > 0) {
      results.push({ icon: AlertTriangle, label: `${criticalCount} campanha${criticalCount > 1 ? 's' : ''} para acompanhar`, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20" });
    }
    if (excellentCount > 0) {
      results.push({ icon: TrendingUp, label: `${excellentCount} no ritmo ou acima da meta`, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20" });
    }
    if (avgGap <= -25) {
      results.push({ icon: TrendingDown, label: `Gap médio de ${avgGap}% abaixo do esperado`, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20" });
    } else if (avgGap >= 0) {
      results.push({ icon: Zap, label: `Operação saudável: gap médio +${avgGap}%`, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-500/10 border-blue-200/60 dark:border-blue-500/20" });
    }
    if (lowVA > 0) {
      results.push({ icon: Eye, label: `${lowVA} com viewability abaixo de 50%`, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-500/10 border-purple-200/60 dark:border-purple-500/20" });
    }

    return results;
  }, [allCampaignData]);

  const inventorySuggestion = useMemo(() => {
    return getInventoryRedistributionSuggestion(allCampaignData.map((campaign) => campaign.monitoring));
  }, [allCampaignData]);

  // Dados de evolução geral
  const overviewData = useMemo(() => {
    const totalContracted = currentCampaigns.reduce((acc, c) => {
      return acc + calculateTotalImpressions(c);
    }, 0);
    const totalDelivered = currentCampaigns.reduce((acc, c) => acc + (c.deliveredImpressions || 0), 0);
    const deliveryPct = totalContracted > 0 ? Math.round((totalDelivered / totalContracted) * 100) : 0;
    const activeCampaigns = allCampaignData.length;
    const avgHealth = activeCampaigns > 0 ? Math.round(allCampaignData.reduce((a, c) => a + c.healthScore, 0) / activeCampaigns) : 0;
    const monitoredCampaigns = allCampaignData.filter((campaign) => campaign.monitoringConfidence !== "low").length;

    return { totalContracted, totalDelivered, deliveryPct, activeCampaigns, avgHealth, monitoredCampaigns };
  }, [currentCampaigns, allCampaignData]);

  // Escolha de dados de gráfico baseado no modo
  const chartDataKey = viewMode === "viewability" ? "va" : "entregue";
  const chartRefKey = viewMode === "viewability" ? undefined : "esperado";

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-white dark:bg-[#1a1b2e] rounded-2xl border border-[#E9EDF5] dark:border-white/10 shadow-2xl p-4 min-w-[220px] backdrop-blur-md">
          <p className="text-xs font-black text-[#1D1E2C] dark:text-white mb-1">{data?.fullName}</p>
          <p className="text-[9px] text-[#A1A1AA] mb-3 font-semibold">PI {data?.piNumber}</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Pacing Esperado</span>
              <span className="font-bold text-[#355CFF]">{data?.esperado}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Entregue</span>
              <span className={`font-bold ${data?.isUnder ? "text-[#EF4444]" : "text-[#22C55E]"}`}>{data?.entregue}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Gap</span>
              <span className={`font-black ${data?.gap >= 0 ? "text-emerald-500" : data?.gap > -25 ? "text-amber-500" : "text-red-500"}`}>
                {data?.gap >= 0 ? "+" : ""}{data?.gap}%
              </span>
            </div>
            <div className="w-full h-px bg-[#E9EDF5] dark:bg-white/10" />
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Viewability</span>
              <span className="font-bold text-[#6366F1]">{data?.va}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Projeção Final</span>
              <span className={`font-black ${data?.projectedFinal >= 100 ? "text-emerald-500" : "text-amber-500"}`}>{data?.projectedFinal}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Base</span>
              <span className="font-bold text-[#1D1E2C] dark:text-white">{data?.projectionSource === "historico" ? "historico" : "pacing"}</span>
            </div>
            {data?.lastDelta > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#71717A] dark:text-white/50">Ultima atualizacao</span>
                <span className="font-black text-emerald-500">+{formatNumber(data.lastDelta)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Confianca</span>
              <span className="font-bold text-[#1D1E2C] dark:text-white">{confidenceLabels[data?.monitoringConfidence || "low"]}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Inventario</span>
              <span className="font-bold text-[#355CFF]">{inventorySignalLabels[data?.inventorySignal || "hold"]}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A] dark:text-white/50">Dias Restantes</span>
              <span className={`font-bold ${data?.daysLeft <= 3 ? "text-red-500" : "text-[#1D1E2C] dark:text-white"}`}>{data?.daysLeft}d</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const viewModes: { key: ViewMode; label: string; icon: any }[] = [
    { key: "pacing", label: "Pacing", icon: Activity },
    { key: "viewability", label: "Viewability", icon: Eye },
    { key: "ranking", label: "Ranking", icon: Award },
  ];

  const sortModes: { key: SortMode; label: string }[] = [
    { key: "critical", label: "Acompanhar primeiro" },
    { key: "best", label: "Melhores primeiro" },
    { key: "alpha", label: "Alfabético" },
  ];

  return (
    <motion.div
      initial={animationsReady ? { opacity: 0, y: 30 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animationsReady ? { delay: 0.2, duration: 0.5, type: "spring", stiffness: 100 } : { duration: 0 }}
      className="min-h-0 min-w-0 max-h-full overflow-hidden bg-white dark:bg-[#0F1117] rounded-[22px] 2xl:rounded-[32px] border border-[#E9EDF5] dark:border-white/10 p-4 2xl:p-8 shadow-sm flex flex-col gap-4 2xl:gap-5 h-full hover:shadow-xl hover:shadow-[#355CFF]/5 transition-shadow duration-500"
    >
      {/* Header com Tabs de Modo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h3 className="text-base lg:text-lg font-bold text-[#1D1E2C] dark:text-white">Performance Inteligente</h3>
          <p className="text-[10px] lg:text-xs text-[#A1A1AA] mt-0.5">
            {allCampaignData.length} campanhas ativas • Análise em tempo real
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-1.5 bg-[#F5F7FB] dark:bg-white/5 p-1 rounded-xl">
          {viewModes.map(mode => (
            <button
              key={mode.key}
              onClick={() => setViewMode(mode.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                viewMode === mode.key
                  ? "bg-white dark:bg-white/10 text-[#355CFF] shadow-sm border border-[#E9EDF5] dark:border-white/10"
                  : "text-[#71717A] hover:text-[#1D1E2C] dark:hover:text-white"
              }`}
            >
              <mode.icon className="w-3 h-3" />
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas Resumo Inteligentes */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 2xl:gap-3 shrink-0">
        <div className="bg-[#F8FAFC] dark:bg-white/5 border border-[#F1F5F9] dark:border-white/10 rounded-xl px-3 lg:px-4 py-2.5 flex flex-col">
          <span className="text-[8px] lg:text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wider">Entrega Global</span>
          <div className="flex items-end gap-2 mt-1">
            <span className={`text-lg lg:text-xl font-black ${overviewData.deliveryPct < 50 ? "text-[#EF4444]" : overviewData.deliveryPct < 80 ? "text-[#FB923C]" : "text-[#22C55E]"}`}>
              {overviewData.deliveryPct}%
            </span>
          </div>
          <div className="w-full bg-[#E9EDF5] dark:bg-white/10 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <motion.div
              initial={animationsReady ? { width: 0 } : false}
              animate={{ width: `${Math.min(overviewData.deliveryPct, 100)}%` }}
              transition={animationsReady ? { duration: 1.5, ease: "easeOut", delay: 0.5 } : { duration: 0 }}
              className={`h-full rounded-full ${overviewData.deliveryPct < 50 ? "bg-[#EF4444]" : overviewData.deliveryPct < 80 ? "bg-gradient-to-r from-[#FB923C] to-[#F59E0B]" : "bg-gradient-to-r from-[#22C55E] to-[#10B981]"}`}
            />
          </div>
        </div>

        <div className="bg-[#F8FAFC] dark:bg-white/5 border border-[#F1F5F9] dark:border-white/10 rounded-xl px-3 lg:px-4 py-2.5 flex flex-col">
          <span className="text-[8px] lg:text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wider">Saúde Média</span>
          <div className="flex items-center gap-2 mt-1">
            <Shield className={`w-4 h-4 ${overviewData.avgHealth >= 75 ? "text-emerald-500" : overviewData.avgHealth >= 50 ? "text-amber-500" : "text-red-500"}`} />
            <span className={`text-lg lg:text-xl font-black ${overviewData.avgHealth >= 75 ? "text-emerald-500" : overviewData.avgHealth >= 50 ? "text-amber-500" : "text-red-500"}`}>
              {overviewData.avgHealth}
            </span>
            <span className="text-[9px] text-[#A1A1AA] font-semibold">/100</span>
          </div>
        </div>

        <div className="bg-[#F8FAFC] dark:bg-white/5 border border-[#F1F5F9] dark:border-white/10 rounded-xl px-3 lg:px-4 py-2.5 flex flex-col">
          <span className="text-[8px] lg:text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wider">Impressões</span>
          <div className="flex flex-col mt-1">
            <span className="text-sm lg:text-base font-black text-[#1D1E2C] dark:text-white leading-tight">{overviewData.totalDelivered.toLocaleString('pt-BR')}</span>
            <span className="text-[9px] text-[#A1A1AA]">de {overviewData.totalContracted.toLocaleString('pt-BR')}</span>
          </div>
        </div>

        <div className="bg-[#F8FAFC] dark:bg-white/5 border border-[#F1F5F9] dark:border-white/10 rounded-xl px-3 lg:px-4 py-2.5 flex flex-col">
          <span className="text-[8px] lg:text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wider">Ativas</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg lg:text-xl font-black text-[#355CFF]">{overviewData.activeCampaigns}</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <span className="mt-1 text-[9px] font-semibold text-[#A1A1AA]">
            {overviewData.monitoredCampaigns} com previsao
          </span>
        </div>
      </div>

      {/* Insights Inteligentes Auto-Gerados */}
      <AnimatePresence mode="wait">
        {insights.length > 0 && (
          <motion.div
            initial={animationsReady ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: "auto" }}
            className="flex flex-wrap gap-2 shrink-0"
          >
            {insights.map((insight, i) => (
              <motion.div
                key={i}
                initial={animationsReady ? { opacity: 0, x: -10 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={animationsReady ? { delay: i * 0.1 } : { duration: 0 }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold ${insight.bgColor} ${insight.color}`}
              >
                <insight.icon className="w-3 h-3" />
                {insight.label}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {inventorySuggestion && (
        <motion.div
          initial={animationsReady ? { opacity: 0, y: -6 } : false}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 rounded-xl border border-[#D9E3FF] bg-[#F8FAFF] px-3 py-2.5 dark:border-blue-500/20 dark:bg-blue-500/10"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#355CFF] shadow-sm dark:bg-white/10">
              <Target className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#355CFF]">Disputa por inventario</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-[#64748B] dark:bg-white/10 dark:text-white/60">
                  confianca {confidenceLabels[inventorySuggestion.confidence]}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold leading-5 text-[#1D1E2C] dark:text-white">{inventorySuggestion.message}</p>
              <p className="text-[10px] font-semibold leading-4 text-[#64748B] dark:text-white/55">{inventorySuggestion.caution}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Controles de Ordenação */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-1.5 bg-[#F5F7FB] dark:bg-white/5 px-3 py-1.5 rounded-xl">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#355CFF]" />
            <span className="text-[9px] font-bold text-[#71717A]">Esperado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span className="text-[9px] font-bold text-[#71717A]">Entregue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="text-[9px] font-bold text-[#71717A]">Under</span>
          </div>
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="w-full sm:w-auto text-[10px] font-bold text-[#71717A] dark:text-white/50 bg-[#F5F7FB] dark:bg-white/5 border border-[#E9EDF5] dark:border-white/10 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-[#355CFF]/30 transition-colors"
        >
          {sortModes.map(mode => (
            <option key={mode.key} value={mode.key}>{mode.label}</option>
          ))}
        </select>
      </div>

      {/* Gráfico Principal */}
      <div className="flex-1 basis-0 w-full min-w-0 min-h-0 overflow-hidden">
        {sortedData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#A1A1AA]">
            <p className="text-sm font-bold">Nenhuma campanha ativa para visualizar.</p>
          </div>
        ) : viewMode === "ranking" ? (
          // MODO RANKING: Lista visual tipo leaderboard
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="min-h-0 flex-1 basis-0 space-y-2 overflow-y-auto overflow-x-hidden pr-1 [&::-webkit-scrollbar]:hidden">
              {sortedData.map((camp, i) => (
                <motion.div
                  key={camp.id}
                  initial={animationsReady ? { opacity: 0, x: -15 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={animationsReady ? { delay: i * 0.05 } : { duration: 0 }}
                  className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 p-3 bg-[#F8FAFC] dark:bg-white/5 border border-[#F1F5F9] dark:border-white/10 rounded-xl hover:bg-[#F0F4FF] dark:hover:bg-white/10 transition-colors group sm:grid-cols-[28px_minmax(0,1fr)_minmax(96px,144px)_auto]"
                >
                  {/* Posição */}
                  <span className={`text-sm font-black min-w-[24px] text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-[#A1A1AA]"}`}>
                    #{i + 1}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1D1E2C] dark:text-white truncate">{camp.fullName}</p>
                    <p className="text-[9px] text-[#A1A1AA]">
                      PI {camp.piNumber} • {camp.daysLeft}d restantes
                      {camp.lastDelta > 0 ? ` • +${formatNumber(camp.lastDelta)} ult. atualizacao` : ""}
                    </p>
                  </div>

                  {/* Barra de pacing visual */}
                  <div className="col-start-2 w-full min-w-0 sm:col-start-auto">
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-[#A1A1AA]">{camp.entregue}%</span>
                      <span className="text-[#A1A1AA]">{camp.esperado}%</span>
                    </div>
                    <div className="w-full bg-[#E9EDF5] dark:bg-white/10 rounded-full h-1.5 relative overflow-hidden">
                      <div className="absolute inset-0 h-full bg-[#355CFF]/10 rounded-full" style={{ width: `${Math.min(camp.esperado, 100)}%` }} />
                      <motion.div
                        initial={animationsReady ? { width: 0 } : false}
                        animate={{ width: `${Math.min(camp.entregue, 100)}%` }}
                        transition={animationsReady ? { duration: 0.8, delay: i * 0.05 } : { duration: 0 }}
                        className={`relative h-full rounded-full ${camp.isUnder ? "bg-[#EF4444]" : "bg-[#22C55E]"}`}
                      />
                    </div>
                  </div>

                  {/* Score */}
                  <div className={`justify-self-end flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${
                    camp.gap >= 0 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : camp.gap > -25 ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                    : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  }`}>
                    {camp.gap >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {camp.gap >= 0 ? "+" : ""}{camp.gap}%
                  </div>
                </motion.div>
              ))}
            </div>

            {allCampaignData.length > 10 && (
              <button
                onClick={() => setShowAllCampaigns(!showAllCampaigns)}
                className="mt-2 flex shrink-0 items-center justify-center gap-1.5 py-1 text-[10px] font-bold text-[#355CFF] transition-colors hover:text-[#2B4CF2]"
              >
                {showAllCampaigns ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllCampaigns ? "Recolher" : `Ver todas (${allCampaignData.length})`}
              </button>
            )}
          </div>
        ) : (
          // MODO PACING/VIEWABILITY: Gráfico de barras
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#71717A", fontSize: 9, fontWeight: 600 }}
                dy={10}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={55}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#A1A1AA", fontSize: 10, fontWeight: 500 }}
                tickFormatter={(value) => `${value}%`}
                domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax / 10) * 10 + 10)]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(53, 92, 255, 0.03)" }} />
              <ReferenceLine y={100} stroke="#A1A1AA" strokeDasharray="6 4" strokeWidth={1} label={{ value: "Meta 100%", position: "insideTopRight", fill: "#A1A1AA", fontSize: 9, fontWeight: 600 }} />
              
              {viewMode === "pacing" && (
                <Bar dataKey="esperado" radius={[4, 4, 0, 0]} fill="#355CFF" opacity={0.12} barSize={18} animationDuration={animationsReady ? 1200 : 0} animationEasing="ease-out" />
              )}
              
              <Bar dataKey={chartDataKey} radius={[4, 4, 0, 0]} barSize={18} animationDuration={animationsReady ? 1500 : 0} animationEasing="ease-out">
                {sortedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      viewMode === "viewability"
                        ? (entry.va >= 70 ? "#6366F1" : entry.va >= 50 ? "#F59E0B" : "#EF4444")
                        : (entry.isUnder ? "#EF4444" : "#22C55E")
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Expandir / Recolher */}
      {viewMode !== "ranking" && allCampaignData.length > 10 && (
        <button
          onClick={() => setShowAllCampaigns(!showAllCampaigns)}
          className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#355CFF] hover:text-[#2B4CF2] transition-colors py-1 shrink-0"
        >
          {showAllCampaigns ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showAllCampaigns ? "Recolher" : `Ver todas (${allCampaignData.length})`}
        </button>
      )}
    </motion.div>
  );
}
