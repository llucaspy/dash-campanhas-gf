"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, FileText, Inbox, Search } from "lucide-react";

import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";

interface RequestAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

interface TeamRequest {
  id: string;
  subject: string;
  body: string;
  status: "open" | "reviewed" | "resolved";
  created_at: string;
  user_name: string;
  user_email: string;
  attachments: RequestAttachment[];
}

const statusLabels: Record<TeamRequest["status"], string> = {
  open: "Novo",
  reviewed: "Visualizado",
  resolved: "Concluido",
};

function formatFileSize(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | TeamRequest["status"]>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      setIsLoading(true);
      const response = await fetch("/api/admin/communications", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      setRequests(data.observations || []);
      setIsLoading(false);
    }

    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return requests.filter((item) => {
      const matchesStatus = status === "all" || item.status === status;
      const matchesQuery =
        !normalizedQuery ||
        item.subject.toLowerCase().includes(normalizedQuery) ||
        item.body.toLowerCase().includes(normalizedQuery) ||
        item.user_name.toLowerCase().includes(normalizedQuery) ||
        item.user_email.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [query, requests, status]);

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F8FAFC]">
      <Sidebar />
      <main className="relative w-full max-w-full flex-1 overflow-x-hidden bg-[#F8FAFC] xl:ml-[232px] 2xl:ml-[260px]">
        <Topbar />

        <div className="w-full min-w-0 space-y-5 p-3 sm:p-4 xl:p-5 2xl:space-y-6 2xl:p-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">Solicitações</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-[#1D1E2C]">Solicitações da equipe</h1>
              <p className="mt-1 text-sm font-medium text-[#71717A]">
                Comentários, pedidos e documentos enviados diretamente para Lucas.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex h-12 min-w-[280px] items-center gap-3 rounded-2xl border border-[#E5EAF4] bg-white px-4 shadow-sm focus-within:border-[#355CFF]/60 focus-within:ring-4 focus-within:ring-[#355CFF]/10">
                <Search className="h-4 w-4 text-[#A1A1AA]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por assunto, pessoa ou texto"
                  className="h-full w-full bg-transparent text-sm outline-none placeholder:text-[#A1A1AA]"
                />
              </div>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as "all" | TeamRequest["status"])}
                className="h-12 rounded-2xl border border-[#E5EAF4] bg-white px-4 text-sm font-bold text-[#525866] shadow-sm outline-none focus:border-[#355CFF]/60"
              >
                <option value="all">Todos</option>
                <option value="open">Novos</option>
                <option value="reviewed">Visualizados</option>
                <option value="resolved">Concluídos</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard label="Total recebido" value={requests.length} />
            <SummaryCard label="Novos" value={requests.filter((item) => item.status === "open").length} />
            <SummaryCard label="Com anexos" value={requests.filter((item) => item.attachments?.length > 0).length} />
          </div>

          <section className="overflow-hidden rounded-[24px] border border-[#E9EDF5] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF1FF] text-[#355CFF]">
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#1D1E2C]">Entrada organizada</h2>
                  <p className="text-xs font-medium text-[#A1A1AA]">{filteredRequests.length} item(ns) nesta visualização</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#F1F5F9]">
              {isLoading ? (
                <div className="p-8 text-sm font-semibold text-[#A1A1AA]">Carregando solicitações...</div>
              ) : filteredRequests.length === 0 ? (
                <div className="p-8 text-sm font-semibold text-[#A1A1AA]">Nenhuma solicitação encontrada.</div>
              ) : (
                filteredRequests.map((item, index) => (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_220px]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-[#1D1E2C]">{item.subject}</h3>
                        <span className="rounded-full bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-black text-[#71717A]">
                          {statusLabels[item.status] || item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#A1A1AA]">
                        {item.user_name} · {item.user_email} · {new Date(item.created_at).toLocaleString("pt-BR")}
                      </p>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#525866]">{item.body}</p>

                      {item.attachments?.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={`/api/communications/attachments/${attachment.id}`}
                              className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[#E5EAF4] bg-[#F8FAFC] px-3 py-2 text-xs font-bold text-[#525866] transition-colors hover:border-[#355CFF]/30 hover:bg-[#F6F9FF]"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0 text-[#355CFF]" />
                              <span className="truncate">{attachment.fileName}</span>
                              <span className="shrink-0 text-[#A1A1AA]">{formatFileSize(attachment.fileSize)}</span>
                              <Download className="h-3.5 w-3.5 shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#F1F5F9] bg-[#FBFCFF] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A1A1AA]">Origem</p>
                      <p className="mt-2 text-sm font-black text-[#1D1E2C]">{item.user_name}</p>
                      <p className="mt-1 break-all text-xs font-semibold text-[#71717A]">{item.user_email}</p>
                      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#A1A1AA]">Anexos</p>
                      <p className="mt-2 text-sm font-black text-[#1D1E2C]">{item.attachments?.length || 0}</p>
                    </div>
                  </motion.article>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-[#E9EDF5] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#A1A1AA]">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight text-[#1D1E2C]">{value}</p>
    </div>
  );
}
