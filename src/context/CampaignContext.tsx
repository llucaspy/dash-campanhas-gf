"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import type { CampaignBoostStatus } from "../lib/campaignOperationalStatus";

export type UserInformationLevel = "light" | "adops";

export interface Purchase {
  id?: string;
  description: string;
  volume: string;
  type?: 'paid' | 'bonus';
}

export interface CampaignMetricSnapshot {
  id: string;
  campaignId: string;
  recordedAt: string;
  source: string;
  previousDeliveredImpressions?: number | null;
  deliveredImpressions: number;
  deliveredDelta: number;
  previousViewabilityPercentage?: number | null;
  viewabilityPercentage: number;
  viewabilityDelta: number;
  previousTotalImpressions?: number | null;
  totalImpressions: number;
  totalImpressionsDelta: number;
  previousDeliveryPct?: number | null;
  deliveryPct: number;
  deliveryPctDelta: number;
  status?: Campaign["status"] | null;
  previousStatus?: Campaign["status"] | null;
}

export interface Campaign {
  id: string;
  piNumber: string;
  client: string;
  campaignName: string;
  agency: string;
  dashLink?: string;
  gamLink?: string;
  hasGamLink?: boolean;
  gmailLink?: string;
  adserver?: string;
  pdfUrl?: string;
  status: 'veiculando' | 'pausada' | 'finalizada' | 'pendente_material';
  boostStatus?: CampaignBoostStatus;
  boostStatusUpdatedAt?: string;
  startDate: string;
  endDate: string;
  deliveredImpressions: number;
  viewabilityPercentage?: number;
  paidPurchases: Purchase[];
  bonusPurchases: Purchase[];
  createdAt: string;
  displayOrder?: number;
  metricHistory?: CampaignMetricSnapshot[];
}

interface CampaignContextType {
  campaigns: Campaign[];
  userInformationLevel: UserInformationLevel;
  canViewOperationalInfo: boolean;
  addCampaign: (campaign: Omit<Campaign, "id" | "createdAt" | "deliveredImpressions" | "viewabilityPercentage">) => Promise<void>;
  updateCampaign: (id: string, campaign: Partial<Omit<Campaign, "id" | "createdAt">>) => Promise<void>;
  updateDeliveredImpressions: (id: string, newImpressions: number) => Promise<void>;
  updateViewabilityPercentage: (id: string, newPercentage: number) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  updateCampaignOrder: (orderedIds: string[]) => Promise<void>;
  refreshCampaigns: () => Promise<void>;
  isLoading: boolean;
  lastUpdatedAt: Date | null;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [userInformationLevel, setUserInformationLevel] = useState<UserInformationLevel>("light");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const canViewOperationalInfo = Boolean(user && (isAdmin || userInformationLevel === "adops"));

  const fetchCampaigns = async (options: { silent?: boolean } = {}) => {
    if (!user) {
      setCampaigns([]);
      setUserInformationLevel("light");
      setIsLoading(false);
      return;
    }

    if (!options.silent) setIsLoading(true);
    try {
      const response = await fetch("/api/campaigns", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns || []);
      setUserInformationLevel(data.userInformationLevel === "adops" ? "adops" : "light");
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error("Erro ao buscar campanhas:", error);
    } finally {
      if (!options.silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const fetchUserInformationLevel = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted) setUserInformationLevel(data.userInformationLevel === "adops" ? "adops" : "light");
      } catch (_) {}
    };

