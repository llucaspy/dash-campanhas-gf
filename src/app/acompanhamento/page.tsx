"use client";

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { useAuth } from "../../context/AuthContext";
import { isLucasAccount } from "../../lib/lucasAccess";
import { cn } from "../../lib/utils";

interface ActivityHistoryItem {
  date: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface MonitoringUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "USER";
  created_at: string;
  last_activity_date: string | null;
  last_seen_at: string | null;
  last_seen_today: string | null;
  active_days_7: number;
  active_days_30: number;
  activity_history: ActivityHistoryItem[];
}

interface MonitoringResponse {
  today: string;
  generatedAt: string;
  summary: {
    monitoredUsers: number;
    activeToday: number;
    pendingToday: number;
    staleUsers: number;
    adherence7: number;
  };
  users: MonitoringUser[];
}

type StatusFilter = "all" | "active" | "pending" | "stale";

function formatDateTime(value?: string | null) {
  if (!value) return "Ainda sem acesso registrado";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatToday(value?: string) {
  if (!value) return "";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function dateDaysAgo(today: string, days: number) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function daysSince(today: string, date?: string | null) {
  if (!date) return Number.POSITIVE_INFINITY;
  const current = new Date(`${today}T12:00:00Z`).getTime();
  const previous = new Date(`${date}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((current - previous) / 86_400_000));
}

function getStatus(user: MonitoringUser, today: string) {
  if (user.last_seen_today) {
    return {
      key: "active" as const,
      label: "Acompanhou hoje",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  const inactiveDays = daysSince(today, user.last_activity_date);
  if (!Number.isFinite(inactiveDays) || inactiveDays >= 3) {
    return {
      key: "stale" as const,
      label: user.last_activity_date ? `Sem acesso há ${inactiveDays} dias` : "Sem histórico",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    key: "pending" as const,
    label: "Pendente hoje",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

export default function DashboardMonitoringPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const canAccess = isLucasAccount(user);

  const loadMonitoring = useCallback(async () => {
    if (!canAccess) return;
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/lucas/dashboard-monitoring", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar acompanhamento.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar acompanhamento.");
    } finally {
      setIsLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    if (!authLoading && canAccess) loadMonitoring();
  }, [authLoading, canAccess, loadMonitoring]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();

    return data.users.filter((item) => {
      const status = getStatus(item, data.today);
      const matchesFilter = filter === "all" || status.key === filter;
      const matchesQuery =
        !normalized ||
        item.name.toLowerCase().includes(normalized) ||
        item.email.toLowerCase().includes(normalized) ||
        item.username.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [data, filter, query]);

  if (!authLoading && !canAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6">
        <div className="max-w-md text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-[#355CFF]" />
          <h1 className="mt-4 text-xl font-bold text-[#1D1E2C]">Acesso reservado</h1>
          <p className="mt-2 text-sm text-[#71717A]">Este acompanhamento está disponível somente para Lucas.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC]">
      <Sidebar />
      <main className="relative w-full max-w-full flex-1 overflow-x-hidden bg-[#F8FAFC] xl:ml-[232px] 2xl:ml-[260px]">
        <Topbar />

        <div className="w-full min-w-0 space-y-5 p-3 sm:p-4 xl:p-5 2xl:space-y-6 2xl:p-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">Uso da plataforma</p>
              <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-[#1D1E2C]">
                <Activity className="h-6 w-6 text-[#355CFF]" />
                Acompanhamento diário
              </h1>
              <p className="mt-1 text-sm font-medium text-[#71717A]">
                Presença da equipe no dashboard em {formatToday(data?.today)}.
              </p>
            </div>

            <button
              type="button"
              onClick={loadMonitoring}
              disabled={isLoading}
              title="Atualizar acompanhamento"
              className="inline-flex h-10 w-10 items-center justify-center self-start rounded-xl border border-[#D8E4F2] bg-white text-[#315F96] transition-colors hover:bg-[#F7FAFF] disabled:cursor-wait disabled:opacity-60 lg:self-auto"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
          </header>

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <SummaryCard icon={CheckCircle2} label="Acompanharam hoje" value={data?.summary.activeToday ?? 0} tone="green" />
            <SummaryCard icon={Clock3} label="Pendentes hoje" value={data?.summary.pendingToday ?? 0} tone="amber" />
            <SummaryCard icon={TriangleAlert} label="Sem acesso recente" value={data?.summary.staleUsers ?? 0} tone="red" />
            <SummaryCard icon={CalendarDays} label="Aderência em 7 dias" value={`${data?.summary.adherence7 ?? 0}%`} tone="blue" />
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E5EAF4] bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-[#F1F5F9] p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <UsersRound className="h-5 w-5 text-[#355CFF]" />
                  <h2 className="text-sm font-bold text-[#1D1E2C]">Equipe monitorada</h2>
                </div>
                <p className="mt-1 text-xs font-medium text-[#A1A1AA]">
                  {filteredUsers.length} de {data?.summary.monitoredUsers ?? 0} usuários
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#F5F7FB] p-1">
                  {[
                    ["all", "Todos"],
                    ["active", "Hoje"],
                    ["pending", "Pendentes"],
                    ["stale", "Sem acesso"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value as StatusFilter)}
                      className={cn(
                        "h-8 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors",
                        filter === value ? "bg-white text-[#315F96] shadow-sm" : "text-[#71717A] hover:text-[#1D1E2C]"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-0 sm:w-[280px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar pessoa"
                    className="h-10 w-full rounded-xl border border-[#E5EAF4] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#355CFF]/50 focus:ring-4 focus:ring-[#355CFF]/10"
                  />
                </div>
              </div>
            </div>

            {error ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-red-600">{error}</p>
                <button type="button" onClick={loadMonitoring} className="mt-3 text-sm font-semibold text-[#355CFF]">
                  Tentar novamente
                </button>
              </div>
            ) : isLoading && !data ? (
              <div className="p-8 text-sm font-semibold text-[#A1A1AA]">Carregando acompanhamento...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-sm font-semibold text-[#A1A1AA]">Nenhum usuário encontrado neste filtro.</div>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {filteredUsers.map((item) => (
                  <UserActivityRow key={item.id} user={item} today={data?.today || ""} />
                ))}
              </div>
            )}
          </section>

          {data?.generatedAt && (
            <p className="text-right text-[11px] font-medium text-[#A1A1AA]">
              Atualizado em {formatDateTime(data.generatedAt)}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | number;
  tone: "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-[#EEF4FB] text-[#315F96]",
  };

  return (
    <div className="rounded-2xl border border-[#E5EAF4] bg-white p-4 shadow-sm sm:p-5">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-4 text-xl font-bold text-[#1D1E2C] sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#71717A]">{label}</p>
    </div>
  );
}

function UserActivityRow({ user, today }: { user: MonitoringUser; today: string }) {
  const status = getStatus(user, today);
  const activeDates = new Set(user.activity_history.map((item) => item.date));
  const recentDates = Array.from({ length: 14 }, (_, index) => dateDaysAgo(today, 13 - index));

  return (
    <article className="grid gap-5 p-4 transition-colors hover:bg-[#FBFCFE] sm:p-5 xl:grid-cols-[minmax(220px,1.3fr)_170px_150px_minmax(260px,1fr)] xl:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FB] text-sm font-bold text-[#315F96]">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-[#1D1E2C]">{user.name}</h3>
            {user.role === "ADMIN" && (
              <span className="rounded-md bg-[#F5F7FB] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#71717A]">Admin</span>
            )}
          </div>
          <p className="truncate text-xs font-medium text-[#A1A1AA]">{user.email}</p>
        </div>
      </div>

      <div>
        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", status.className)}>
          {status.label}
        </span>
        <p className="mt-2 text-[11px] font-medium text-[#A1A1AA]">Último: {formatDateTime(user.last_seen_at)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:block xl:space-y-2">
        <p className="text-xs font-semibold text-[#525866]">
          <span className="font-bold text-[#1D1E2C]">{user.active_days_7}</span> de 7 dias
        </p>
        <p className="text-xs font-semibold text-[#525866]">
          <span className="font-bold text-[#1D1E2C]">{user.active_days_30}</span> de 30 dias
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-[#A1A1AA]">Últimos 14 dias</span>
          <span className="text-[10px] font-semibold text-[#A1A1AA]">hoje</span>
        </div>
        <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
          {recentDates.map((date) => {
            const active = activeDates.has(date);
            return (
              <span
                key={date}
                title={`${new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}: ${active ? "acessou" : "sem acesso"}`}
                className={cn(
                  "h-5 min-w-0 rounded-[4px] border",
                  active ? "border-emerald-300 bg-emerald-400" : "border-[#E5EAF4] bg-[#F5F7FB]",
                  date === today && "ring-1 ring-[#315F96] ring-offset-1"
                )}
              />
            );
          })}
        </div>
      </div>
    </article>
  );
}
