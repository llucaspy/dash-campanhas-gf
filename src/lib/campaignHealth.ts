import type { Campaign } from "../context/CampaignContext";

export const PACING_ATTENTION_GAP = 25;
export const PACING_CRITICAL_GAP = 35;
export const PACING_OVERDELIVERY_GAP = 30;
export const MATERIAL_GRACE_DAYS = 1;
export const SPONSORSHIP_SMARTCARD_HOURS = 24;

const IMMEDIATE_DAYS_TO_END = 2;
const WATCH_DAYS_TO_END = 5;
const IMMEDIATE_UNDER_ABSOLUTE = 100000;
const WATCH_UNDER_ABSOLUTE = 50000;
const IMMEDIATE_OVERDELIVERY_PCT = 110;

const DAY_MS = 1000 * 3600 * 24;

export type BoostStatus = "sponsorship" | "high" | "normal" | "low";
export type CampaignCoreStatus =
  | "delivered"
  | "almost_delivered"
  | "on_track"
  | "attention"
  | "material_pending"
  | "sponsorship_active";

export type CampaignTone = "success" | "info" | "warning" | "danger" | "neutral" | "sponsorship";
export type CampaignPriorityLevel = "immediate_action" | "watch_today" | "adjust_pace" | "almost_done" | "done" | "healthy";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignCoreStatus, string> = {
  delivered: "Entregue",
  almost_delivered: "Quase entregue",
  on_track: "No ritmo",
  attention: "Acompanhar",
  material_pending: "Pendente material",
  sponsorship_active: "Patrocinio ativo",
};

export const CAMPAIGN_PRIORITY_LABELS: Record<CampaignPriorityLevel, string> = {
  immediate_action: "Acao imediata",
  watch_today: "Acompanhar hoje",
  adjust_pace: "Ajustar ritmo",
  almost_done: "Quase entregue",
  done: "Entregue",
  healthy: "No ritmo",
};

export interface CampaignIntelligenceOptions {
  today?: Date;
  isAdmin?: boolean;
  boostStatus?: BoostStatus | null;
  sponsorshipStartedAt?: string | Date | null;
  sponsorshipAcknowledged?: boolean;
}

export interface CampaignIntelligence {
  status: CampaignCoreStatus;
  canonicalLabel: string;
  label: string;
  message: string;
  tone: CampaignTone;
  rank: number;
  score: number;
  priorityLevel: CampaignPriorityLevel;
  priorityLabel: string;
  priorityScore: number;
  isCritical: boolean;
  totalAim: number;
  delivered: number;
  deliveryPct: number;
  expectedDelivered: number;
  underAbsolute: number;
  overAbsolute: number;
  daysToStart: number | null;
  daysToEnd: number | null;
  sponsorshipAgeHours: number | null;
  needsAcknowledgement: boolean;
  pacing: ReturnType<typeof getCampaignPacing>;
}

export function calculateTotalImpressions(camp: Pick<Campaign, "paidPurchases" | "bonusPurchases">) {
  const paid = camp.paidPurchases.reduce((acc, p) => acc + (parseInt(p.volume.replace(/\./g, "")) || 0), 0);
  const bonus = camp.bonusPurchases.reduce((acc, p) => acc + (parseInt(p.volume.replace(/\./g, "")) || 0), 0);
  return paid + bonus;
}

export function getDeliveryPct(camp: Pick<Campaign, "paidPurchases" | "bonusPurchases" | "deliveredImpressions">) {
  const total = calculateTotalImpressions(camp);
  if (total <= 0) return 0;
  return Math.round(((camp.deliveredImpressions || 0) / total) * 100);
}

export function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseCampaignDate(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(value);
}

