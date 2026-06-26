import { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { DashboardFilters, DateRange, NamedValue, TimeSeriesPoint, DashboardAnalytics, KpiData } from '../types/dashboard.types';
import { DEFAULT_FILTERS } from '../types/dashboard.types';
import type { DashboardRawData } from './useDashboardData';
import type { ProductionLedgerEntry } from '../../productionLedger/types/productionLedger.types';
import type { CostLedgerEntry } from '../../costLedger/types/costLedger.types';
import type { DispatchEntry } from '../../dispatch/types/dispatch.types';
import type { QualityControlEntry } from '../../qualityControl/types/qualityControl.types';

// ─── Date range resolver ──────────────────────────────────────────────────────
export const resolveDateRange = (filters: DashboardFilters): DateRange => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (filters.datePreset) {
    case 'today':
      return { start: today, end: endOfDay(today) };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { start: y, end: endOfDay(y) };
    }
    case 'last7': {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      return { start: s, end: endOfDay(today) };
    }
    case 'last30': {
      const s = new Date(today); s.setDate(s.getDate() - 29);
      return { start: s, end: endOfDay(today) };
    }
    case 'currentMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(today) };
    case 'previousMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s, end: endOfDay(e) };
    }
    case 'currentQuarter': {
      const q = Math.floor(now.getMonth() / 3);
      return { start: new Date(now.getFullYear(), q * 3, 1), end: endOfDay(today) };
    }
    case 'currentYear':
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(today) };
    case 'custom': {
      const s = filters.customStart ? new Date(filters.customStart) : new Date(today.setDate(today.getDate() - 29));
      const e = filters.customEnd ? endOfDay(new Date(filters.customEnd)) : endOfDay(new Date());
      return { start: s, end: e };
    }
    default:
      return { start: new Date(today.setDate(today.getDate() - 29)), end: endOfDay(new Date()) };
  }
};

// ─── Prev period range (mirror of current range, same duration) ───────────────
const prevRange = (range: DateRange): DateRange => {
  const duration = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - duration),
    end: new Date(range.end.getTime() - duration),
  };
};

// ─── Firestore Timestamp to Date ──────────────────────────────────────────────
const tsDate = (ts: Timestamp | null | undefined): Date | null => {
  if (!ts) return null;
  try { return ts.toDate(); } catch { return null; }
};

const inRange = (date: Date | null, range: DateRange): boolean => {
  if (!date) return false;
  return date >= range.start && date <= range.end;
};

// ─── Format date for chart labels ────────────────────────────────────────────
const fmtLabel = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const fmtDateKey = (d: Date) => d.toISOString().split('T')[0];

// ─── Shift time parsing ───────────────────────────────────────────────────────
const parseMinutes = (time: string, period: string): number => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  let hours = (h || 0) % 12;
  if (period === 'PM') hours += 12;
  return hours * 60 + (m || 0);
};

const calcShiftHours = (entry: ProductionLedgerEntry): number => {
  const startMin = parseMinutes(entry.shiftStartTime || '', entry.shiftStartPeriod || 'AM');
  const endMin = parseMinutes(entry.shiftEndTime || '', entry.shiftEndPeriod || 'AM');
  if (startMin === 0 && endMin === 0) return 8; // default 8h if not set
  if (endMin >= startMin) return (endMin - startMin) / 60;
  return (24 * 60 - startMin + endMin) / 60; // overnight
};

const detectShift = (entry: ProductionLedgerEntry): string => {
  const h = parseMinutes(entry.shiftStartTime || '', entry.shiftStartPeriod || 'AM') / 60;
  if (h >= 6 && h < 14) return 'Morning';
  if (h >= 14 && h < 22) return 'Afternoon';
  return 'Night';
};

// ─── Generate date-keyed buckets for a range ─────────────────────────────────
const buildDateBuckets = (range: DateRange): Map<string, number> => {
  const map = new Map<string, number>();
  const cur = new Date(range.start);
  const end = range.end;
  while (cur <= end) {
    map.set(fmtDateKey(cur), 0);
    cur.setDate(cur.getDate() + 1);
  }
  return map;
};

