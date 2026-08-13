import type { Campaign } from "../context/CampaignContext";
import { calculateTotalImpressions, getCampaignIntelligence } from "./campaignHealth";
import { splitCampaignsByArchive } from "./campaignArchive";

export type AssistantMood = "stressed" | "thinking" | "calm";
export type AssistantInsightKind = "urgent" | "watch" | "pace" | "delivery" | "healthy";

export interface AssistantInsight {
  id: string;
  campaignId: string;
  kind: AssistantInsightKind;
  title: string;
  campaignName?: string;
  piNumber?: string;
  dashLink?: string;
  gamLink?: string;
  hasGamLink?: boolean;
  gmailLink?: string;
  pdfUrl?: string;
  message: string;
  action: string;
  priorityScore: number;
  deliveryPct: number;
  expectedPct: number | null;
  gap: number | null;
  daysToEnd: number | null;
  dailyNeed: number;
  totalAim: number;
  delivered: number;
  underAbsolute: number;
}

export interface AssistantAnswer {
  content: string;
  relatedInsightIds: string[];
  intent: "agenda" | "campaign" | "delivery" | "executive" | "help" | "needs" | "overdelivery" | "pacing" | "priority" | "status";
}

export interface AssistantReport {
  mood: AssistantMood;
  moodLabel: string;
  summary: string;
  counts: {
    active: number;
    immediate: number;
    watch: number;
    adjust: number;
    almostDone: number;
    done: number;
    healthy: number;
  };
  insights: AssistantInsight[];
  allInsights: AssistantInsight[];
  quickReplies: string[];
}