export function diffDays(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

export function getMaterialDelayDays(camp: Pick<Campaign, "startDate">, today = new Date()) {
  if (!camp.startDate) return 0;
  const parsedStart = parseCampaignDate(camp.startDate);
  if (!parsedStart) return 0;
  const start = dateOnly(parsedStart);
  const current = dateOnly(today);
  return Math.max(0, diffDays(start, current));
}

export function isMaterialCritical(camp: Pick<Campaign, "status" | "startDate">, today = new Date()) {
  return camp.status === "pendente_material" && getMaterialDelayDays(camp, today) > MATERIAL_GRACE_DAYS;
}

export function getCampaignPacing(camp: Campaign, today = new Date()) {
  if (!camp.startDate || !camp.endDate) return null;

  const start = parseCampaignDate(camp.startDate);
  const end = parseCampaignDate(camp.endDate);
  if (!start || !end) return null;

  const current = dateOnly(today);
  const totalAim = calculateTotalImpressions(camp);
  const delivered = camp.deliveredImpressions || 0;
  const totalDuration = Math.max(1, diffDays(start, end));
  const passedDuration = Math.min(Math.max(diffDays(start, current), 0), totalDuration);
  const daysLeft = Math.max(0, diffDays(current, end));

  const expectedPct = totalDuration > 0 ? Math.round((passedDuration / totalDuration) * 100) : 0;
  const actualPct = totalAim > 0 ? Math.round((delivered / totalAim) * 100) : 0;
  const gap = actualPct - expectedPct;

  return {
    totalAim,
    delivered,
    totalDuration,
    passedDuration,
    daysLeft,
    expectedPct,
    actualPct,
    expectedProgress: expectedPct / 100,
    actualProgress: actualPct / 100,
    gap,
    isUnder: gap <= -PACING_ATTENTION_GAP,
    isCritical: gap <= -PACING_CRITICAL_GAP,
    isOver: gap >= PACING_OVERDELIVERY_GAP,
    isExcellent: gap >= 0,
  };
}

function getPriorityRank(priorityLevel: CampaignPriorityLevel, isAdmin: boolean) {
  if (isAdmin) {
    if (priorityLevel === "immediate_action") return 0;
    if (priorityLevel === "watch_today") return 1;
    if (priorityLevel === "adjust_pace") return 2;
    if (priorityLevel === "almost_done") return 3;
    if (priorityLevel === "done") return 4;
    return 5;
  }

  if (priorityLevel === "done") return 0;
  if (priorityLevel === "almost_done") return 1;
  if (priorityLevel === "healthy") return 2;
  if (priorityLevel === "adjust_pace") return 3;
  if (priorityLevel === "watch_today") return 4;
  return 5;
}

function getHealthScore(status: CampaignCoreStatus, pacing: ReturnType<typeof getCampaignPacing>, isCritical: boolean) {
  if (status === "delivered") return 100;
  if (status === "almost_delivered") return 92;
  if (status === "sponsorship_active") return 62;
  if (status === "material_pending") return isCritical ? 42 : 58;
  if (status === "attention") return isCritical ? 35 : 62;
  if (!pacing) return 80;
  if (pacing.gap >= 0) return 90;
  if (pacing.gap >= -15) return 82;
  return 74;
}

function getDefaultPriorityLevel(status: CampaignCoreStatus, isAdmin: boolean, isCritical: boolean): CampaignPriorityLevel {
  if (status === "delivered") return "done";
  if (status === "almost_delivered") return "almost_done";
  if (status === "on_track") return "healthy";
  if (isAdmin && isCritical) return "immediate_action";
  if (status === "attention" || status === "material_pending" || status === "sponsorship_active") return "watch_today";
  return "healthy";
}

function getPriorityScore(
  priorityLevel: CampaignPriorityLevel,
  values: Pick<
    CampaignIntelligence,
    "pacing" | "totalAim" | "deliveryPct" | "daysToEnd" | "underAbsolute" | "overAbsolute" | "sponsorshipAgeHours"
  >,
  isAdmin: boolean
) {
  const adminBase: Record<CampaignPriorityLevel, number> = {
    immediate_action: 10000,
    watch_today: 8000,
    adjust_pace: 6200,
    almost_done: 4800,
    done: 3600,
    healthy: 1200,
  };

  const userBase: Record<CampaignPriorityLevel, number> = {
    done: 10000,
    almost_done: 8400,
    healthy: 6800,
    adjust_pace: 4200,
    watch_today: 3400,
    immediate_action: 3000,
  };

  const daysUrgency = values.daysToEnd !== null ? Math.max(0, 14 - Math.max(values.daysToEnd, 0)) * 45 : 0;
  const gapUrgency = values.pacing ? Math.max(0, -values.pacing.gap) * 48 : 0;
  const underUrgency = Math.min(1800, values.underAbsolute / 85);
  const overUrgency = isAdmin ? Math.min(1600, values.overAbsolute / 85) : 0;
  const sizeWeight = Math.min(700, values.totalAim / 12000);
  const deliveryWeight = ["done", "almost_done"].includes(priorityLevel) ? Math.min(1000, values.deliveryPct * 8) : 0;
  const sponsorshipWeight = isAdmin && values.sponsorshipAgeHours ? Math.min(900, values.sponsorshipAgeHours * 16) : 0;

  return Math.round(
    (isAdmin ? adminBase[priorityLevel] : userBase[priorityLevel]) +
      daysUrgency +
      gapUrgency +
      underUrgency +
      overUrgency +
      sizeWeight +
      deliveryWeight +
      sponsorshipWeight
  );
}

function getSponsorshipAgeHours(startedAt?: string | Date | null, today = new Date()) {
  if (!startedAt) return null;
  const date = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, (today.getTime() - date.getTime()) / (1000 * 60 * 60));
}

