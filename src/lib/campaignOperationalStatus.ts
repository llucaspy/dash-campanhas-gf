export const CAMPAIGN_BOOST_STATUSES = ["sponsorship", "high", "normal", "low"] as const;

export type CampaignBoostStatus = (typeof CAMPAIGN_BOOST_STATUSES)[number];
export type CampaignOperationalSelection = "pausada" | CampaignBoostStatus;

export const DEFAULT_CAMPAIGN_BOOST_STATUS: CampaignBoostStatus = "normal";

export const CAMPAIGN_OPERATIONAL_OPTIONS: { value: CampaignOperationalSelection; label: string }[] = [
  { value: "pausada", label: "Pausada" },
  { value: "sponsorship", label: "Sponsorship" },
  { value: "high", label: "Padrao - Alta" },
  { value: "normal", label: "Padrao normal" },
  { value: "low", label: "Padrao baixa" },
];

export const CAMPAIGN_BOOST_STATUS_LABELS: Record<CampaignBoostStatus, string> = {
  sponsorship: "Sponsorship",
  high: "Padrao - Alta",
  normal: "Padrao normal",
  low: "Padrao baixa",
};

export function normalizeCampaignBoostStatus(value: unknown): CampaignBoostStatus {
  return CAMPAIGN_BOOST_STATUSES.includes(value as CampaignBoostStatus)
    ? (value as CampaignBoostStatus)
    : DEFAULT_CAMPAIGN_BOOST_STATUS;
}

export function getEffectiveCampaignBoostStatus(campaignStatus: unknown, boostStatus: unknown): CampaignBoostStatus {
  return campaignStatus === "pausada" ? DEFAULT_CAMPAIGN_BOOST_STATUS : normalizeCampaignBoostStatus(boostStatus);
}
