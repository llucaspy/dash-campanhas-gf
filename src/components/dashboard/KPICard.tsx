"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  className?: string;
  animationsReady?: boolean;
}

// Hook de contador animado (odômetro)
function useAnimatedCounter(target: number, shouldAnimate: boolean, duration: number = 1900) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldAnimate) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (target === 0) {
      setCount(0);
      prevTarget.current = target;
      return;
    }
    
    const startValue = count;
    prevTarget.current = target;
    
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (target - startValue) * eased;
      
      setCount(currentValue);
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, shouldAnimate]);

  return count;
}

// Extrai número de uma string formatada (ex: "1.234.567" → 1234567)
function parseDisplayValue(value: string): number | null {
  const cleaned = value.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;
  const hasCommaDecimal = /,\d{1,2}$/.test(cleaned);
  const hasDotDecimal = /\.\d{1,2}$/.test(cleaned) && !cleaned.includes(",");
  const normalized = hasCommaDecimal
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : hasDotDecimal
      ? cleaned
      : cleaned.replace(/[.,]/g, "");
  const num = Number(normalized);
  return isNaN(num) ? null : num;
}

// Formata número de volta para o padrão pt-BR
function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function KPICard({ label, value, icon: Icon, iconBg, iconColor, className, animationsReady = true }: KPICardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const hasEnteredView = useInView(cardRef, { once: true, margin: "-8% 0px -8% 0px" });
  const numericTarget = parseDisplayValue(value);
  const animatedValue = useAnimatedCounter(numericTarget ?? 0, hasEnteredView && animationsReady);
  
  // Determinar se o valor é numérico puro ou tem sufixo (ex: "67.3%")
  const isPercentage = value.includes("%");
  const decimalMatch = value.match(/[,.](\d+)%?$/);
  const decimals = isPercentage ? Math.min(decimalMatch?.[1]?.length ?? 0, 2) : 0;
  const displayValue = numericTarget !== null
    ? `${formatNumber(animatedValue, decimals)}${isPercentage ? "%" : ""}`
    : value;

  // Extrair cor base do iconColor para o glow
  const glowColorMap: Record<string, string> = {
    "text-[#355CFF]": "hover:shadow-[#355CFF]/12",
    "text-[#22C55E]": "hover:shadow-[#22C55E]/12",
    "text-[#6366F1]": "hover:shadow-[#6366F1]/12",
    "text-[#EF4444]": "hover:shadow-[#EF4444]/12",
    "text-[#F59E0B]": "hover:shadow-[#F59E0B]/12",
    "text-[#8B5CF6]": "hover:shadow-[#8B5CF6]/12",
  };
  const glowClass = glowColorMap[iconColor] || "hover:shadow-[#355CFF]/8";

  return (
    <motion.div
      ref={cardRef}
      whileHover={{ y: -5, scale: 1.02 }}
      initial={animationsReady ? { opacity: 0, y: 20, scale: 0.95 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={animationsReady ? { type: "spring", stiffness: 260, damping: 20 } : { duration: 0 }}
      className={cn(
        "bg-white rounded-2xl xl:rounded-[22px] 2xl:rounded-3xl p-3 sm:p-4 2xl:p-6 border border-[#E9EDF5] shadow-sm flex flex-col gap-2 2xl:gap-4 cursor-pointer transition-all duration-300",
        `hover:shadow-2xl ${glowClass}`,
        className
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className={cn("w-8 h-8 2xl:w-10 2xl:h-10 rounded-lg 2xl:rounded-xl flex items-center justify-center relative", iconBg)}>
          <Icon className={cn("w-4 h-4 2xl:w-5 2xl:h-5", iconColor)} />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <p className="min-w-0 truncate text-right text-[9px] 2xl:text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wider">{label}</p>
          {/* Pulse dot — indicador de dados vivos */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>
      </div>
      <div>
        <h3 className="text-base sm:text-lg 2xl:text-2xl font-bold text-[#1D1E2C] tracking-tight tabular-nums">
          {displayValue}
        </h3>
      </div>
    </motion.div>
  );
}