function buildCampaignIntelligence(
  status: CampaignCoreStatus,
  values: Omit<
    CampaignIntelligence,
    "status" | "canonicalLabel" | "label" | "rank" | "score" | "priorityLevel" | "priorityLabel" | "priorityScore"
  >,
  isAdmin: boolean,
  label?: string,
  priorityLevel?: CampaignPriorityLevel
): CampaignIntelligence {
  const resolvedPriorityLevel = priorityLevel || getDefaultPriorityLevel(status, isAdmin, values.isCritical);

  return {
    ...values,
    status,
    canonicalLabel: CAMPAIGN_STATUS_LABELS[status],
    label: label || CAMPAIGN_STATUS_LABELS[status],
    rank: getPriorityRank(resolvedPriorityLevel, isAdmin),
    score: getHealthScore(status, values.pacing, values.isCritical),
    priorityLevel: resolvedPriorityLevel,
    priorityLabel: CAMPAIGN_PRIORITY_LABELS[resolvedPriorityLevel],
    priorityScore: getPriorityScore(resolvedPriorityLevel, values, isAdmin),
  };
}

export function getCampaignIntelligence(camp: Campaign, options: CampaignIntelligenceOptions = {}): CampaignIntelligence {
  const today = options.today || new Date();
  const isAdmin = Boolean(options.isAdmin);
  const boostStatus = camp.status === "pausada" ? null : options.boostStatus ?? camp.boostStatus ?? null;
  const sponsorshipStartedAt = options.sponsorshipStartedAt ?? camp.boostStatusUpdatedAt ?? null;
  const totalAim = calculateTotalImpressions(camp);
  const delivered = camp.deliveredImpressions || 0;
  const deliveryPct = totalAim > 0 ? Math.round((delivered / totalAim) * 100) : 0;
  const pacing = camp.status === "veiculando" ? getCampaignPacing(camp, today) : null;
  const start = parseCampaignDate(camp.startDate);
  const end = parseCampaignDate(camp.endDate);
  const current = dateOnly(today);
  const daysToStart = start ? diffDays(current, start) : null;
  const daysToEnd = end ? diffDays(current, end) : null;
  const expectedDelivered = pacing ? Math.round(totalAim * pacing.expectedProgress) : 0;
  const underAbsolute = pacing ? Math.max(0, expectedDelivered - delivered) : 0;
  const overAbsolute = totalAim > 0 ? Math.max(0, delivered - totalAim) : 0;
  const sponsorshipAgeHours = getSponsorshipAgeHours(sponsorshipStartedAt, today);
  const needsSponsorshipAcknowledgement =
    Boolean(boostStatus === "sponsorship" && isAdmin && !options.sponsorshipAcknowledged) &&
    sponsorshipAgeHours !== null &&
    sponsorshipAgeHours >= SPONSORSHIP_SMARTCARD_HOURS;

  const base = {
    totalAim,
    delivered,
    deliveryPct,
    expectedDelivered,
    underAbsolute,
    overAbsolute,
    daysToStart,
    daysToEnd,
    sponsorshipAgeHours,
    needsAcknowledgement: false,
    pacing,
  };

  if (needsSponsorshipAcknowledgement) {
    const roundedHours = Math.floor(sponsorshipAgeHours || 0);

    return buildCampaignIntelligence(
      "attention",
      {
        ...base,
        sponsorshipAgeHours,
        needsAcknowledgement: true,
        message: `Patrocinio ativo ha ${roundedHours}h. Confirme acompanhamento e valide impressao entregue.`,
        tone: "danger",
        isCritical: true,
      },
      isAdmin,
      CAMPAIGN_PRIORITY_LABELS.immediate_action,
      "immediate_action"
    );
  }

  if (boostStatus === "sponsorship") {
    return buildCampaignIntelligence(
      "sponsorship_active",
      {
        ...base,
        message: isAdmin
          ? "Patrocinio ativo: acompanhe impressoes de perto para evitar overdelivery."
          : "Campanha em acompanhamento especial pela OPEC.",
        tone: isAdmin ? "danger" : "info",
        isCritical: isAdmin,
      },
      isAdmin,
      isAdmin ? undefined : "Acompanhamento especial",
      "watch_today"
    );
  }

  if (isAdmin && boostStatus === "high" && camp.status === "veiculando") {
    return buildCampaignIntelligence(
      "attention",
      {
        ...base,
        message: "Marcada como Padrao - Alta. Revisar ritmo e prioridade operacional com mais frequencia.",
        tone: "warning",
        isCritical: false,
      },
      isAdmin,
      undefined,
      "watch_today"
    );
  }

  if (isAdmin && camp.status === "veiculando" && totalAim > 0 && deliveryPct >= IMMEDIATE_OVERDELIVERY_PCT) {
    return buildCampaignIntelligence(
      "attention",
      {
        ...base,
        message: `${deliveryPct}% entregue. Validar ritmo para evitar overdelivery adicional.`,
        tone: "danger",
        isCritical: true,
      },
      isAdmin,
      CAMPAIGN_PRIORITY_LABELS.immediate_action,
      "immediate_action"
    );
  }

  if (totalAim > 0 && deliveryPct >= 100) {
    return buildCampaignIntelligence(
      "delivered",
      {
        ...base,
        message: isAdmin
          ? `${deliveryPct}% entregue. Validar saldo final e fechamento.`
          : "Meta de impressoes atingida. A OPEC segue acompanhando o fechamento.",
        tone: "success",
        isCritical: false,
      },
      isAdmin,
      undefined,
      "done"
    );
  }

  if (camp.status === "finalizada") {
    return buildCampaignIntelligence(
      "delivered",
      {
        ...base,
        message: "Campanha encerrada no painel.",
        tone: "success",
        isCritical: false,
      },
      isAdmin,
      undefined,
      "done"
    );
  }

  if (camp.status === "pendente_material") {
    const delayDays = getMaterialDelayDays(camp, today);
    const critical = isMaterialCritical(camp, today);

    return buildCampaignIntelligence(
      "material_pending",
      {
        ...base,
        message: isAdmin
          ? critical
            ? `Material pendente ha ${delayDays} dias. Acompanhar liberacao dos assets.`
            : "No aguardo de material para iniciar a veiculacao."
          : "Material em acompanhamento pela OPEC.",
        tone: critical && isAdmin ? "danger" : "warning",
        isCritical: critical && isAdmin,
      },
      isAdmin,
      critical && isAdmin ? CAMPAIGN_PRIORITY_LABELS.immediate_action : undefined,
      critical && isAdmin ? "immediate_action" : "watch_today"
    );
  }

  if (camp.status === "pausada") {
    return buildCampaignIntelligence(
      "attention",
      {
        ...base,
        message: isAdmin ? "Veiculacao pausada. Revisar proximo movimento." : "Campanha temporariamente em acompanhamento.",
        tone: "warning",
        isCritical: false,
      },
      isAdmin,
      undefined,
      isAdmin ? "watch_today" : "adjust_pace"
    );
  }

  if (isAdmin && pacing && deliveryPct >= 90 && deliveryPct < 100 && pacing.daysLeft <= IMMEDIATE_DAYS_TO_END && underAbsolute >= WATCH_UNDER_ABSOLUTE) {
    const priorityLevel: CampaignPriorityLevel = underAbsolute >= IMMEDIATE_UNDER_ABSOLUTE ? "immediate_action" : "watch_today";

    return buildCampaignIntelligence(
      "attention",
      {
        ...base,
        message: `${deliveryPct}% entregue, mas ainda faltam ${underAbsolute.toLocaleString("pt-BR")} impressoes perto do fim.`,
        tone: priorityLevel === "immediate_action" ? "danger" : "warning",
        isCritical: priorityLevel === "immediate_action",
      },
      isAdmin,
      priorityLevel === "immediate_action" ? CAMPAIGN_PRIORITY_LABELS.immediate_action : undefined,
      priorityLevel
    );
  }

  if (totalAim > 0 && deliveryPct >= 90) {
    return buildCampaignIntelligence(
      "almost_delivered",
      {
        ...base,
        message: `${deliveryPct}% da meta contratada entregue.`,
        tone: "success",
        isCritical: false,
      },
      isAdmin,
      undefined,
      "almost_done"
    );
  }

  if (isAdmin && camp.status === "veiculando" && delivered <= 0 && pacing && pacing.passedDuration >= 1) {
    return buildCampaignIntelligence(
      "attention",
      {
        ...base,
        message: "Campanha iniciada sem entrega registrada. Validar setup e leitura do adserver.",
        tone: "danger",
        isCritical: true,
      },
      isAdmin,
      CAMPAIGN_PRIORITY_LABELS.immediate_action,
      "immediate_action"
    );
  }

  if (pacing && pacing.gap <= -3) {
    const immediateByTime = pacing.daysLeft <= IMMEDIATE_DAYS_TO_END && pacing.gap <= -8;
    const immediateByGap = pacing.gap <= -PACING_CRITICAL_GAP;
    const immediateByVolume = underAbsolute >= IMMEDIATE_UNDER_ABSOLUTE && pacing.gap <= -15;
    const watchByTime = pacing.daysLeft <= WATCH_DAYS_TO_END && pacing.gap <= -5;
    const watchByVolume = underAbsolute >= WATCH_UNDER_ABSOLUTE && pacing.gap <= -8;
    const priorityLevel: CampaignPriorityLevel =
      isAdmin && (immediateByTime || immediateByGap || immediateByVolume)
        ? "immediate_action"
        : isAdmin && (watchByTime || watchByVolume)
          ? "watch_today"
          : "adjust_pace";

    return buildCampaignIntelligence(
      "attention",
      {
        ...base,
        message: isAdmin
          ? `Entrega em ${pacing.actualPct}% vs ${pacing.expectedPct}% esperado. Gap de ${pacing.gap}%.`
          : "A OPEC esta acompanhando o ritmo de entrega.",
        tone: priorityLevel === "immediate_action" ? "danger" : "warning",
        isCritical: priorityLevel === "immediate_action",
      },
      isAdmin,
      priorityLevel === "immediate_action" ? CAMPAIGN_PRIORITY_LABELS.immediate_action : undefined,
      priorityLevel
    );
  }

  if (daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 2 && deliveryPct < 90) {
    const priorityLevel = isAdmin && deliveryPct < 80 ? "watch_today" : "adjust_pace";

    return buildCampaignIntelligence(
      "attention",
      {
        ...base,
        message: isAdmin
          ? `Encerra em ${daysToEnd} dia${daysToEnd === 1 ? "" : "s"} com ${deliveryPct}% entregue.`
          : "Campanha em fase final de acompanhamento.",
        tone: isAdmin ? "warning" : "info",
        isCritical: false,
      },
      isAdmin,
      undefined,
      priorityLevel
    );
  }

  return buildCampaignIntelligence(
    "on_track",
    {
      ...base,
      message: deliveryPct > 0 ? `${deliveryPct}% da meta contratada entregue.` : "Campanha em acompanhamento pela OPEC.",
      tone: "info",
      isCritical: false,
    },
    isAdmin,
    undefined,
    "healthy"
  );
}

export function getCampaignIntelligenceSummary(campaigns: Campaign[], options: CampaignIntelligenceOptions = {}) {
  const items = campaigns.map((campaign) => ({
    campaign,
    intelligence: getCampaignIntelligence(campaign, options),
  }));

  return {
    items,
    delivered: items.filter((item) => item.intelligence.status === "delivered"),
    almostDelivered: items.filter((item) => item.intelligence.status === "almost_delivered"),
    onTrack: items.filter((item) => item.intelligence.status === "on_track"),
    attention: items.filter((item) => item.intelligence.status === "attention"),
    materialPending: items.filter((item) => item.intelligence.status === "material_pending"),
    sponsorshipActive: items.filter((item) => item.intelligence.status === "sponsorship_active"),
  };
}