// ─── Colors for pie/bar charts ────────────────────────────────────────────────
const PALETTE = [
  '#3b82f6', // Bright Blue
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#a855f7', // Purple
  '#e11d48', // Rose
  '#84cc16', // Lime
];

const ALLOY_COLORS: Record<string, string> = {
  'A6063': '#f59e0b',
  '6063': '#f59e0b',
  'A356': '#3b82f6',
  '356': '#3b82f6',
  'ADC12': '#ef4444',
  'LM6': '#10b981',
  'A6082': '#8b5cf6',
  '6082': '#8b5cf6',
};

const MATERIAL_COLORS: Record<string, string> = {
  'AL': '#2563eb',
  'ALUMINUM': '#2563eb',
  'PURE ALUMINUM': '#2563eb',
  'PURE ALUMINUM INGOTS': '#2563eb',
  'SI': '#0d9488',
  'SILICON': '#0d9488',
  'SILICON METAL': '#0d9488',
  'MG': '#d97706',
  'MAGNESIUM': '#d97706',
  'MAGNESIUM INGOTS': '#d97706',
  'CU': '#dc2626',
  'COPPER': '#dc2626',
  'COPPER SCRAP': '#dc2626',
  'MN': '#8b5cf6',
  'MANGANESE': '#8b5cf6',
  'MANGANESE FLAKES': '#8b5cf6',
  'TSE': '#f97316',
  'TENSE': '#f97316',
  'TENSE SCRAP': '#f97316',
  'TTR': '#06b6d4',
  'TABOR': '#06b6d4',
  'TABOR SCRAP': '#06b6d4',
  'EXT': '#059669',
  'EXTRUSION': '#059669',
  'EXTRUSION SCRAP': '#059669',
  'TEL': '#e11d48',
  'TELIC': '#e11d48',
  'TELIC SCRAP': '#e11d48',
  'ZIN': '#ec4899',
  'ZINC': '#ec4899',
  'ZINC DROSS': '#ec4899',
  'SCRAP': '#78716c',
  'SCRAP METAL': '#78716c',
};

export const getColorForAlloy = (name: string): string => {
  const clean = name.trim().toUpperCase();
  for (const [key, color] of Object.entries(ALLOY_COLORS)) {
    if (clean.includes(key)) return color;
  }
  // Deterministic fallback using hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
};

export const getColorForMaterial = (name: string): string => {
  const clean = name.trim().toUpperCase();
  for (const [key, color] of Object.entries(MATERIAL_COLORS)) {
    if (clean === key || clean.includes(key) || key.includes(clean)) return color;
  }
  // Deterministic fallback using hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
};

