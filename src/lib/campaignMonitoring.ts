import type { Campaign, CampaignMetricSnapshot } from "../context/CampaignContext";
import { calculateTotalImpressions, getCampaignPacing } from "./campaignHealth";

const HOUR_MS = 1000 * 60 * 60;
const MAX_INTERVAL_HOURS = 240;
const MIN_INTERVAL_HOURS = 0.5;

export type MonitoringConfidence = "low" | "medium" | "high";
export type InventorySignal = "speed_up" | "slow_down" | "hold" | "watch";

export interface CampaignMonitoringInsight {
  campaignId: string;
  campaignName: string;
  sampleCount: number;
  lastRecordedAt: string | null;
  lastDelta: number;
  lastDeliveryPctDelta: number;
  averageHourlyGrowth: number | null;
  projectedDeliveredImpressions: number | null;
  projectedDeliveryPct: number | null;
  confidence: MonitoringConfidence;
  inventorySignal: InventorySignal;
  summary: string;
  caution: string;
  anomalyDetected: boolean;
}

export interface InventoryRedistributionSuggestion {
  fromCampaignId: string;
  toCampaignId: string;
  fromCampaignName: string;
  toCampaignName: string;
  confidence: MonitoringConfidence;
  message: string;
  caution: string;
}

function sortHistory(history?: CampaignMetricSnapshot[]) {
  return [...(history || [])]
    .filter((snapshot) => snapshot.recordedAt)
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function getConfidence(history: CampaignMetricSnapshot[], rates: number[]) {
  if (history.length < 2 || rates.length === 0) return "low" satisfies MonitoringConfidence;

  const newest = new Date(history[0].recordedAt).getTime();
  const oldest = new Date(history[history.length - 1].recordedAt).getTime();
  const spanHours = Math.max(0, (newest - oldest) / HOUR_MS);

  if (history.length >= 4 && rates.length >= 3 && spanHours >= 18) return "high";
  if (history.length >= 2 && rates.length >= 1 && spanHours >= 2) return "medium";
  return "low";
}

function getValidHourlyRates(history: CampaignMetricSnapshot[]) {
  const rates: number[] = [];

  for (let index = 0; index < history.length - 1; index += 1) {
    const newer = history[index];
    const older = history[index + 1];
    const hours = (new Date(newer.recordedAt).getTime() - new Date(older.recordedAt).getTime()) / HOUR_MS;
    const delta = newer.deliveredImpressions - older.deliveredImpressions;

    if (hours >= MIN_INTERVAL_HOURS && hours <= MAX_INTERVAL_HOURS && delta >= 0) {
      rates.push(delta / hours);
    }
  }

  return rates;
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}%`;
}

export function getCampaignMonitoringInsight(campaign: Campaign, today = new Date()): CampaignMonitoringInsight {
  const history = sortHistory(campaign.metricHistory);
  const latest = history[0];
  const lastDelta = latest?.deliveredDelta ?? 0;
  const lastDeliveryPctDelta = latest?.deliveryPctDelta ?? 0;
  const anomalyDetected = history.some((snapshot) => snapshot.deliveredDelta < 0);
  const rates = anomalyDetected ? [] : getValidHourlyRates(history);
  const averageHourlyGrowth = median(rates);
  const confidence = anomalyDetected ? "low" : getConfidence(history, rates);
  const pacing = getCampaignPacing(campaign, today);
  const totalImpressions = calculateTotalImpressions(campaign);
  const delivered = campaign.deliveredImpressions || 0;
  const currentDeliveryPct = totalImpressions > 0 ? Math.round((delivered / totalImpressions) * 100) : 0;
  const hoursRemaining = pacing ? Math.max(0, pacing.daysLeft * 24) : 0;
  const canProject = averageHourlyGrowth !== null && confidence !== "low" && totalImpressions > 0 && campaign.status === "veiculando";
  const projectedDeliveredImpressions = canProject ? Math.round(delivered + averageHourlyGrowth * hoursRemaining) : null;
  const projectedDeliveryPct = projectedDeliveredImpressions !== null ? Math.round((projectedDeliveredImpressions / totalImpressions) * 100) : null;

  let inventorySignal: InventorySignal = "hold";
  let summary = "Historico ainda em formacao.";
  let caution = "Aguardar pelo menos duas atualizacoes consistentes antes de recomendar ajuste de inventario.";

  if (anomalyDetected) {
    inventorySignal = "watch";
    summary = "Historico detectou reducao de entrega entre snapshots.";
    caution = "Validar se houve correcao manual antes de usar a previsao.";
  } else if (!pacing || campaign.status !== "veiculando") {
    inventorySignal = "watch";
    summary = "Campanha fora de veiculacao ativa para previsao automatica.";
    caution = "Sem recomendacao de disputa por inventario neste status.";
  } else if (confidence === "low") {
    inventorySignal = pacing.isCritical || currentDeliveryPct >= 110 ? "watch" : "hold";
    summary = "Pouca amostra para prever com seguranca.";
    caution = "A leitura atual usa apenas pacing; a previsao melhora apos novas atualizacoes.";
  } else if ((projectedDeliveryPct ?? currentDeliveryPct) >= 112 || (currentDeliveryPct >= 105 && pacing.daysLeft > 0)) {
    inventorySignal = "slow_down";
    summary = `Tendencia acima da meta: projecao em ${formatPercent(projectedDeliveryPct)}.`;
    caution = "Avaliar reducao gradual, confirmando reserva e prioridade no GAM antes de mexer no ritmo.";
  } else if ((projectedDeliveryPct ?? 100) <= 92 && pacing.gap <= -10 && pacing.daysLeft > 0) {
    inventorySignal = "speed_up";
    summary = `Tendencia abaixo do necessario: projecao em ${formatPercent(projectedDeliveryPct)}.`;
    caution = "Priorizar inventario apenas se houver disponibilidade real e sem prejudicar entregas criticas.";
  } else {
    inventorySignal = "hold";
    summary = `Ritmo sem desvio forte: projecao em ${formatPercent(projectedDeliveryPct)}.`;
    caution = "Manter acompanhamento; sem recomendacao automatica de troca de inventario.";
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    sampleCount: history.length,
    lastRecordedAt: latest?.recordedAt || null,
    lastDelta,
    lastDeliveryPctDelta,
    averageHourlyGrowth,
    projectedDeliveredImpressions,
    projectedDeliveryPct,
    confidence,
    inventorySignal,
    summary,
    caution,
    anomalyDetected,
  };
}

export function getInventoryRedistributionSuggestion(insights: CampaignMonitoringInsight[]): InventoryRedistributionSuggestion | null {
  const donors = insights
    .filter((insight) => insight.inventorySignal === "slow_down" && insight.confidence !== "low")
    .sort((a, b) => (b.projectedDeliveryPct || 0) - (a.projectedDeliveryPct || 0));

  const receivers = insights
    .filter((insight) => insight.inventorySignal === "speed_up" && insight.confidence !== "low")
    .sort((a, b) => (a.projectedDeliveryPct || 999) - (b.projectedDeliveryPct || 999));

  const donor = donors[0];
  const receiver = receivers.find((item) => item.campaignId !== donor?.campaignId);

  if (!donor || !receiver) return null;

  const confidence: MonitoringConfidence = donor.confidence === "high" && receiver.confidence === "high" ? "high" : "medium";

  return {
    fromCampaignId: donor.campaignId,
    toCampaignId: receiver.campaignId,
    fromCampaignName: donor.campaignName,
    toCampaignName: receiver.campaignName,
    confidence,
    message: `Sugestao cautelosa: avaliar reduzir o ritmo de ${donor.campaignName} e priorizar ${receiver.campaignName}.`,
    caution: `${donor.campaignName} projeta ${formatPercent(donor.projectedDeliveryPct)}; ${receiver.campaignName} projeta ${formatPercent(receiver.projectedDeliveryPct)}. Confirmar disponibilidade no GAM antes de alterar.`,
  };
}
