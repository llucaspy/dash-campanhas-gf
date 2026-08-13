"use client";

import { useCampaigns, type Campaign, type Purchase } from "../../context/CampaignContext";
import { splitCampaignsByArchive } from "../../lib/campaignArchive";
import { calculateTotalImpressions, getCampaignIntelligence } from "../../lib/campaignHealth";

const DEFAULT_FORMATS = "300x250, 320x50, 728x90, 970x250, 970x90, 320x100";

function parseVolume(value: string) {
  return Number(String(value || "0").replace(/\./g, "")) || 0;
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatDate(date?: string, compact = false) {
  if (!date) return "-";
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return compact ? `${match[3]}/${match[2]}` : `${match[3]}/${match[2]}/${match[1]}`;
  return new Date(date).toLocaleDateString("pt-BR", compact ? { day: "2-digit", month: "2-digit" } : undefined);
}

function deliveryPercent(campaign: Campaign) {
  const total = calculateTotalImpressions(campaign);
  if (total <= 0) return 0;
  return Math.round(((campaign.deliveredImpressions || 0) / total) * 100);
}

function sectionTitle(prefix: string, item: Purchase, index: number) {
  const description = item.description?.trim();
  if (!description || /^compra principal$/i.test(description) || /^bonifica/i.test(description)) {
    return prefix;
  }
  return `${prefix} - ${description}`;
}

function PurchaseSection({ title, purchase }: { title: string; purchase: Purchase }) {
  return (
    <div className="report-purchase">
      <p className="report-purchase-title">{title}</p>
      <p className="report-formats">Formatos: {DEFAULT_FORMATS}</p>
      <p>- Total contratado: <strong>{formatNumber(parseVolume(purchase.volume))}</strong></p>
    </div>
  );
}

export function PrintReport() {
  const { campaigns } = useCampaigns();
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);
  const reportCampaigns = currentCampaigns.filter((campaign) => campaign.status !== "finalizada");
  const activeCampaigns = reportCampaigns.length > 0 ? reportCampaigns : currentCampaigns;
  const todayStr = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="hidden w-full bg-white text-[#101828] print:block">
      <section className="report-header">
        <h1>Campanhas ativas ate o presente momento.</h1>
        <p>Data do relatorio: {todayStr}</p>
      </section>

      <section>
        {activeCampaigns.map((campaign) => {
          const total = calculateTotalImpressions(campaign);
          const delivered = campaign.deliveredImpressions || 0;
          const pct = deliveryPercent(campaign);
          const intelligence = getCampaignIntelligence(campaign, { isAdmin: false });
          const pacing = intelligence.pacing;
          const paidPurchases = campaign.paidPurchases.length ? campaign.paidPurchases : [];
          const bonusPurchases = campaign.bonusPurchases.length ? campaign.bonusPurchases : [];

          return (
            <article key={campaign.id} className="report-campaign avoid-break-inside">
              <div className="report-separator" />

              <div className="report-title-row">
                <span className="report-dot" />
                <h2>{campaign.campaignName}{campaign.piNumber ? ` - PI ${campaign.piNumber}` : ""}</h2>
                <span className="report-status">{intelligence.label}</span>
              </div>

              <p className="report-period">
                Periodo: {formatDate(campaign.startDate, true)} ate {formatDate(campaign.endDate, true)}
              </p>

              <div className="report-purchases">
                {paidPurchases.map((purchase, index) => (
                  <PurchaseSection key={`paid-${index}`} title={sectionTitle("Pago", purchase, index)} purchase={purchase} />
                ))}
                {bonusPurchases.map((purchase, index) => (
                  <PurchaseSection key={`bonus-${index}`} title={sectionTitle("Bonificado", purchase, index)} purchase={purchase} />
                ))}
                {paidPurchases.length === 0 && bonusPurchases.length === 0 && (
                  <div className="report-purchase">
                    <p className="report-purchase-title">Contratacao</p>
                    <p className="report-formats">Formatos: {DEFAULT_FORMATS}</p>
                    <p>- Total contratado: <strong>{formatNumber(total)}</strong></p>
                  </div>
                )}
              </div>

              <div className="report-summary">
                <p>- Total contratado da campanha: <strong>{formatNumber(total)}</strong></p>
                <p>- Entrega ate o momento: <strong>{formatNumber(delivered)}</strong> <span>({pct}%)</span></p>
                <p>- Viewability (VA): <strong>{campaign.viewabilityPercentage || 0}%</strong></p>
              </div>

              <p className="report-note">
                Status: {intelligence.message}
                {pacing ? ` Ritmo: ${pacing.actualPct}% realizado vs ${pacing.expectedPct}% esperado.` : ""}
              </p>
            </article>
          );
        })}
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 14mm 16mm;
            size: A4;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .avoid-break-inside {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-header {
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid #D9E2F2;
          }

          .report-header h1 {
            margin: 0;
            font-size: 18px;
            line-height: 1.25;
            font-weight: 800;
            color: #111827;
          }

          .report-header p {
            margin: 10px 0 0;
            font-size: 11px;
            font-weight: 600;
            color: #667085;
          }

          .report-campaign {
            padding: 14px 0 16px;
          }

          .report-separator {
            height: 1px;
            margin-bottom: 16px;
            background: linear-gradient(90deg, #CBD5E1 0%, #CBD5E1 72%, transparent 100%);
          }

          .report-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .report-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #16A34A;
            box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.10);
            flex: 0 0 auto;
          }

          .report-title-row h2 {
            margin: 0;
            flex: 1;
            font-size: 13px;
            line-height: 1.35;
            font-weight: 800;
            letter-spacing: 0;
            color: #111827;
            text-transform: uppercase;
          }

          .report-status {
            border: 1px solid #D9E2F2;
            border-radius: 999px;
            padding: 3px 8px;
            font-size: 9px;
            font-weight: 800;
            color: #355CFF;
            background: #F6F9FF;
            white-space: nowrap;
          }

          .report-period {
            margin: 7px 0 14px 16px;
            font-size: 11px;
            font-weight: 600;
            color: #475467;
          }

          .report-purchases {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            margin-left: 16px;
          }

          .report-purchase {
            font-size: 11px;
            line-height: 1.65;
            color: #344054;
          }

          .report-purchase p {
            margin: 0;
          }

          .report-purchase-title {
            margin-bottom: 2px !important;
            font-size: 11px;
            font-weight: 800;
            color: #111827;
          }

          .report-formats {
            color: #667085;
          }

          .report-summary {
            margin: 12px 0 0 16px;
            padding: 10px 12px;
            border: 1px solid #E5EAF4;
            border-radius: 10px;
            background: #F8FAFC;
            font-size: 11px;
            line-height: 1.65;
            color: #344054;
          }

          .report-summary p {
            margin: 0;
          }

          .report-summary span {
            color: #667085;
          }

          .report-note {
            margin: 10px 0 0 16px;
            border-left: 3px solid #D9E2F2;
            padding-left: 9px;
            font-size: 10.5px;
            line-height: 1.55;
            color: #475467;
          }
        }
      ` }} />
    </div>
  );
}