function formatNumber(value: number) {
  return Math.max(0, Math.round(value)).toLocaleString("pt-BR");
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getDailyNeed(campaign: Campaign, delivered: number, daysToEnd: number | null) {
  const totalAim = calculateTotalImpressions(campaign);
  const remaining = Math.max(0, totalAim - delivered);
  const divisor = Math.max(1, daysToEnd === null ? 1 : daysToEnd + 1);
  return Math.ceil(remaining / divisor);
}

function getAssistantTitle(insight: AssistantInsight) {
  if (insight.kind === "urgent") return "Verificar primeiro";
  if (insight.kind === "watch") return "Acompanhar hoje";
  if (insight.kind === "pace") return "Ajuste de ritmo";
  if (insight.kind === "delivery") return insight.title === "Entrega concluída" ? "Entregue" : "Quase entregue";
  return "No ritmo";
}

function formatInsightBlock(insight: AssistantInsight, index: number) {
  const pi = insight.piNumber ? `PI ${insight.piNumber}` : "PI não informado";
  const pacing =
    insight.expectedPct !== null && insight.gap !== null
      ? `Entrega ${insight.deliveryPct}% vs ${insight.expectedPct}% esperado. Gap ${insight.gap >= 0 ? "+" : ""}${insight.gap}%.`
      : insight.message;

  return [
    `${index + 1}. ${insight.campaignName || "Campanha"}`,
    `   ${pi} | ${getAssistantTitle(insight)}`,
    `   Leitura: ${pacing}`,
    `   Próximo passo: ${insight.action}`,
  ].join("\n");
}

function formatInsightList(intro: string, insights: AssistantInsight[], empty: string, limit = 5) {
  if (!insights.length) return empty;

  const visible = insights.slice(0, limit);
  const hiddenCount = Math.max(0, insights.length - visible.length);
  const footer = hiddenCount > 0 ? `\n\nMais ${hiddenCount} ${pluralize(hiddenCount, "campanha ficou", "campanhas ficaram")} para consulta, mas deixei a lista curta para leitura rápida.` : "";

  return [intro, ...visible.map(formatInsightBlock)].join("\n\n") + footer;
}

function formatAgendaSection(title: string, insights: AssistantInsight[], empty: string, limit = 3) {
  if (!insights.length) return `${title}\n${empty}`;
  return formatInsightList(title, insights, empty, limit);
}

function getMood(counts: AssistantReport["counts"]): AssistantMood {
  if (counts.immediate > 0 || counts.watch >= 3) return "stressed";
  if (counts.watch > 0 || counts.adjust > 0) return "thinking";
  return "calm";
}

function findCampaignMatches(prompt: string, insights: AssistantInsight[]) {
  const normalized = normalizeText(prompt);
  const piMatch = normalized.match(/\b\d{4,}\b/);
  const ignoredTokens = ["campanha", "sobre", "qual", "como", "hoje", "ritmo", "entrega", "falta", "verifica"];
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !ignoredTokens.includes(token));

  return insights
    .map((insight) => {
      const name = normalizeText(insight.campaignName);
      const pi = normalizeText(insight.piNumber);
      let score = 0;

      if (piMatch && pi.includes(piMatch[0])) score += 10;
      tokens.forEach((token) => {
        if (name.includes(token)) score += 2;
        if (pi.includes(token)) score += 4;
      });

      return { insight, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.insight.priorityScore - a.insight.priorityScore)
    .map((item) => item.insight);
}

function buildInsight(campaign: Campaign, isAdmin: boolean, today: Date): AssistantInsight {
  const intelligence = getCampaignIntelligence(campaign, { isAdmin, today });
  const dailyNeed = getDailyNeed(campaign, intelligence.delivered, intelligence.daysToEnd);
  const title =
    intelligence.priorityLevel === "immediate_action"
      ? "Ação imediata"
      : intelligence.priorityLevel === "watch_today"
        ? "Acompanhar hoje"
        : intelligence.priorityLevel === "adjust_pace"
          ? "Ajustar ritmo"
        : intelligence.priorityLevel === "almost_done"
          ? "Quase entregue"
          : intelligence.priorityLevel === "done"
              ? "Entrega concluída"
              : "Campanha saudável";

  const kind: AssistantInsightKind =
    intelligence.priorityLevel === "immediate_action"
      ? "urgent"
      : intelligence.priorityLevel === "watch_today"
        ? "watch"
        : intelligence.priorityLevel === "adjust_pace"
          ? "pace"
          : ["almost_done", "done"].includes(intelligence.priorityLevel)
            ? "delivery"
            : "healthy";

  const action =
    isAdmin && ["urgent", "watch", "pace"].includes(kind)
      ? `mirar cerca de ${formatNumber(dailyNeed)} impressões hoje e revisar o ritmo depois da leitura.`
      : kind === "delivery"
        ? "Bom ponto para atualizar executivo com progresso de entrega."
        : "Manter acompanhamento normal.";

  return {
    id: `${campaign.id}-${intelligence.priorityLevel}`,
    campaignId: campaign.id,
    kind,
    title,
    campaignName: campaign.campaignName,
    piNumber: campaign.piNumber,
    dashLink: campaign.dashLink,
    gamLink: campaign.gamLink,
    hasGamLink: campaign.hasGamLink,
    gmailLink: campaign.gmailLink,
    pdfUrl: campaign.pdfUrl,
    message: intelligence.message,
    action,
    priorityScore: intelligence.priorityScore,
    deliveryPct: intelligence.deliveryPct,
    expectedPct: intelligence.pacing?.expectedPct ?? null,
    gap: intelligence.pacing?.gap ?? null,
    daysToEnd: intelligence.daysToEnd,
    dailyNeed,
    totalAim: intelligence.totalAim,
    delivered: intelligence.delivered,
    underAbsolute: intelligence.underAbsolute,
  };
}

export function buildOpecAssistantReport(campaigns: Campaign[], options: { isAdmin?: boolean; today?: Date } = {}): AssistantReport {
  const isAdmin = Boolean(options.isAdmin);
  const today = options.today || new Date();
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);
  const activeCampaigns = currentCampaigns.filter((campaign) => campaign.status !== "finalizada");

  const insights = activeCampaigns
    .map((campaign) => buildInsight(campaign, isAdmin, today))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const counts = insights.reduce(
    (acc, insight) => {
      if (insight.kind === "urgent") acc.immediate += 1;
      if (insight.kind === "watch") acc.watch += 1;
      if (insight.kind === "pace") acc.adjust += 1;
      if (insight.kind === "delivery") {
        if (normalizeText(insight.title).includes("entrega concluida")) acc.done += 1;
        else acc.almostDone += 1;
      }
      if (insight.kind === "healthy") acc.healthy += 1;
      return acc;
    },
    {
      active: activeCampaigns.filter((campaign) => campaign.status === "veiculando").length,
      immediate: 0,
      watch: 0,
      adjust: 0,
      almostDone: 0,
      done: 0,
      healthy: 0,
    }
  );

  const mood = getMood(counts);
  const relevant = insights.filter((insight) => insight.kind !== "healthy").slice(0, 6);
  const top = relevant[0];
  const attentionCount = counts.immediate + counts.watch;
  const reviewCount = counts.adjust + counts.watch;
  const deliveryCount = counts.done + counts.almostDone;
  const summary =
    mood === "stressed"
      ? `${attentionCount} ${pluralize(attentionCount, "campanha precisa", "campanhas precisam")} de atenção hoje. Comece por ${top?.campaignName || "campanhas de maior prioridade"}.`
      : mood === "thinking"
        ? `${reviewCount} ${pluralize(reviewCount, "campanha merece", "campanhas merecem")} revisão com calma antes do fim do dia.`
        : `Operação em ritmo saudável. ${deliveryCount} ${pluralize(deliveryCount, "campanha entregue ou quase entregue", "campanhas entregues ou quase entregues")}.`;

  return {
    mood,
    moodLabel: mood === "stressed" ? "atenção necessária" : mood === "thinking" ? "em análise" : "operação estável",
    summary,
    counts,
    insights: relevant.length > 0 ? relevant : insights.slice(0, 6),
    allInsights: insights,
    quickReplies: [
      "Agenda OPEC do dia",
      "Prioridades de hoje",
      "Quanto falta entregar?",
      "Resumo para executivo",
      "Risco de overdelivery",
      "Campanhas saudáveis",
    ],
  };
}

export function createAssistantAnswer(
  prompt: string,
  report: AssistantReport,
  options: { lastInsightId?: string | null } = {}
): AssistantAnswer {
  const normalized = prompt.toLowerCase();
  const normalizedSimple = normalizeText(prompt);
  const allInsights = report.allInsights || report.insights;
  const urgent = allInsights.filter((insight) => insight.kind === "urgent" || insight.kind === "watch");
  const delivery = allInsights.filter((insight) => insight.kind === "delivery");
  const pace = allInsights.filter((insight) => insight.kind === "pace");
  const healthy = allInsights.filter((insight) => insight.kind === "healthy");
  const lastInsight = options.lastInsightId ? allInsights.find((insight) => insight.id === options.lastInsightId) : null;
  const wantsContext = /\b(essa|esse|ela|ele|nela|nele|dela|dele|mesma|mesmo|isso)\b/.test(normalizedSimple);
  const campaignMatches = wantsContext && lastInsight ? [lastInsight] : findCampaignMatches(prompt, allInsights);
  const pack = (
    content: string,
    relatedInsights: AssistantInsight[] = [],
    intent: AssistantAnswer["intent"] = "status"
  ): AssistantAnswer => ({
    content,
    relatedInsightIds: Array.from(new Set(relatedInsights.map((insight) => insight.id))),
    intent,
  });

  if (["oi", "ola", "help", "ajuda", "menu"].some((word) => normalizedSimple === normalizeText(word) || normalizedSimple.includes(normalizeText(word)))) {
    return pack([
      "Posso te ajudar com estas leituras:",
      "1. Agenda OPEC do dia\n   Organizo o que olhar agora, depois e o que pode virar reporte.",
      "2. Prioridades de hoje\n   Use PI ou nome da campanha. Eu explico o motivo e o próximo passo.",
      "3. Quanto falta entregar\n   Separo a necessidade diária por campanha.",
      "4. Resumo para executivo\n   Deixo a leitura mais apresentável e menos operacional.",
      "5. Risco de overdelivery\n   Busco campanhas que merecem cuidado de entrega.",
    ].join("\n\n"), [], "help");
  }

  if (campaignMatches.length > 0) {
    const selected = campaignMatches.slice(0, 3);
    if (normalized.includes("falta") || normalized.includes("necess") || normalized.includes("impress")) {
      return pack([
        selected.length === 1 ? "Necessidade estimada para essa campanha:" : "Necessidade estimada para as campanhas encontradas:",
        ...selected.map((item, index) =>
          [
            `${index + 1}. ${item.campaignName}`,
            `   PI ${item.piNumber || "não informado"} | ${item.deliveryPct}% entregue`,
            `   Falta total: ${formatNumber(Math.max(0, item.totalAim - item.delivered))} impressões.`,
            `   Ritmo seguro hoje: cerca de ${formatNumber(item.dailyNeed)} impressões.`,
          ].join("\n")
        ),
      ].join("\n\n"), selected, "needs");
    }

    return pack(formatInsightList(
      selected.length === 1 ? "Encontrei essa campanha:" : "Encontrei campanhas que batem com sua busca:",
      selected,
      "Não encontrei campanha com esse nome ou PI.",
      3
    ), selected, "campaign");
  }

  if (normalized.includes("agenda") || normalized.includes("rotina") || normalized.includes("dia")) {
    const agendaInsights = [...urgent.slice(0, 3), ...pace.slice(0, 2), ...delivery.slice(0, 2)];
    const content = [
      "Agenda OPEC do dia",
      "Eu organizaria a leitura nesta ordem:",
      formatAgendaSection("1. Começar agora", urgent, "Sem campanha urgente no momento.", 3),
      formatAgendaSection("2. Revisar depois da primeira leitura", pace, "Sem ajuste moderado separado agora.", 2),
      formatAgendaSection("3. Bom para reporte executivo", delivery, "Ainda sem campanhas boas para destacar em reporte.", 2),
    ].join("\n\n");

    return pack(content, agendaInsights, "agenda");
  }

  if (normalized.includes("executivo") || normalized.includes("resumo")) {
    const items = delivery.length ? delivery : report.insights.slice(0, 4);
    return pack(formatInsightList(
      `Resumo para apresentação\n\n${report.summary}\n\nEu destacaria estes pontos primeiro:`,
      items,
      "Ainda não encontrei campanhas prontas para destaque executivo. Eu manteria uma leitura geral do ritmo por enquanto.",
      4
    ), items, "executive");
  }

  if (normalized.includes("entreg") && !normalized.includes("falta")) {
    if (!delivery.length) return pack("Ainda não separei campanhas entregues ou quase entregues entre as prioridades de hoje.", [], "delivery");
    return pack(formatInsightList("Campanhas em melhor ponto de entrega hoje:", delivery, "Ainda não encontrei campanhas quase entregues.", 4), delivery, "delivery");
  }

  if (normalized.includes("falta") || normalized.includes("necess") || normalized.includes("impress")) {
    const items = [...urgent, ...pace, ...delivery]
      .filter((item) => item.totalAim > 0)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 6);

    if (!items.length) return pack("Não encontrei volume contratado suficiente para calcular necessidade diária agora.", [], "needs");

    return pack([
      "Necessidade de entrega estimada para hoje:",
      ...items.map((item, index) =>
        [
          `${index + 1}. ${item.campaignName}`,
          `   PI ${item.piNumber || "não informado"} | ${item.deliveryPct}% entregue`,
          `   Falta total: ${formatNumber(Math.max(0, item.totalAim - item.delivered))} impressões.`,
          `   Ritmo seguro hoje: cerca de ${formatNumber(item.dailyNeed)} impressões.`,
        ].join("\n")
      ),
    ].join("\n\n"), items, "needs");
  }

  if (normalized.includes("over") || normalized.includes("patro")) {
    const candidates = allInsights.filter((item) => item.message.toLowerCase().includes("over") || item.message.toLowerCase().includes("patro") || item.deliveryPct >= 100);
    if (!candidates.length) return pack("Não encontrei sinal forte de overdelivery ou patrocínio prolongado nas prioridades do momento.", [], "overdelivery");
    return pack(formatInsightList("Separei os pontos ligados a overdelivery ou patrocínio:", candidates, "Não encontrei sinal forte no momento.", 5), candidates, "overdelivery");
  }

  if (normalized.includes("ritmo") || normalized.includes("pacing")) {
    const items = [...urgent, ...pace].slice(0, 5);
    if (!items.length) return pack("O pacing geral parece controlado agora. Eu manteria leitura normal.", [], "pacing");
    return pack(formatInsightList("Leitura de ritmo para hoje:", items, "O pacing geral parece controlado agora.", 5), items, "pacing");
  }

  if (normalized.includes("saud") || normalized.includes("normal") || normalized.includes("tranquil")) {
    return pack(formatInsightList("Campanhas com leitura mais tranquila agora:", healthy, "Não encontrei campanhas saudáveis suficientes para destacar agora.", 5), healthy, "status");
  }

  if (normalized.includes("prior") || normalized.includes("acompanhar") || normalized.includes("hoje") || normalized.includes("primeiro")) {
    const items = urgent.length ? urgent : allInsights.slice(0, 5);
    return pack(formatInsightList("Separei as prioridades de hoje nesta ordem:", items, "Não encontrei campanhas relevantes agora.", 5), items, "priority");
  }

  const items = urgent.length ? urgent : report.insights.slice(0, 4);
  return pack([
    "Entendi. Ainda estou no MVP, então trabalho melhor quando a pergunta entra em uma destas leituras:",
    "Prioridades de hoje, quanto falta entregar, resumo para executivo, risco de overdelivery, campanhas saudáveis ou busca por nome/PI.",
    "",
    formatInsightList("De qualquer forma, deixei abaixo a leitura principal:", items, "Não encontrei campanhas relevantes agora.", 4),
  ].join("\n"), items, "status");
}

export function answerAssistantPrompt(prompt: string, report: AssistantReport) {
  return createAssistantAnswer(prompt, report).content;
}
