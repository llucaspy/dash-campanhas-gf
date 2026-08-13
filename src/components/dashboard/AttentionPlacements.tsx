"use client";

import { Target, Trophy } from "lucide-react";
import { useCampaigns } from "../../context/CampaignContext";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";

export function AttentionPlacements() {
  const { campaigns } = useCampaigns();
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);

  // Filtramos as campanhas com maior Viewability Percentage
  const topPerformers = [...currentCampaigns]
    .filter(c => c.viewabilityPercentage && c.viewabilityPercentage > 0 && c.status === "veiculando")
    .sort((a, b) => (b.viewabilityPercentage || 0) - (a.viewabilityPercentage || 0))
    .slice(0, 2); // Exibe os 2 melhores destaques

  return (
    <div className="bg-white rounded-[22px] border border-[#E9EDF5] p-4 shadow-sm flex flex-col shrink-0 min-h-[150px] 2xl:rounded-[32px] 2xl:min-h-[180px] 2xl:p-8">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-[#1D1E2C] flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Destaques de Viewability
        </h3>
        <p className="text-xs text-[#A1A1AA] mt-0.5">Campanhas com melhor desempenho de VA</p>
      </div>

      <div className="flex flex-col gap-4">
        {topPerformers.length === 0 ? (
          <div className="text-center py-4 flex flex-col items-center justify-center border-2 border-dashed border-[#F1F5F9] rounded-2xl">
            <Target className="w-8 h-8 text-[#A1A1AA] mb-2 opacity-50" />
            <p className="text-xs font-bold text-[#71717A]">
              Sem dados suficientes.
            </p>
            <p className="text-[10px] text-[#A1A1AA] px-4 mt-1">Preencha o VA nas campanhas abaixo.</p>
          </div>
        ) : (
          topPerformers.map((camp, i) => (
            <div key={camp.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 shrink-0 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                  #{i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[#1D1E2C] text-xs font-bold truncate" title={camp.campaignName}>
                    {camp.campaignName}
                  </p>
                  <p className="text-[10px] text-[#A1A1AA] truncate">
                    {camp.client}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <span className="text-sm font-black text-[#22C55E]">
                  {camp.viewabilityPercentage}%
                </span>
                <p className="text-[10px] text-[#A1A1AA] font-bold">VA</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