    fetchUserInformationLevel();
    const interval = window.setInterval(fetchUserInformationLevel, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const addCampaign = async (newCamp: Omit<Campaign, "id" | "createdAt" | "deliveredImpressions" | "viewabilityPercentage">) => {
    if (!isAdmin) {
      alert("Esse recurso fica reservado ao meu acesso.");
      return;
    }

    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCamp),
      });

      if (!response.ok) throw new Error("Admin API error");
      fetchCampaigns();
    } catch (error) {
      console.error("Erro ao adicionar campanha:", error);
      alert("Erro ao salvar no banco de dados.");
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!isAdmin) {
      alert("Esse recurso fica reservado ao meu acesso.");
      return;
    }

    try {
      const response = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Admin API error");
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error("Erro ao deletar campanha:", error);
    }
  };

  const updateCampaign = async (id: string, updates: Partial<Omit<Campaign, "id" | "createdAt">>) => {
    if (!isAdmin) {
      alert("Esse recurso fica reservado ao meu acesso.");
      return;
    }

    const previousCampaigns = campaigns;
    setCampaigns((prev) => prev.map((campaign) => (campaign.id === id ? { ...campaign, ...updates } : campaign)));

    try {
      const response = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Admin API error");
      setLastUpdatedAt(new Date());
      void fetchCampaigns({ silent: true });
    } catch (error) {
      console.error("Erro ao atualizar campanha:", error);
      setCampaigns(previousCampaigns);
      alert("Falha ao atualizar campanha.");
    }
  };

  const updateDeliveredImpressions = async (id: string, newImpressions: number) => {
    if (!isAdmin) {
      alert("Esse recurso fica reservado ao meu acesso.");
      return;
    }

    const previousCampaigns = campaigns;
    setCampaigns(prev => prev.map(c =>
      c.id === id ? { ...c, deliveredImpressions: newImpressions } : c
    ));

    try {
      const response = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveredImpressions: newImpressions }),
      });

      if (!response.ok) throw new Error("Admin API error");
      
      setLastUpdatedAt(new Date());
      void fetchCampaigns({ silent: true });
    } catch (error) {
      console.error("Erro ao atualizar impressões:", error);
      setCampaigns(previousCampaigns);
      alert("Falha ao sincronizar com o banco de dados.");
    }
  };

  const updateViewabilityPercentage = async (id: string, newPercentage: number) => {
    if (!isAdmin) {
      alert("Esse recurso fica reservado ao meu acesso.");
      return;
    }

    const previousCampaigns = campaigns;
    setCampaigns(prev => prev.map(c =>
      c.id === id ? { ...c, viewabilityPercentage: newPercentage } : c
    ));

    try {
      const response = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewabilityPercentage: newPercentage }),
      });

      if (!response.ok) throw new Error("Admin API error");
      
      setLastUpdatedAt(new Date());
      void fetchCampaigns({ silent: true });
    } catch (error) {
      console.error("Erro ao atualizar viewability:", error);
      setCampaigns(previousCampaigns);
      alert("Falha ao sincronizar com o banco de dados.");
    }
  };

  const updateCampaignOrder = async (orderedIds: string[]) => {
    if (!isAdmin) {
      alert("Esse recurso fica reservado ao meu acesso.");
      return;
    }

    const previousCampaigns = campaigns;
    setCampaigns((prev) => {
      const orderMap = new Map(orderedIds.map((id, index) => [id, index + 1]));
      return [...prev]
        .map((campaign) => ({
          ...campaign,
          displayOrder: orderMap.get(campaign.id) ?? campaign.displayOrder,
        }))
        .sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999));
    });

    try {
      await Promise.all(
        orderedIds.map((id, index) =>
          fetch(`/api/admin/campaigns/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayOrder: index + 1 }),
          })
        )
      );
    } catch (error) {
      console.error("Erro ao ordenar campanhas:", error);
      setCampaigns(previousCampaigns);
      alert("Falha ao salvar a ordem das campanhas.");
    }
  };

  const refreshCampaigns = () => fetchCampaigns({ silent: true });

  return (
    <CampaignContext.Provider value={{ campaigns, userInformationLevel, canViewOperationalInfo, addCampaign, updateCampaign, updateDeliveredImpressions, updateViewabilityPercentage, deleteCampaign, updateCampaignOrder, refreshCampaigns, isLoading, lastUpdatedAt }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaigns() {
  const context = useContext(CampaignContext);
  if (context === undefined) {
    throw new Error("useCampaigns must be used within a CampaignProvider");
  }
  return context;
}