// ─── Main hook ────────────────────────────────────────────────────────────────
export const useDashboardFilters = (data: DashboardRawData) => {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

  const range = useMemo(() => resolveDateRange(filters), [filters]);
  const prev = useMemo(() => prevRange(range), [range]);

  // ── Filter helper functions ────────────────────────────────────────────────
  const filterProd = (entries: ProductionLedgerEntry[], r: DateRange) =>
    entries.filter((e) => {
      if (!inRange(tsDate(e.date), r)) return false;
      if (filters.alloyType && e.alloyType !== filters.alloyType) return false;
      if (filters.furnaceNo && e.furnaceNo !== filters.furnaceNo) return false;
      if (filters.supervisor && e.supervisorName !== filters.supervisor) return false;
      if (filters.shift && detectShift(e) !== filters.shift) return false;
      return true;
    });

  const filterCost = (entries: CostLedgerEntry[], r: DateRange) =>
    entries.filter((e) => {
      if (!inRange(tsDate(e.date), r)) return false;
      if (filters.alloyType && e.alloyType !== filters.alloyType) return false;
      return true;
    });

  const filterDispatch = (entries: DispatchEntry[], r: DateRange) =>
    entries.filter((e) => {
      if (!inRange(tsDate(e.dispatchDate), r)) return false;
      if (filters.customer && e.customerName !== filters.customer) return false;
      if (filters.alloyType && e.alloyType !== filters.alloyType) return false;
      return true;
    });

  const filterQC = (entries: QualityControlEntry[], r: DateRange) =>
    entries.filter((e) => {
      if (!inRange(tsDate(e.date), r)) return false;
      if (filters.qualityStatus && e.overallStatus !== filters.qualityStatus) return false;
      if (filters.alloyType && e.alloyType !== filters.alloyType) return false;
      return true;
    });

  // ── Filtered sets ──────────────────────────────────────────────────────────
  const prod = useMemo(() => filterProd(data.productionEntries, range), [data.productionEntries, range, filters]);
  const prevProd = useMemo(() => filterProd(data.productionEntries, prev), [data.productionEntries, prev, filters]);

  const cost = useMemo(() => filterCost(data.costEntries, range), [data.costEntries, range, filters]);
  const prevCost = useMemo(() => filterCost(data.costEntries, prev), [data.costEntries, prev, filters]);

  const dispatches = useMemo(() => filterDispatch(data.dispatches, range), [data.dispatches, range, filters]);
  const prevDispatches = useMemo(() => filterDispatch(data.dispatches, prev), [data.dispatches, prev, filters]);

  const qc = useMemo(() => filterQC(data.qcEntries, range), [data.qcEntries, range, filters]);
  const prevQC = useMemo(() => filterQC(data.qcEntries, prev), [data.qcEntries, prev, filters]);

  const approvedFG = useMemo(() =>
    data.finishedGoods.filter((g) => g.manuallyApproved === true), [data.finishedGoods]);

  // ── KPI computations ───────────────────────────────────────────────────────
  const kpis = useMemo((): KpiData[] => {
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => arr.length ? sum(arr) / arr.length : 0;

    const totalProd = sum(prod.map((e) => e.goodIngots ?? 0));
    const prevTotalProd = sum(prevProd.map((e) => e.goodIngots ?? 0));

    const finishedStock = sum(approvedFG.map((g) => g.remainingWeightKg ?? 0));
    const rawStock = sum(data.inventoryItems.map((i) => i.currentStockKg ?? 0));

    const avgRecovery = avg(prod.map((e) => e.efficiencyPercentage ?? 0));
    const prevAvgRecovery = avg(prevProd.map((e) => e.efficiencyPercentage ?? 0));

    const totalInput = sum(prod.map((e) => e.totalInput ?? 0));
    const prevTotalInput = sum(prevProd.map((e) => e.totalInput ?? 0));

    const totalDispatch = sum(dispatches.map((d) => d.totalDispatchWeightKg ?? 0));
    const prevTotalDispatch = sum(prevDispatches.map((d) => d.totalDispatchWeightKg ?? 0));

    const avgCost = avg(cost.map((c) => c.totalProductionCostPerKg ?? 0));
    const prevAvgCost = avg(prevCost.map((c) => c.totalProductionCostPerKg ?? 0));

    const avgSelling = avg(cost.map((c) => c.sellingPricePerKg ?? 0));
    const prevAvgSelling = avg(prevCost.map((c) => c.sellingPricePerKg ?? 0));

    const totalHours = sum(prod.map(calcShiftHours));
    const prevTotalHours = sum(prevProd.map(calcShiftHours));

    const passCount = qc.filter((q) => q.overallStatus === 'PASS').length;
    const passRate = qc.length ? (passCount / qc.length) * 100 : 0;
    const prevPassCount = prevQC.filter((q) => q.overallStatus === 'PASS').length;
    const prevPassRate = prevQC.length ? (prevPassCount / prevQC.length) * 100 : 0;

    return [
      { label: 'Total Production', value: totalProd, prevValue: prevTotalProd, unit: 'kg', format: 'weight', icon: 'factory', color: '#1565C0' },
      { label: 'Finished Stock', value: finishedStock, prevValue: 0, unit: 'kg', format: 'weight', icon: 'package', color: '#0d47a1' },
      { label: 'Raw Material Stock', value: rawStock, prevValue: 0, unit: 'kg', format: 'weight', icon: 'layers', color: '#1976d2' },
      { label: 'Avg Recovery', value: avgRecovery, prevValue: prevAvgRecovery, unit: '%', format: 'percent', icon: 'trending', color: '#2e7d32' },
      { label: 'Total Input Material', value: totalInput, prevValue: prevTotalInput, unit: 'kg', format: 'weight', icon: 'inbox', color: '#1565C0' },
      { label: 'Total Dispatch', value: totalDispatch, prevValue: prevTotalDispatch, unit: 'kg', format: 'weight', icon: 'truck', color: '#0277bd' },
      { label: 'Avg Production Cost', value: avgCost, prevValue: prevAvgCost, unit: '₹/kg', format: 'currency', icon: 'rupee', color: '#c62828' },
      { label: 'Avg Selling Price', value: avgSelling, prevValue: prevAvgSelling, unit: '₹/kg', format: 'currency', icon: 'rupee', color: '#2e7d32' },
      { label: 'Production Hours', value: totalHours, prevValue: prevTotalHours, unit: 'hrs', format: 'hours', icon: 'clock', color: '#6a1b9a' },
      { label: 'QC Pass Rate', value: passRate, prevValue: prevPassRate, unit: '%', format: 'percent', icon: 'check', color: '#00695c' },
    ];
  }, [prod, prevProd, cost, prevCost, dispatches, prevDispatches, qc, prevQC, approvedFG, data.inventoryItems]);

  // ── Chart analytics ────────────────────────────────────────────────────────
  const analytics = useMemo((): Omit<DashboardAnalytics, 'kpis'> => {

    // Daily Production Trend
    const prodBuckets = buildDateBuckets(range);
    prod.forEach((e) => {
      const d = tsDate(e.date);
      if (!d) return;
      const k = fmtDateKey(d);
      if (prodBuckets.has(k)) prodBuckets.set(k, (prodBuckets.get(k) ?? 0) + (e.goodIngots ?? 0));
    });
    const dailyProductionTrend: TimeSeriesPoint[] = Array.from(prodBuckets.entries()).map(([k, v]) => ({
      date: fmtLabel(new Date(k)),
      value: Math.round(v * 10) / 10,
    }));

    // Input vs Output (top 15 heats by goodIngots)
    const inputVsOutput: NamedValue[] = prod
      .slice(0, 15)
      .map((e) => ({ name: e.heatNo, value: e.goodIngots ?? 0, value2: e.totalInput ?? 0 }));

    // Alloy-wise Production
    const alloyMap = new Map<string, number>();
    prod.forEach((e) => {
      const k = e.alloyType || 'Unknown';
      alloyMap.set(k, (alloyMap.get(k) ?? 0) + (e.goodIngots ?? 0));
    });
    const alloyWiseProduction: NamedValue[] = Array.from(alloyMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10, color: getColorForAlloy(name) }))
      .sort((a, b) => b.value - a.value);

    // Production Hours Trend
    const hourBuckets = buildDateBuckets(range);
    prod.forEach((e) => {
      const d = tsDate(e.date);
      if (!d) return;
      const k = fmtDateKey(d);
      if (hourBuckets.has(k)) hourBuckets.set(k, (hourBuckets.get(k) ?? 0) + calcShiftHours(e));
    });
    const productionHoursTrend: TimeSeriesPoint[] = Array.from(hourBuckets.entries()).map(([k, v]) => ({
      date: fmtLabel(new Date(k)),
      value: Math.round(v * 10) / 10,
    }));

    // Raw Material Stock
    const rawMaterialStock: NamedValue[] = data.inventoryItems
      .filter((i) => i.currentStockKg > 0)
      .map((i) => ({ name: i.materialCode || i.materialName, value: i.currentStockKg, color: getColorForMaterial(i.materialCode || i.materialName) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    // Material Consumption (from production)
    const consumptionMap = new Map<string, number>();
    prod.forEach((e) => {
      (e.materials || []).forEach((m) => {
        const k = m.materialCode || m.materialName;
        consumptionMap.set(k, (consumptionMap.get(k) ?? 0) + (m.weightKg ?? 0));
      });
    });
    const materialConsumption: NamedValue[] = Array.from(consumptionMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10, color: getColorForMaterial(name) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const materialShare: NamedValue[] = materialConsumption.map((m) => ({
      ...m,
      color: getColorForMaterial(m.name),
    }));

    // Cost & Selling Price Trend (grouped by date)
    const costBuckets = new Map<string, { costVals: number[]; sellingVals: number[] }>();
    const initDate = new Date(range.start);
    while (initDate <= range.end) {
      costBuckets.set(fmtDateKey(initDate), { costVals: [], sellingVals: [] });
      initDate.setDate(initDate.getDate() + 1);
    }
    cost.forEach((c) => {
      const d = tsDate(c.date);
      if (!d) return;
      const k = fmtDateKey(d);
      const bucket = costBuckets.get(k);
      if (bucket) {
        if (c.totalProductionCostPerKg > 0) bucket.costVals.push(c.totalProductionCostPerKg);
        if (c.sellingPricePerKg > 0) bucket.sellingVals.push(c.sellingPricePerKg);
      }
    });
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const costTrend: TimeSeriesPoint[] = Array.from(costBuckets.entries())
      .filter(([, b]) => b.costVals.length > 0 || b.sellingVals.length > 0)
      .map(([k, b]) => ({
        date: fmtLabel(new Date(k)),
        value: Math.round(avg(b.costVals) * 100) / 100,
        value2: Math.round(avg(b.sellingVals) * 100) / 100,
      }));

    // Material Cost Distribution (from cost ledger)
    const matCostMap = new Map<string, number>();
    cost.forEach((c) => {
      (c.materials || []).forEach((m) => {
        const k = m.materialCode || m.materialName;
        matCostMap.set(k, (matCostMap.get(k) ?? 0) + (m.amount ?? 0));
      });
    });
    const materialCostDistribution: NamedValue[] = Array.from(matCostMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value), color: getColorForMaterial(name) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Dispatch Trend
    const dispBuckets = buildDateBuckets(range);
    dispatches.forEach((d) => {
      const dt = tsDate(d.dispatchDate);
      if (!dt) return;
      const k = fmtDateKey(dt);
      if (dispBuckets.has(k)) dispBuckets.set(k, (dispBuckets.get(k) ?? 0) + (d.totalDispatchWeightKg ?? 0));
    });
    const dispatchTrend: TimeSeriesPoint[] = Array.from(dispBuckets.entries()).map(([k, v]) => ({
      date: fmtLabel(new Date(k)),
      value: Math.round(v * 10) / 10,
    }));

    // Customer-wise Dispatch
    const custMap = new Map<string, number>();
    dispatches.forEach((d) => {
      const k = d.customerName || 'Unknown';
      custMap.set(k, (custMap.get(k) ?? 0) + (d.totalDispatchWeightKg ?? 0));
    });
    const customerWiseDispatch: NamedValue[] = Array.from(custMap.entries())
      .map(([name, value], i) => ({ name, value: Math.round(value * 10) / 10, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Vehicle Utilization
    const vehicleMap = new Map<string, number>();
    dispatches.forEach((d) => {
      const k = d.vehicleNumber || 'Unknown';
      vehicleMap.set(k, (vehicleMap.get(k) ?? 0) + 1);
    });
    const vehicleUtilization: NamedValue[] = Array.from(vehicleMap.entries())
      .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Efficiency Trend
    const effBuckets = new Map<string, number[]>();
    const effInitDate = new Date(range.start);
    while (effInitDate <= range.end) {
      effBuckets.set(fmtDateKey(effInitDate), []);
      effInitDate.setDate(effInitDate.getDate() + 1);
    }
    prod.forEach((e) => {
      const d = tsDate(e.date);
      if (!d) return;
      const k = fmtDateKey(d);
      const b = effBuckets.get(k);
      if (b && e.efficiencyPercentage > 0) b.push(e.efficiencyPercentage);
    });
    const efficiencyTrend: TimeSeriesPoint[] = Array.from(effBuckets.entries())
      .filter(([, vals]) => vals.length > 0)
      .map(([k, vals]) => ({
        date: fmtLabel(new Date(k)),
        value: Math.round(avg(vals) * 100) / 100,
      }));

    // QC Pass/Fail
    const passCount = qc.filter((q) => q.overallStatus === 'PASS').length;
    const failCount = qc.filter((q) => q.overallStatus === 'FAIL').length;
    const qualityPassFail: NamedValue[] = [
      { name: 'PASS', value: passCount, color: '#2e7d32' },
      { name: 'FAIL', value: failCount, color: '#c62828' },
    ];

    // Shift Performance
    const shiftMap = new Map<string, number[]>();
    prod.forEach((e) => {
      const s = detectShift(e);
      if (!shiftMap.has(s)) shiftMap.set(s, []);
      if (e.efficiencyPercentage > 0) shiftMap.get(s)!.push(e.efficiencyPercentage);
    });
    const shiftPerformance: NamedValue[] = [
      { name: 'Morning', value: Math.round(avg(shiftMap.get('Morning') ?? []) * 100) / 100, color: '#f59e0b' },
      { name: 'Afternoon', value: Math.round(avg(shiftMap.get('Afternoon') ?? []) * 100) / 100, color: '#f97316' },
      { name: 'Night', value: Math.round(avg(shiftMap.get('Night') ?? []) * 100) / 100, color: '#6366f1' },
    ];

    // Loss Analysis (waterfall as simple bar)
    const totalInputAll = prod.reduce((s, e) => s + (e.totalInput ?? 0), 0);
    const totalOutputAll = prod.reduce((s, e) => s + (e.goodIngots ?? 0), 0);
    const totalFinished = approvedFG.reduce((s, g) => s + (g.goodOutputKg ?? 0), 0);
    const totalDispatchedAll = dispatches.reduce((s, d) => s + (d.totalDispatchWeightKg ?? 0), 0);
    const lossAnalysis: NamedValue[] = [
      { name: 'Total Input', value: Math.round(totalInputAll), color: '#4f46e5' },
      { name: 'Production Loss', value: Math.round(totalInputAll - totalOutputAll), color: '#dc2626' },
      { name: 'Finished Goods', value: Math.round(totalFinished), color: '#10b981' },
      { name: 'Dispatched', value: Math.round(totalDispatchedAll), color: '#06b6d4' },
    ];

    return {
      dailyProductionTrend,
      inputVsOutput,
      alloyWiseProduction,
      productionHoursTrend,
      rawMaterialStock,
      materialConsumption,
      materialShare,
      costTrend,
      materialCostDistribution,
      dispatchTrend,
      customerWiseDispatch,
      vehicleUtilization,
      efficiencyTrend,
      qualityPassFail,
      shiftPerformance,
      lossAnalysis,
    };
  }, [prod, cost, dispatches, qc, data.inventoryItems, approvedFG, range]);

  // ── Unique filter options ───────────────────────────────────────────────────
  const filterOptions = useMemo(() => ({
    alloyTypes: Array.from(new Set(data.productionEntries.map((e) => e.alloyType).filter(Boolean))).sort(),
    furnaceNos: Array.from(new Set(data.productionEntries.map((e) => e.furnaceNo ?? '').filter(Boolean))).sort(),
    supervisors: Array.from(new Set(data.productionEntries.map((e) => e.supervisorName ?? '').filter(Boolean))).sort(),
    customers: Array.from(new Set(data.dispatches.map((d) => d.customerName).filter(Boolean))).sort(),
    shifts: ['Morning', 'Afternoon', 'Night'],
  }), [data]);

  return {
    filters,
    setFilters,
    filterOptions,
    range,
    analytics: { kpis, ...analytics } as DashboardAnalytics,
    filteredCounts: {
      production: prod.length,
      dispatch: dispatches.length,
      qc: qc.length,
    },
  };
};
