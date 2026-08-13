"use client";

import type { ElementType, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Globe2,
  Link2,
  Loader2,
  MapPin,
  MousePointerClick,
  RefreshCw,
  Search,
  Table2,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

type DateRange = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CUSTOM_DATE";
type StatusState = "idle" | "checking" | "connected" | "error";
type GamRow = Record<string, string | number | boolean | null | undefined>;

interface GamFormState {
  dateRange: DateRange;
  startDate: string;
  endDate: string;
  orderId: string;
  lineItemId: string;
  includeRegionInfo: boolean;
  regionId: string;
  includeOpenUrl: boolean;
}

interface GamSummary {
  total_impressions: number;
  total_clicks: number;
  average_ctr: number;
  total_rows: number;
  total_orders: number;
  total_line_items: number;
  total_revenue?: number;
  average_ecpm?: number;
}

interface GamResponse {
  success: boolean;
  error?: string;
  include_region_info?: boolean;
  include_open_url?: boolean;
  region_filter?: string[];
  summary?: GamSummary;
  data?: GamRow[];
  files?: {
    excel?: string;
    csv?: string;
    json?: string;
  };
}

interface GamStatusResponse {
  success?: boolean;
  error?: string;
  message?: string;
  network_code?: string;
  network_name?: string;
  time_zone?: string;
  currency_code?: string;
  service_account?: string;
}

interface AggregatedRow {
  label: string;
  impressions: number;
  clicks: number;
}

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "LAST_7_DAYS", label: "Últimos 7 dias" },
  { value: "LAST_30_DAYS", label: "Últimos 30 dias" },
  { value: "YESTERDAY", label: "Ontem" },
  { value: "TODAY", label: "Hoje" },
  { value: "CUSTOM_DATE", label: "Período personalizado" },
];

const HIDDEN_TABLE_COLUMNS = new Set(["Receita", "eCPM", "Fonte URL", "URL Aberta", "Status URL", "URL Referência - Ad Unit"]);
const PREFERRED_TABLE_COLUMNS = [
  "Data",
  "Pedido (Order)",
  "ID Pedido",
  "Item de Linha (Line Item)",
  "ID Item Linha",
  "Região",
  "ID Região",
  "Bloco de Anúncio",
  "ID Ad Unit GAM",
  "URL",
  "Domínio",
  "Impressões",
  "Cliques",
  "CTR",
];

