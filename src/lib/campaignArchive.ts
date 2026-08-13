import type { Campaign } from "../context/CampaignContext";

export function isCampaignArchived(campaign: Pick<Campaign, "status"> | { status: Campaign["status"] }) {
  return campaign.status === "finalizada";
}

export function splitCampaignsByArchive(campaigns: Campaign[]) {
  return {
    currentCampaigns: campaigns.filter((campaign) => !isCampaignArchived(campaign)),
    archivedCampaigns: campaigns.filter((campaign) => isCampaignArchived(campaign)),
  };
}
