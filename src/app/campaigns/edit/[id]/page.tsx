"use client";

import { Sidebar } from "../../../../components/layout/Sidebar";
import { Topbar } from "../../../../components/layout/Topbar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  Upload, 
  Plus, 
  Save, 
  ChevronRight, 
  LayoutGrid, 
  Building2, 
  Megaphone, 
  UserSquare2,
  FileDigit,
  BarChart3,
  CalendarDays,
  Activity,
  Trash2,
  ListPlus,
  MonitorPlay,
  Server,
  ArrowLeft
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../../../../lib/utils";
import { useCampaigns } from "../../../../context/CampaignContext";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

export default function EditCampaign() {
  const { campaigns, updateCampaign } = useCampaigns();
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const [form, setForm] = useState<{
    piNumber: string;
    client: string;
    campaignName: string;
    agency: string;
    dashLink: string;
    gamLink: string;
    gmailLink: string;
    adserver: string;
    status: 'veiculando' | 'pausada' | 'finalizada' | 'pendente_material';
    startDate: string;
    endDate: string;
  }>({
    piNumber: "",
    client: "",
    campaignName: "",
    agency: "",
    dashLink: "",
    gamLink: "",
    gmailLink: "",
    adserver: "",
    status: "veiculando",
    startDate: "",
    endDate: ""
  });

  const [paidPurchases, setPaidPurchases] = useState([{ description: "", volume: "" }]);
  const [bonusPurchases, setBonusPurchases] = useState([{ description: "", volume: "" }]);

  // Carregar dados da campanha existente
  useEffect(() => {
    if (campaigns.length > 0 && campaignId && !isLoaded) {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (campaign) {
        setForm({
          piNumber: campaign.piNumber || "",
          client: campaign.client || "",
          campaignName: campaign.campaignName || "",
          agency: campaign.agency || "",
          dashLink: campaign.dashLink || "",
          gamLink: campaign.gamLink || "",
          gmailLink: campaign.gmailLink || "",
          adserver: campaign.adserver || "",
          status: campaign.status,
          startDate: campaign.startDate || "",
          endDate: campaign.endDate || ""
        });
        setPaidPurchases(
          campaign.paidPurchases.length > 0 
            ? campaign.paidPurchases.map(p => ({ description: p.description, volume: p.volume }))
            : [{ description: "", volume: "" }]
        );
        setBonusPurchases(
          campaign.bonusPurchases.length > 0 
            ? campaign.bonusPurchases.map(p => ({ description: p.description, volume: p.volume }))
            : [{ description: "", volume: "" }]
        );
        setIsLoaded(true);
      }
    }
  }, [campaigns, campaignId, isLoaded]);

  const addPurchase = (type: 'paid' | 'bonus') => {
    if (type === 'paid') {
      setPaidPurchases([...paidPurchases, { description: "", volume: "" }]);
    } else {
      setBonusPurchases([...bonusPurchases, { description: "", volume: "" }]);
    }
  };

  const removePurchase = (index: number, type: 'paid' | 'bonus') => {
    if (type === 'paid') {
      setPaidPurchases(paidPurchases.filter((_, i) => i !== index));
    } else {
      setBonusPurchases(bonusPurchases.filter((_, i) => i !== index));
    }
  };

  const updatePurchase = (index: number, field: string, value: string, type: 'paid' | 'bonus') => {
    if (type === 'paid') {
      const newPurchases = [...paidPurchases];
      newPurchases[index] = { ...newPurchases[index], [field]: value };
      setPaidPurchases(newPurchases);
    } else {
      const newPurchases = [...bonusPurchases];
      newPurchases[index] = { ...newPurchases[index], [field]: value };
      setBonusPurchases(newPurchases);
    }
  };

  const handleSave = async () => {
    if (!form.campaignName || !form.client) {
      alert("Por favor, preencha o nome da campanha e o cliente.");
      return;
    }

    setIsUploading(true);
    let pdfUrl: string | undefined;

    try {
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('campaign_pdfs')
          .upload(fileName, file);

        if (uploadError) {
          throw new Error("Erro no upload do PDF");
        }

        const { data } = supabase.storage.from('campaign_pdfs').getPublicUrl(fileName);
        pdfUrl = data.publicUrl;
      }

      await updateCampaign(campaignId, {
        ...form,
        ...(pdfUrl ? { pdfUrl } : {}),
        paidPurchases,
        bonusPurchases
      });
      
      alert("Campanha atualizada com sucesso!");
      router.push("/");
    } catch (e) {
      console.error(e);
      alert("Falha ao atualizar campanha.");
      setIsUploading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen bg-[#F5F7FB]">
        <Sidebar />
        <main className="relative flex-1 xl:ml-[232px] 2xl:ml-[260px]">
          <Topbar />
          <div className="flex items-center justify-center p-4 xl:p-5 2xl:p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#355CFF]"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7FB]">
      <Sidebar />
      <main className="relative flex-1 xl:ml-[232px] 2xl:ml-[260px]">
        <Topbar />
        
        <div className="mx-auto max-w-[1200px] space-y-5 p-3 pb-16 sm:p-4 xl:p-5 2xl:space-y-8 2xl:p-8 2xl:pb-20">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-[#71717A] font-medium">
                <button onClick={() => router.push("/")} className="hover:text-[#355CFF] transition-colors flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" />
                  Campanhas
                </button>
                <ChevronRight className="w-4 h-4" />
                <span className="text-[#355CFF]">Editar campanha</span>
              </div>
              <h1 className="text-3xl font-black text-[#1D1E2C] tracking-tight">Editar Campanha</h1>
              <p className="text-sm text-[#A1A1AA]">{form.campaignName || "Carregando..."}</p>
            </div>
            
            <button 
              onClick={handleSave}
              disabled={isUploading}
              className="px-6 py-3 bg-[#355CFF] text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-[#2849D6] transition-all shadow-lg shadow-[#355CFF]/20 active:scale-95 disabled:opacity-50"
            >
              {isUploading ? "Salvando..." : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-3 2xl:gap-8">
            {/* Form Section */}
            <div className="space-y-5 2xl:col-span-2 2xl:space-y-6">
              <div className="bg-white rounded-[22px] 2xl:rounded-[32px] p-4 2xl:p-8 border border-[#E9EDF5] shadow-sm space-y-6 2xl:space-y-8">
                
                {/* Informações Básicas */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
                    <div className="w-8 h-8 bg-[#EBF1FF] rounded-lg flex items-center justify-center">
                      <LayoutGrid className="w-4 h-4 text-[#355CFF]" />
                    </div>
                    <h2 className="font-bold text-[#1D1E2C]">Informações Gerais</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                         <FileDigit className="w-3 h-3" /> Número do PI
                       </label>
                       <input 
                         type="text" 
                         placeholder="Ex: 20260009"
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all"
                         value={form.piNumber}
                         onChange={(e) => setForm({...form, piNumber: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                         <Building2 className="w-3 h-3" /> Cliente
                       </label>
                       <input 
                         type="text" 
                         placeholder="Nome do cliente"
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all"
                         value={form.client}
                         onChange={(e) => setForm({...form, client: e.target.value})}
                       />
                    </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                       <Megaphone className="w-3 h-3" /> Nome da Campanha
                     </label>
                     <input 
                       type="text" 
                       placeholder="Ex: CAMPANHA OPORTUNIDADE - ALWAYS ON"
                       className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all"
                       value={form.campaignName}
                       onChange={(e) => setForm({...form, campaignName: e.target.value})}
                     />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                         <UserSquare2 className="w-3 h-3" /> Agência
                       </label>
                       <input 
                         type="text" 
                         placeholder="Nome da agência"
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all"
                         value={form.agency}
                         onChange={(e) => setForm({...form, agency: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                         <Activity className="w-3 h-3" /> Situação
                       </label>
                       <select 
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all appearance-none cursor-pointer"
                         value={form.status}
                         onChange={(e) => setForm({...form, status: e.target.value as any})}
                       >
                         <option value="veiculando">Veiculando</option>
                         <option value="pendente_material">Aguardando Material</option>
                         <option value="pausada">Pausada</option>
                         <option value="finalizada">Finalizada</option>
                       </select>
                    </div>
                  </div>
                </div>

                {/* Múltiplas Compras de Impressões */}
                <div className="space-y-6 pt-4">
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#FFF4ED] rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-[#FB923C]" />
                      </div>
                      <h2 className="font-bold text-[#1D1E2C]">Volumes Contratados</h2>
                    </div>
                    <button 
                      onClick={() => addPurchase('paid')}
                      className="flex items-center gap-2 text-[#355CFF] font-bold text-xs hover:bg-[#355CFF]/5 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <ListPlus className="w-4 h-4" />
                      Adicionar Compra
                    </button>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-[#A1A1AA] uppercase tracking-[0.2em] mb-2">Impressões Pagas</p>
                    <AnimatePresence initial={false}>
                      {paidPurchases.map((purchase, index) => (
                        <motion.div 
                          key={`paid-${index}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0]"
                        >
                          <div className="md:col-span-7 space-y-2">
                            <label className="text-[10px] font-bold text-[#71717A] uppercase">Descrição da Compra</label>
                            <input 
                              type="text" 
                              placeholder="Ex: Reserva Mensal Julho"
                              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#355CFF]/10 transition-all"
                              value={purchase.description}
                              onChange={(e) => updatePurchase(index, 'description', e.target.value, 'paid')}
                            />
                          </div>
                          <div className="md:col-span-4 space-y-2">
                            <label className="text-[10px] font-bold text-[#71717A] uppercase">Volume (Impressões)</label>
                            <input 
                              type="text" 
                              placeholder="Ex: 1.500.000"
                              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#355CFF]/10 transition-all"
                              value={purchase.volume}
                              onChange={(e) => updatePurchase(index, 'volume', e.target.value, 'paid')}
                            />
                          </div>
                          <div className="md:col-span-1 flex justify-center">
                            <button 
                              onClick={() => removePurchase(index, 'paid')}
                              disabled={paidPurchases.length === 1}
                              className="p-2.5 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition-all disabled:opacity-30"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-dashed border-[#E2E8F0]">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-[#A1A1AA] uppercase tracking-[0.2em]">Cotas Bonificadas</p>
                      <button 
                        onClick={() => addPurchase('bonus')}
                        className="flex items-center gap-2 text-[#71717A] font-bold text-[10px] hover:bg-[#F1F5F9] px-2 py-1 rounded-md transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        Bonificação
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {bonusPurchases.map((purchase, index) => (
                        <motion.div 
                          key={`bonus-${index}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-white p-4 rounded-2xl border border-[#E2E8F0] border-dashed"
                        >
                          <div className="md:col-span-7 space-y-2">
                            <label className="text-[10px] font-bold text-[#A1A1AA] uppercase">Descrição da Bonificação</label>
                            <input 
                              type="text" 
                              placeholder="Ex: Bônus de Fechamento"
                              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#355CFF]/10 transition-all text-[#71717A]"
                              value={purchase.description}
                              onChange={(e) => updatePurchase(index, 'description', e.target.value, 'bonus')}
                            />
                          </div>
                          <div className="md:col-span-4 space-y-2">
                            <label className="text-[10px] font-bold text-[#A1A1AA] uppercase">Volume</label>
                            <input 
                              type="text" 
                              placeholder="Ex: 100.000"
                              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#355CFF]/10 transition-all text-[#71717A]"
                              value={purchase.volume}
                              onChange={(e) => updatePurchase(index, 'volume', e.target.value, 'bonus')}
                            />
                          </div>
                          <div className="md:col-span-1 flex justify-center">
                            <button 
                              onClick={() => removePurchase(index, 'bonus')}
                              className="p-2.5 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Período e Links */}
                <div className="space-y-6 pt-4 border-t border-[#F1F5F9]">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                         <CalendarDays className="w-3 h-3" /> Data Inicial
                       </label>
                       <input 
                         type="date" 
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all text-[#71717A] font-medium"
                         value={form.startDate}
                         onChange={(e) => setForm({...form, startDate: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                         <CalendarDays className="w-3 h-3" /> Data Final
                       </label>
                       <input 
                         type="date" 
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all text-[#71717A] font-medium"
                         value={form.endDate}
                         onChange={(e) => setForm({...form, endDate: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider">Link Relatório Principal</label>
                       <input 
                         type="text" 
                         placeholder="Opcional (Ex: Looker Studio)"
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all"
                         value={form.dashLink}
                         onChange={(e) => setForm({...form, dashLink: e.target.value})}
                       />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-[#F1F5F9] pt-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                         <Server className="w-3 h-3" /> Adserver
                       </label>
                       <input 
                         type="text" 
                         placeholder="Ex: Google Ad Manager, DV360, etc"
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all"
                         value={form.adserver}
                         onChange={(e) => setForm({...form, adserver: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                         <MonitorPlay className="w-3 h-3" /> Link do Setup GAM
                       </label>
                       <input 
                         type="text" 
                         placeholder="https://admanager.google.com/..."
                         className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all"
                         value={form.gamLink}
                         onChange={(e) => setForm({...form, gamLink: e.target.value})}
                       />
                    </div>
                  </div>
                  <div className="space-y-2 mt-6">
                     <label className="text-xs font-bold text-[#71717A] uppercase tracking-wider flex items-center gap-2">
                       <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"><path d="M20 18H4a2 2 0 01-2-2V8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                       Link do Fluxo Gmail (Opcional)
                     </label>
                     <input 
                       type="text" 
                       placeholder="https://mail.google.com/... ou link da thread"
                       className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#355CFF]/20 focus:border-[#355CFF] transition-all"
                       value={form.gmailLink}
                       onChange={(e) => setForm({...form, gmailLink: e.target.value})}
                     />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Form Section */}
            <div className="space-y-6">
              {/* PDF Upload */}
              <div className="bg-white rounded-[22px] 2xl:rounded-[32px] p-4 2xl:p-8 border border-[#E9EDF5] shadow-sm space-y-6 2xl:sticky 2xl:top-8">
                <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
                  <div className="w-8 h-8 bg-[#FEF2F2] rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[#EF4444]" />
                  </div>
                  <h2 className="font-bold text-[#1D1E2C]">Arquivo PDF</h2>
                </div>

                <label className="border-2 border-dashed border-[#E2E8F0] rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-[#355CFF] hover:bg-[#355CFF]/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 bg-[#F8FAFC] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-[#94A3B8] group-hover:text-[#355CFF]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#1D1E2C]">{file ? file.name : "Clique para trocar PDF"}</p>
                    <p className="text-xs text-[#A1A1AA] mt-1">Deixe vazio para manter o atual</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".pdf"
                    className="hidden" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