const CHART_COLORS = ["#355CFF", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9"];

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultForm(): GamFormState {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return {
    dateRange: "LAST_7_DAYS",
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
    orderId: "",
    lineItemId: "",
    includeRegionInfo: true,
    regionId: "",
    includeOpenUrl: true,
  };
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace("%", "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  return Math.round(toNumber(value)).toLocaleString("pt-BR");
}

function formatCompact(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(toNumber(value));
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function compactLabel(value: string, max = 34) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function normalizeUrlHref(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function aggregateRows(rows: GamRow[], key: string): AggregatedRow[] {
  const totals = new Map<string, AggregatedRow>();

  rows.forEach((row) => {
    const rawLabel = String(row[key] || "").trim();
    const label = rawLabel || "Não identificado";
    const current = totals.get(label) || { label, impressions: 0, clicks: 0 };
    current.impressions += toNumber(row["Impressões"]);
    current.clicks += toNumber(row["Cliques"]);
    totals.set(label, current);
  });

  return Array.from(totals.values()).sort((a, b) => b.impressions - a.impressions);
}

export default function GamPage() {
  const { user, isLoading } = useAuth();
  const [form, setForm] = useState<GamFormState>(getDefaultForm);
  const [statusState, setStatusState] = useState<StatusState>("idle");
  const [status, setStatus] = useState<GamStatusResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<GamResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const checkStatus = useCallback(async () => {
    setStatusState("checking");
    try {
      const response = await fetch("/api/gam/status", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as GamStatusResponse;
      setStatus(data);
      setStatusState(response.ok && data.success ? "connected" : "error");
    } catch {
      setStatus({
        success: false,
        error: "Serviço GAM indisponível. Inicie o extrator em http://127.0.0.1:5000.",
      });
      setStatusState("error");
    }
  }, []);

  useEffect(() => {
    if (user) void checkStatus();
  }, [checkStatus, user]);

  const rows = report?.data || [];
  const summary = report?.summary || {
    total_impressions: 0,
    total_clicks: 0,
    average_ctr: 0,
    total_rows: 0,
    total_orders: 0,
    total_line_items: 0,
  };

  const tableColumns = useMemo(() => {
    const available = new Set(rows.flatMap((row) => Object.keys(row)));
    const columns = PREFERRED_TABLE_COLUMNS.filter((column) => available.has(column) && !HIDDEN_TABLE_COLUMNS.has(column));
    Array.from(available).forEach((column) => {
      if (!columns.includes(column) && !HIDDEN_TABLE_COLUMNS.has(column)) columns.push(column);
    });
    return columns;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      tableColumns.some((column) => String(row[column] ?? "").toLowerCase().includes(normalizedQuery))
    );
  }, [query, rows, tableColumns]);

  const topUrlOrAdUnits = useMemo(() => {
    const key = report?.include_open_url ? "URL" : "Bloco de Anúncio";
    return aggregateRows(rows, key).slice(0, 8);
  }, [report?.include_open_url, rows]);

  const regionOrOrderShare = useMemo(() => {
    const key = report?.include_region_info ? "Região" : "Pedido (Order)";
    return aggregateRows(rows, key).slice(0, 6);
  }, [report?.include_region_info, rows]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (form.dateRange === "CUSTOM_DATE" && (!form.startDate || !form.endDate)) {
      setError("Informe a data inicial e final para gerar um período personalizado.");
      return;
    }

    setIsGenerating(true);
    setReport(null);

    const includeRegionInfo = form.includeRegionInfo || Boolean(form.regionId.trim());
    const payload = {
      date_range: form.dateRange,
      start_date: form.dateRange === "CUSTOM_DATE" ? form.startDate : "",
      end_date: form.dateRange === "CUSTOM_DATE" ? form.endDate : "",
      order_id: form.orderId.trim(),
      line_item_id: form.lineItemId.trim(),
      include_region_info: includeRegionInfo,
      region_id: form.regionId.trim(),
      include_open_url: form.includeOpenUrl,
    };

    try {
      const response = await fetch("/api/gam/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as GamResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Falha ao gerar relatório GAM.");
      }

      setReport(data);
      setQuery("");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Falha ao gerar relatório GAM.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[calc(100vh-96px)] items-center justify-center">
          <div className="flex items-center gap-3 rounded-[8px] border border-[#E9EDF5] bg-white px-5 py-4 text-sm font-bold text-[#71717A] shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-[#355CFF]" />
            Carregando acesso...
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell>
        <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-xl items-center justify-center p-6">
          <div className="rounded-[8px] border border-[#E9EDF5] bg-white p-6 text-center shadow-sm">
            <AlertCircle className="mx-auto h-9 w-9 text-[#EF4444]" />
            <h1 className="mt-4 text-lg font-black text-[#1D1E2C]">Sessão expirada</h1>
            <p className="mt-2 text-sm font-medium text-[#71717A]">Entre novamente no dashboard para gerar relatórios GAM.</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="w-full min-w-0 space-y-5 p-3 sm:p-4 xl:p-5 2xl:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#A1A1AA]">Google Ad Manager</p>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-black text-[#1D1E2C] dark:text-white">
              <FileSpreadsheet className="h-6 w-6 text-[#355CFF]" />
              Relatório GAM
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[#71717A] dark:text-white/50">
              Gere entregas por pedido, line item, região, ID de região e URL vinculada ao ad unit.
            </p>
          </div>

          <button
            type="button"
            onClick={checkStatus}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#DDE6F7] bg-white px-4 text-sm font-bold text-[#1D1E2C] shadow-sm transition-all hover:border-[#355CFF]/40 hover:bg-[#F6F9FF] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                statusState === "connected" && "bg-emerald-500",
                statusState === "checking" && "bg-amber-500",
                (statusState === "error" || statusState === "idle") && "bg-[#EF4444]"
              )}
            />
            {statusState === "checking" ? "Verificando GAM" : statusState === "connected" ? "GAM conectado" : "GAM indisponível"}
            <RefreshCw className={cn("h-4 w-4 text-[#A1A1AA]", statusState === "checking" && "animate-spin")} />
          </button>
        </div>

        {statusState === "connected" && status ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            <span>{status.network_name || "Rede GAM"} conectada</span>
            {status.network_code && <span className="text-emerald-700/70 dark:text-emerald-200/70">Network {status.network_code}</span>}
            {status.time_zone && <span className="text-emerald-700/70 dark:text-emerald-200/70">{status.time_zone}</span>}
          </div>
        ) : statusState === "error" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            <span>{status?.error || "Não foi possível conectar ao serviço GAM."}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="rounded-[8px] border border-[#E9EDF5] bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 border-b border-[#F1F5F9] p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#EBF1FF] text-[#355CFF] dark:bg-[#355CFF]/15">
                <Filter className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-black text-[#1D1E2C] dark:text-white">Parâmetros do relatório</h2>
                <p className="mt-0.5 text-xs font-semibold text-[#A1A1AA]">Filtro por campanha e dimensões opcionais.</p>
              </div>
            </div>
            <button
              type="submit"
              disabled={isGenerating || statusState === "checking"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#355CFF] px-4 text-sm font-black text-white shadow-sm transition-all hover:bg-[#2449E8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {isGenerating ? "Extraindo..." : "Gerar relatório"}
            </button>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-12">
            <Field label="Periodo" className="lg:col-span-3">
              <select
                value={form.dateRange}
                onChange={(event) => setForm((current) => ({ ...current, dateRange: event.target.value as DateRange }))}
                className="h-11 w-full rounded-[8px] border border-[#E5EAF4] bg-white px-3 text-sm font-semibold text-[#1D1E2C] outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10 dark:border-white/10 dark:bg-[#0F1117] dark:text-white"
              >
                {DATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Order ID" className="lg:col-span-3">
              <input
                value={form.orderId}
                onChange={(event) => setForm((current) => ({ ...current, orderId: event.target.value }))}
                placeholder="ex: 4065316991"
                inputMode="numeric"
                className="h-11 w-full rounded-[8px] border border-[#E5EAF4] bg-white px-3 text-sm font-semibold text-[#1D1E2C] outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10 dark:border-white/10 dark:bg-[#0F1117] dark:text-white dark:placeholder:text-white/30"
              />
            </Field>

            <Field label="Line Item ID" className="lg:col-span-3">
              <input
                value={form.lineItemId}
                onChange={(event) => setForm((current) => ({ ...current, lineItemId: event.target.value }))}
                placeholder="opcional"
                inputMode="numeric"
                className="h-11 w-full rounded-[8px] border border-[#E5EAF4] bg-white px-3 text-sm font-semibold text-[#1D1E2C] outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10 dark:border-white/10 dark:bg-[#0F1117] dark:text-white dark:placeholder:text-white/30"
              />
            </Field>

            <Field label="ID Região" className="lg:col-span-3">
              <input
                value={form.regionId}
                onChange={(event) => setForm((current) => ({ ...current, regionId: event.target.value, includeRegionInfo: true }))}
                placeholder="opcional, pode separar por vírgula"
                className="h-11 w-full rounded-[8px] border border-[#E5EAF4] bg-white px-3 text-sm font-semibold text-[#1D1E2C] outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10 dark:border-white/10 dark:bg-[#0F1117] dark:text-white dark:placeholder:text-white/30"
              />
            </Field>

            {form.dateRange === "CUSTOM_DATE" && (
              <>
                <Field label="Data inicial" className="lg:col-span-3">
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                    className="h-11 w-full rounded-[8px] border border-[#E5EAF4] bg-white px-3 text-sm font-semibold text-[#1D1E2C] outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10 dark:border-white/10 dark:bg-[#0F1117] dark:text-white"
                  />
                </Field>
                <Field label="Data final" className="lg:col-span-3">
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                    className="h-11 w-full rounded-[8px] border border-[#E5EAF4] bg-white px-3 text-sm font-semibold text-[#1D1E2C] outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10 dark:border-white/10 dark:bg-[#0F1117] dark:text-white"
                  />
                </Field>
              </>
            )}

            <ToggleField
              checked={form.includeRegionInfo}
              onChange={(checked) => setForm((current) => ({ ...current, includeRegionInfo: checked }))}
              icon={MapPin}
              label="Região e ID"
              description="Dimensão geográfica do GAM"
              className="lg:col-span-3"
            />

            <ToggleField
              checked={form.includeOpenUrl}
              onChange={(checked) => setForm((current) => ({ ...current, includeOpenUrl: checked }))}
              icon={Link2}
              label="URL"
              description="Vinculo por ad unit"
              className="lg:col-span-3"
            />
          </div>
        </form>

        {error && (
          <div className="flex items-start gap-3 rounded-[8px] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Target} label="Impressões" value={formatNumber(summary.total_impressions)} detail={`${formatNumber(summary.total_rows)} linhas`} tone="blue" />
          <KpiCard icon={MousePointerClick} label="Cliques" value={formatNumber(summary.total_clicks)} detail={`CTR ${formatPercent(summary.average_ctr)}`} tone="green" />
          <KpiCard icon={BarChart3} label="Orders" value={formatNumber(summary.total_orders)} detail={`${formatNumber(summary.total_line_items)} line items`} tone="amber" />
          <KpiCard
            icon={Globe2}
            label={report?.include_open_url ? "URLs" : "Ad units"}
            value={formatNumber(topUrlOrAdUnits.length)}
            detail={report?.include_region_info ? "Com divisão por região" : "Sem divisão por região"}
            tone="purple"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <ChartPanel
            title={report?.include_open_url ? "Top URLs por impressões" : "Top ad units por impressões"}
            subtitle={`${topUrlOrAdUnits.length} principais resultados`}
          >
            {topUrlOrAdUnits.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topUrlOrAdUnits} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 8 }}>
                  <CartesianGrid stroke="#E9EDF5" horizontal={false} />
                  <XAxis type="number" tickFormatter={formatCompact} tick={{ fill: "#8A94A6", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={170}
                    tickFormatter={(value) => compactLabel(String(value), 24)}
                    tick={{ fill: "#525866", fontSize: 11, fontWeight: 700 }}
                  />
                  <Tooltip
                    formatter={(value) => [formatNumber(value), "Impressões"]}
                    labelFormatter={(label) => String(label)}
                    contentStyle={{ borderRadius: 8, borderColor: "#E9EDF5" }}
                  />
                  <Bar dataKey="impressions" fill="#355CFF" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPanel icon={Table2} text="Gere um relatório para visualizar as entregas." />
            )}
          </ChartPanel>

          <ChartPanel
            title={report?.include_region_info ? "Distribuição por região" : "Distribuição por pedido"}
            subtitle={`${regionOrOrderShare.length} grupos`}
          >
            {regionOrOrderShare.length > 0 ? (
              <div className="grid min-h-[280px] grid-cols-1 items-center gap-2 sm:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={regionOrOrderShare}
                      dataKey="impressions"
                      nameKey="label"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {regionOrOrderShare.map((entry, index) => (
                        <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [formatNumber(value), "Impressões"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {regionOrOrderShare.map((item, index) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2 font-bold text-[#525866] dark:text-white/70">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        <span className="truncate" title={item.label}>{item.label}</span>
                      </span>
                      <span className="shrink-0 font-black text-[#1D1E2C] dark:text-white">{formatCompact(item.impressions)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyPanel icon={MapPin} text="Sem dados agrupados ainda." />
            )}
          </ChartPanel>
        </div>

        <div className="overflow-hidden rounded-[8px] border border-[#E9EDF5] bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 border-b border-[#F1F5F9] p-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#F6F9FF] text-[#355CFF] dark:bg-[#355CFF]/15">
                <Table2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-black text-[#1D1E2C] dark:text-white">Resultado do relatório</h2>
                <p className="mt-0.5 text-xs font-semibold text-[#A1A1AA]">{filteredRows.length} de {rows.length} linha(s)</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtrar tabela..."
                  className="h-10 w-full rounded-[8px] border border-[#E5EAF4] bg-white pl-10 pr-3 text-sm font-semibold text-[#1D1E2C] outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10 dark:border-white/10 dark:bg-[#0F1117] dark:text-white dark:placeholder:text-white/30"
                />
              </div>
              <DownloadLink filename={report?.files?.excel} label="Excel" icon={FileSpreadsheet} />
              <DownloadLink filename={report?.files?.csv} label="CSV" icon={Download} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead className="border-b border-[#F1F5F9] bg-[#F8FAFC] dark:border-white/10 dark:bg-white/5">
                <tr>
                  {tableColumns.length > 0 ? (
                    tableColumns.map((column) => (
                      <th
                        key={column}
                        className={cn(
                          "px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#8A94A6] dark:text-white/40",
                          isNumericColumn(column) && "text-right"
                        )}
                      >
                        {column}
                      </th>
                    ))
                  ) : (
                    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#8A94A6]">Dados</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] dark:divide-white/10">
                {isGenerating ? (
                  <tr>
                    <td colSpan={Math.max(tableColumns.length, 1)} className="px-4 py-16 text-center">
                      <div className="inline-flex items-center gap-3 rounded-[8px] bg-[#F6F9FF] px-4 py-3 text-sm font-bold text-[#355CFF] dark:bg-[#355CFF]/15">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Aguardando retorno da API do GAM...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(tableColumns.length, 1)} className="px-4 py-16 text-center">
                      <EmptyPanel icon={Globe2} text="Nenhum relatório gerado nesta sessão." />
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(tableColumns.length, 1)} className="px-4 py-16 text-center text-sm font-bold text-[#A1A1AA]">
                      Nenhuma linha corresponde ao filtro.
                    </td>
                  </tr>
                ) : (
                  filteredRows.slice(0, 250).map((row, index) => (
                    <tr key={index} className="transition-colors hover:bg-[#F8FAFC] dark:hover:bg-white/5">
                      {tableColumns.map((column) => (
                        <td
                          key={column}
                          className={cn(
                            "max-w-[320px] px-4 py-3 text-sm font-semibold text-[#525866] dark:text-white/70",
                            isNumericColumn(column) && "text-right font-black text-[#1D1E2C] dark:text-white"
                          )}
                        >
                          <TableCell column={column} value={row[column]} />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > 250 && (
            <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3 text-xs font-bold text-[#71717A] dark:border-white/10 dark:bg-white/5 dark:text-white/50">
              Exibindo as primeiras 250 linhas. Baixe o arquivo para consultar o relatório completo.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC] dark:bg-[#0F1117]">
      <Sidebar />
      <main className="relative w-full max-w-full flex-1 overflow-x-hidden bg-[#F8FAFC] dark:bg-[#0F1117] xl:ml-[232px] 2xl:ml-[260px]">
        <Topbar />
        {children}
      </main>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-[#8A94A6] dark:text-white/40">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({
  checked,
  onChange,
  icon: Icon,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: ElementType;
  label: string;
  description: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-full min-h-11 items-center justify-between gap-3 rounded-[8px] border px-3 py-2 text-left transition-all",
        checked
          ? "border-[#C9D6F2] bg-[#F6F9FF] text-[#1D1E2C] dark:border-[#355CFF]/30 dark:bg-[#355CFF]/10 dark:text-white"
          : "border-[#E5EAF4] bg-white text-[#71717A] dark:border-white/10 dark:bg-[#0F1117] dark:text-white/50",
        className
      )}
      aria-pressed={checked}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", checked ? "bg-[#EBF1FF] text-[#355CFF] dark:bg-[#355CFF]/20" : "bg-[#F5F7FB] text-[#A1A1AA] dark:bg-white/10")}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">{label}</span>
          <span className="block truncate text-xs font-semibold text-[#8A94A6] dark:text-white/40">{description}</span>
        </span>
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-[#355CFF]" : "bg-[#CBD5E1] dark:bg-white/20")}>
        <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-1")} />
      </span>
    </button>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "purple";
}) {
  const toneClasses = {
    blue: "bg-[#EBF1FF] text-[#355CFF]",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-[8px] border border-[#E9EDF5] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8A94A6] dark:text-white/40">{label}</p>
          <p className="mt-3 truncate text-2xl font-black text-[#1D1E2C] dark:text-white">{value}</p>
          <p className="mt-1 truncate text-xs font-semibold text-[#71717A] dark:text-white/50">{detail}</p>
        </div>
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px]", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-[#E9EDF5] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-[#1D1E2C] dark:text-white">{title}</h2>
          <p className="mt-0.5 text-xs font-semibold text-[#A1A1AA]">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyPanel({ icon: Icon, text }: { icon: ElementType; text: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#DDE6F7] bg-[#F8FAFC] px-4 text-center text-sm font-bold text-[#A1A1AA] dark:border-white/10 dark:bg-white/5 dark:text-white/40">
      <Icon className="mb-3 h-8 w-8 text-[#CBD5E1] dark:text-white/20" />
      {text}
    </div>
  );
}

function DownloadLink({ filename, label, icon: Icon }: { filename?: string; label: string; icon: ElementType }) {
  const href = filename ? `/api/gam/download/${encodeURIComponent(filename)}` : "#";

  return (
    <a
      href={href}
      onClick={(event) => {
        if (!filename) event.preventDefault();
      }}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#DDE6F7] bg-white px-3 text-xs font-black text-[#1D1E2C] shadow-sm transition-all hover:border-[#355CFF]/40 hover:bg-[#F6F9FF] dark:border-white/10 dark:bg-white/5 dark:text-white",
        !filename && "pointer-events-none opacity-50"
      )}
    >
      <Icon className="h-4 w-4 text-[#355CFF]" />
      {label}
    </a>
  );
}

function isNumericColumn(column: string) {
  return ["Impressões", "Cliques", "CTR", "ID Pedido", "ID Item Linha", "ID Região", "ID Ad Unit GAM"].includes(column);
}

function TableCell({ column, value }: { column: string; value: GamRow[string] }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-[#A1A1AA]">-</span>;
  }

  if (column === "Impressões" || column === "Cliques") {
    return <span>{formatNumber(value)}</span>;
  }

  if (column === "CTR") {
    return <span>{formatPercent(value)}</span>;
  }

  if (column === "URL") {
    const href = normalizeUrlHref(value);
    return href ? (
      <a href={href} target="_blank" rel="noreferrer" className="block truncate text-[#355CFF] underline-offset-4 hover:underline" title={String(value)}>
        {String(value)}
      </a>
    ) : (
      <span className="text-[#A1A1AA]">-</span>
    );
  }

  return <span className="block truncate" title={String(value)}>{String(value)}</span>;
}
