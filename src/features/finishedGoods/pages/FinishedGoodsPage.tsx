import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Button, IconButton,
  Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Skeleton, Select, MenuItem, FormControl,
  InputLabel, TextField, Chip, LinearProgress,
} from '@mui/material';
import {
  Package, Edit, Search, ChevronLeft, ChevronRight,
  ArrowUpDown, X, Layers, Truck, IndianRupee,
  CheckCircle2, Archive, ChevronDown,
  BarChart3, TableIcon,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

import {
  fetchFinishedGoods,
  updateFinishedGood,
  approveFinishedGood,
} from '../services/finishedGoods.service';
import type {
  FinishedGoodEntry,
  FinishedGoodStatus,
  FinishedGoodEditFormData,
  FinishedGoodsGroup,
} from '../types/finishedGoods.types';
import { fetchProductionLedger } from '../../productionLedger/services/productionLedger.service';
import type { ProductionLedgerEntry } from '../../productionLedger/types/productionLedger.types';
import { fetchCostLedger } from '../../costLedger/services/costLedger.service';
import type { CostLedgerEntry } from '../../costLedger/types/costLedger.types';
import { fetchQualityControlEntries } from '../../qualityControl/services/qualityControl.service';
import type { QualityControlEntry } from '../../qualityControl/types/qualityControl.types';


// ─── Constants & Colors ───────────────────────────────────────────────────────
const THEME_BLUE = '#1565C0';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtDate = (ts: Timestamp | undefined | null) => {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtMoney = (val: number | undefined | null) => {
  if (val === undefined || val === null || val === 0) return '—';
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtKg = (val: number | undefined | null) => {
  if (val === undefined || val === null) return '—';
  return val.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' kg';
};

// ─── Status Config (Blue tones only) ─────────────────────────────────────────
const STATUS_CONFIG: Record<FinishedGoodStatus, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  'Available':           { color: '#1565C0', bg: '#eff6ff', border: '#bfdbfe', icon: <CheckCircle2 size={10} /> },
  'Partially Dispatched': { color: '#0d47a1', bg: '#eff6ff', border: '#bfdbfe', icon: <Truck size={10} /> },
  'Fully Dispatched':     { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: <Archive size={10} /> },
};

const StatusBadge = ({ status }: { status: FinishedGoodStatus }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Available'];
  return (
    <span
      className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.icon} {status}
    </span>
  );
};

// ─── Heat Hover Details (Structured details on hover) ──────────────────────────
interface HeatHoverDetailsProps {
  heatNo: string;
  productionEntries: ProductionLedgerEntry[];
  costEntries: CostLedgerEntry[];
}

const HeatHoverDetails = ({ heatNo, productionEntries, costEntries }: HeatHoverDetailsProps) => {
  const prod = productionEntries.find((p) => p.heatNo === heatNo);
  const cost = costEntries.find((c) => c.heatNo === heatNo);

  if (!prod) {
    return (
      <Box sx={{ p: 1, minWidth: 200 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>
          Production ledger entry not found for heat {heatNo}
        </Typography>
      </Box>
    );
  }

  // Formatting date
  const dateStr = prod.date
    ? prod.date.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  // Materials list
  // The cost entry will have rates and amounts.
  // We can merge materials from production (which has weights) and cost (which has rates and amounts).
  // Actually, cost.materials already contains the full list of weights, rates, and amounts.
  // Let's use cost.materials if available, otherwise fallback to prod.materials.
  const materials = cost?.materials || prod.materials || [];

  const totalProductionCost = cost 
    ? (cost.productionCostPerKg ?? 0) * (cost.goodIngotsKg ?? 0)
    : 0;

  return (
    <Box sx={{ p: 1.5, minWidth: 280, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Header */}
      <Box sx={{ borderBottom: '1px solid #e2e8f0', pb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>
          Heat No: <span style={{ color: '#1565C0' }}>{heatNo}</span>
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
            Date: {dateStr}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#2e7d32', fontWeight: 700 }}>
            Efficiency: {prod.efficiencyPercentage !== undefined ? `${prod.efficiencyPercentage.toFixed(2)}%` : '—'}
          </Typography>
        </Box>
      </Box>

      {/* Materials Table */}
      <Box>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75 }}>
          Material Breakdown
        </Typography>
        {materials.length === 0 ? (
          <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
            No materials recorded.
          </Typography>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                <th style={{ paddingBottom: 4, fontWeight: 700, color: '#64748b' }}>Material</th>
                <th style={{ paddingBottom: 4, textAlign: 'right', fontWeight: 700, color: '#64748b' }}>Qty</th>
                <th style={{ paddingBottom: 4, textAlign: 'right', fontWeight: 700, color: '#64748b' }}>Rate</th>
                <th style={{ paddingBottom: 4, textAlign: 'right', fontWeight: 700, color: '#64748b' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m: any, idx) => {
                const qty = m.weightKg ?? 0;
                const rate = m.ratePerKg ?? m.rate ?? 0;
                const amt = m.amount ?? (qty * rate);
                if (qty === 0) return null; // Only show materials that were actually used
                return (
                  <tr key={m.materialId || idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ paddingTop: 3, paddingBottom: 3, fontWeight: 600, color: '#334155' }}>{m.materialCode || m.materialName}</td>
                    <td style={{ paddingTop: 3, paddingBottom: 3, textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>{qty.toLocaleString()} kg</td>
                    <td style={{ paddingTop: 3, paddingBottom: 3, textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{rate > 0 ? `₹${rate.toFixed(1)}` : '—'}</td>
                    <td style={{ paddingTop: 3, paddingBottom: 3, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1e293b' }}>{amt > 0 ? `₹${amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Box>

      {/* Production Cost Summary */}
      <Box sx={{ borderTop: '1px solid #e2e8f0', pt: 1 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75 }}>
          Cost Summary
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Total Prod. Cost:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
              {totalProductionCost > 0 ? `₹${totalProductionCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
            </span>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Prod. Cost per Kg:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1565C0' }}>
              {cost?.totalProductionCostPerKg ? `₹${cost.totalProductionCostPerKg.toLocaleString('en-IN')}/kg` : (cost?.productionCostPerKg ? `₹${cost.productionCostPerKg.toLocaleString('en-IN')}/kg` : '—')}
            </span>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

// ─── QC Hover Details (Rich popup matching mobile QC report design) ───────────
interface QCHoverDetailsProps {
  qcEntry: import('../../qualityControl/types/qualityControl.types').QualityControlEntry;
}

const QCHoverDetails = ({ qcEntry }: QCHoverDetailsProps) => {
  const fmtTs = (ts: any) => {
    if (!ts) return '—';
    try { return ts.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  const shiftStr = `${qcEntry.shiftStartTime} ${qcEntry.shiftStartPeriod} – ${qcEntry.shiftEndTime} ${qcEntry.shiftEndPeriod}`;
  const isPass = qcEntry.overallStatus === 'PASS';

  return (
    <Box sx={{ p: 1.5, minWidth: 300, maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Header ── */}
      <Box sx={{ borderBottom: '1px solid #e2e8f0', pb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e293b' }}>
          HEAT <span style={{ color: '#1565C0' }}>#{qcEntry.heatNo}</span>
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mt: 0.25, fontWeight: 500 }}>
          Quality Control Report
        </Typography>
      </Box>

      {/* ── Info rows ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {[
          { label: 'Date',           value: fmtTs(qcEntry.date) },
          { label: 'Alloy Type',     value: qcEntry.alloyType },
          { label: 'Furnace',        value: qcEntry.furnaceNo },
          { label: 'Shift',          value: shiftStr },
          { label: 'Operator',       value: qcEntry.operatorName },
          { label: 'Supervisor',     value: qcEntry.supervisorName },
        ].map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#1e293b', fontWeight: 700, textAlign: 'right' }}>{value || '—'}</Typography>
          </Box>
        ))}

        {/* Overall status row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>Overall Status</Typography>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: '0.68rem', fontWeight: 800, paddingInline: 8, paddingBlock: 2,
            borderRadius: 3, lineHeight: 1.6,
            background: isPass ? '#dcfce7' : '#fee2e2',
            color: isPass ? '#15803d' : '#dc2626',
            border: `1px solid ${isPass ? '#86efac' : '#fca5a5'}`,
          }}>
            {isPass ? '✓' : '✗'} {qcEntry.overallStatus}
          </span>
        </Box>

        {/* Verification row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>Verification</Typography>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: qcEntry.verified ? '#15803d' : '#64748b' }}>
            {qcEntry.verified ? 'Verified' : 'Not Verified'}
          </Typography>
        </Box>

        {qcEntry.verifiedBy && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>Verified By</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#1e293b', fontWeight: 700 }}>{qcEntry.verifiedBy}</Typography>
          </Box>
        )}

        {qcEntry.verificationRemarks && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>Remarks</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600, textAlign: 'right', maxWidth: 200 }}>{qcEntry.verificationRemarks}</Typography>
          </Box>
        )}
      </Box>

      {/* ── Chemical Composition ── */}
      {qcEntry.elements && qcEntry.elements.length > 0 && (
        <Box sx={{ borderTop: '1px solid #e2e8f0', pt: 1 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75 }}>
            Chemical Composition
          </Typography>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
            <tbody>
              {qcEntry.elements.map((el, i) => {
                const elPass = el.status === 'PASS';
                return (
                  <tr key={el.element + i} style={{ borderBottom: i < qcEntry.elements.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <td style={{ paddingTop: 3, paddingBottom: 3, fontWeight: 700, color: '#334155', width: 36 }}>
                      {el.element}
                    </td>
                    <td style={{ paddingTop: 3, paddingBottom: 3, textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                      {el.observedValue.toFixed(2)}{el.unit} ({el.minValue}–{el.maxValue})
                    </td>
                    <td style={{ paddingTop: 3, paddingBottom: 3, paddingLeft: 6, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '0.64rem', fontWeight: 800,
                        color: elPass ? '#15803d' : '#dc2626',
                      }}>
                        → {el.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );
};

// ─── Alloy Color Bubble (Unified Blue tone) ─────────────────────────────────
const AlloybBubble = ({ name }: { name: string; color?: string }) => {
  return (
    <span
      className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black tracking-wide shadow-sm"
      style={{ background: THEME_BLUE, color: '#ffffff', border: `2px solid ${THEME_BLUE}CC` }}
    >
      {name}
    </span>
  );
};

// ─── KPI Card (Unified Blue tone) ─────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}

const KpiCard = ({ icon, label, value, sub, loading }: KpiCardProps) => (
  <Card sx={{ borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', height: '100%' }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, background: '#eff6ff', color: THEME_BLUE, display: 'flex', flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5 }}>
            {label}
          </Typography>
          {loading
            ? <Skeleton width={80} height={28} />
            : <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>{value}</Typography>
          }
          {sub && !loading && (
            <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mt: 0.25, fontWeight: 500 }}>{sub}</Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

// ─── Edit Dialog ──────────────────────────────────────────────────────────────
interface EditDialogProps {
  open: boolean;
  entry: FinishedGoodEntry | null;
  onClose: () => void;
  onSave: (form: FinishedGoodEditFormData) => Promise<void>;
}

const STATUS_OPTIONS: FinishedGoodStatus[] = [
  'Available', 'Partially Dispatched', 'Fully Dispatched',
];

const EditDialog = ({ open, entry, onClose, onSave }: EditDialogProps) => {
  const [form, setForm] = useState<FinishedGoodEditFormData>({
    estimatedSellingPrice: 0,
    dispatchedWeightKg: 0,
    dispatchedPieces: 0,
    status: 'Available',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry && open) {
      setForm({
        estimatedSellingPrice: entry.estimatedSellingPrice ?? 0,
        dispatchedWeightKg: entry.dispatchedWeightKg ?? 0,
        dispatchedPieces: entry.dispatchedPieces ?? 0,
        status: entry.status ?? 'Available',
      });
      setError('');
    }
  }, [entry, open]);

  const handleSave = async () => {
    if (!entry) return;
    if (form.dispatchedWeightKg < 0) { setError('Dispatched weight cannot be negative.'); return; }
    if (form.dispatchedWeightKg > entry.goodOutputKg) { setError(`Dispatched weight cannot exceed output weight (${entry.goodOutputKg} kg).`); return; }
    if (form.dispatchedPieces < 0) { setError('Dispatched pieces cannot be negative.'); return; }
    if (form.dispatchedPieces > entry.numberOfPieces) { setError(`Dispatched pieces cannot exceed produced pieces (${entry.numberOfPieces} pcs).`); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const remainingPreview = Math.max(0, (entry?.goodOutputKg ?? 0) - form.dispatchedWeightKg);
  const remainingPiecesPreview = Math.max(0, (entry?.numberOfPieces ?? 0) - form.dispatchedPieces);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{ paper: { className: 'rounded-2xl text-slate-800' } }}
    >
      <DialogTitle className="flex items-center justify-between border-b border-slate-100 py-4 px-6 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-700 text-white rounded-lg">
            <Edit size={16} />
          </div>
          <div>
            <Typography className="font-bold text-base leading-tight">Edit Finished Good</Typography>
            <Typography className="text-xs text-slate-500 font-normal">
              Heat: <strong>{entry?.heatNo}</strong> · {entry?.alloyType}
            </Typography>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </DialogTitle>

      <DialogContent className="py-5 px-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">{error}</div>
        )}

        {/* Read-only summary */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
          <div>
            <p className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Good Output / Remaining</p>
            <p className="font-bold text-slate-700">{fmtKg(entry?.goodOutputKg)} / <span className="text-blue-700">{fmtKg(remainingPreview)}</span></p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Pieces Produced / Remaining</p>
            <p className="font-bold text-slate-700">{(entry?.numberOfPieces ?? 0).toLocaleString()} / <span className="text-blue-700">{(remainingPiecesPreview).toLocaleString()}</span></p>
          </div>
        </div>

        <TextField
          label="Estimated Selling Price (₹/kg)"
          type="number"
          fullWidth
          size="small"
          value={form.estimatedSellingPrice || ''}
          onChange={(e) => setForm((p) => ({ ...p, estimatedSellingPrice: parseFloat(e.target.value) || 0 }))}
          slotProps={{ input: { startAdornment: <span className="text-xs text-slate-400 mr-1 font-semibold">₹</span>, endAdornment: <span className="text-xs text-slate-400 font-semibold">/kg</span> } }}
        />

        <TextField
          label="Dispatched Weight (kg)"
          type="number"
          fullWidth
          size="small"
          value={form.dispatchedWeightKg || ''}
          onChange={(e) => setForm((p) => ({ ...p, dispatchedWeightKg: parseFloat(e.target.value) || 0 }))}
          slotProps={{ input: { endAdornment: <span className="text-xs text-slate-400 font-semibold">kg</span> } }}
          helperText={`Max: ${entry?.goodOutputKg ?? 0} kg`}
        />

        <TextField
          label="Dispatched Pieces"
          type="number"
          fullWidth
          size="small"
          value={form.dispatchedPieces || ''}
          onChange={(e) => setForm((p) => ({ ...p, dispatchedPieces: parseInt(e.target.value, 10) || 0 }))}
          slotProps={{ input: { endAdornment: <span className="text-xs text-slate-400 font-semibold">pcs</span> } }}
          helperText={`Max: ${entry?.numberOfPieces ?? 0} pcs`}
        />

        <FormControl fullWidth size="small">
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as FinishedGoodStatus }))}
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>

      <DialogActions className="border-t border-slate-100 py-3 px-6 gap-2 bg-slate-50/50">
        <Button onClick={onClose} variant="outlined" disabled={saving} className="text-slate-600 border-slate-300 rounded-lg px-4">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving} className="bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-6 font-semibold">
          {saving ? <CircularProgress size={16} className="text-white" /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Alloy Overview Card (Redesigned as requested) ──────────────────────────
interface AlloyCardProps {
  group: FinishedGoodsGroup;
  onClick: () => void;
}

const AlloyOverviewCard = ({ group, onClick }: AlloyCardProps) => {
  const activeHeats = group.entries.filter(
    (e) => e.status === 'Available' || e.status === 'Partially Dispatched'
  ).length;

  const totalValue = group.entries.reduce(
    (s, e) => s + (e.remainingWeightKg ?? 0) * (e.estimatedSellingPrice ?? 0),
    0
  );

  const dispatchPct = group.totalGoodOutputKg > 0
    ? Math.min(100, (group.totalDispatchedKg / group.totalGoodOutputKg) * 100)
    : 0;

  const formattedValue = totalValue > 0
    ? '₹' + (totalValue / 1000).toFixed(1) + 'K'
    : '—';

  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: '32px',
        border: `1.5px solid #bfdbfe`,
        boxShadow: `0 4px 20px rgba(21, 101, 192, 0.05)`,
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: `0 12px 30px rgba(21, 101, 192, 0.12)`,
          transform: 'translateY(-4px)',
          borderColor: `#1565C0`,
        },
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        {/* Header: alloy bubble + heats active */}
        <div className="flex justify-between items-start mb-5">
          <AlloybBubble name={group.alloyType} />
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Heats (Active)</p>
            <p className="text-3xl font-black text-blue-700 leading-none">{activeHeats}</p>
          </div>
        </div>

        {/* Dynamic two-column rows */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Finished Goods</p>
            <p className="text-base font-black text-slate-800">{fmtKg(group.totalGoodOutputKg)}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Remaining Stock</p>
            <p className="text-base font-black text-emerald-700">{fmtKg(group.totalRemainingKg)}</p>
          </div>
        </div>

        {/* Total Inventory value */}
        <div className="bg-blue-50/70 rounded-2xl p-3.5 mb-4">
          <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-1">Total Inventory Value</p>
          <p className="text-xl font-black text-blue-700">{formattedValue}</p>
        </div>

        {/* Dispatch progress */}
        <div className="mb-4">
          <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
            <span>Dispatch Progress</span>
            <span>{dispatchPct.toFixed(1)}%</span>
          </div>
          <LinearProgress
            variant="determinate"
            value={dispatchPct}
            sx={{
              height: 6, borderRadius: 3,
              bgcolor: '#eff6ff',
              '& .MuiLinearProgress-bar': { bgcolor: THEME_BLUE, borderRadius: 3 },
            }}
          />
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-4">
          <span className="text-xs text-slate-400 font-semibold">{group.entries.length} total heats</span>
          <span className="text-xs font-black text-blue-700 flex items-center gap-0.5">
            View Details <ChevronDown size={12} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Alloy Detail Table (Redesigned with Pieces and Efficiency %) ────────────
interface AlloyDetailProps {
  group: FinishedGoodsGroup;
  isAdmin: boolean;
  onEdit: (entry: FinishedGoodEntry) => void;
  onBack: () => void;
  productionEntries: ProductionLedgerEntry[];
  costEntries: CostLedgerEntry[];
}

const AlloyDetailView = ({ group, isAdmin, onEdit, onBack, productionEntries, costEntries }: AlloyDetailProps) => {
  const stickyHead = 'bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]';
  const bodyCell = 'px-3 py-2 border-b border-slate-50 text-xs text-slate-700 whitespace-nowrap';

  const totalProdCost = group.entries.reduce(
    (s, e) => s + ((e.productionCostPerKg ?? 0) * (e.goodOutputKg ?? 0)), 0
  );

  const totalPieces = group.entries.reduce(
    (s, e) => s + (e.numberOfPieces ?? 0), 0
  );

  return (
    <div>
      {/* Back button + header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ChevronLeft size={14} /> All Alloys
        </button>
        <div className="flex items-center gap-2">
          <AlloybBubble name={group.alloyType} />
          <span className="text-sm font-bold text-slate-600">
            — {group.entries.length} heats · {fmtKg(group.totalGoodOutputKg)} output
          </span>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Output', value: fmtKg(group.totalGoodOutputKg), color: '#1e293b' },
          { label: 'Remaining', value: fmtKg(group.totalRemainingKg), color: '#1565C0' },
          { label: 'Dispatched', value: fmtKg(group.totalDispatchedKg), color: '#475569' },
          { label: 'Est. Value', value: fmtMoney(group.inventoryValue), color: THEME_BLUE },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-150 rounded-2xl p-3 shadow-sm">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{stat.label}</p>
            <p className="text-sm font-black" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Detail table */}
      <Card sx={{ borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: 3, background: THEME_BLUE }} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead className={stickyHead}>
              <tr>
                <th className="px-3 py-2 border-b border-slate-200 w-10 text-center">S.No</th>
                <th className="px-3 py-2 border-b border-slate-200">Heat No</th>
                <th className="px-3 py-2 border-b border-slate-200">Date</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Gross (kg)</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Output (kg)</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Efficiency</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Pieces Produced</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Total Prod. Cost</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Selling Price/kg</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Dispatched Pcs</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Remaining Pcs</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Dispatched Wt (kg)</th>
                <th className="px-3 py-2 border-b border-slate-200 text-right">Remaining Wt (kg)</th>
                <th className="px-3 py-2 border-b border-slate-200">Status</th>
                {isAdmin && <th className="px-3 py-2 border-b border-slate-200 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {group.entries.map((row, idx) => {
                const isFullyDispatched = row.status === 'Fully Dispatched';
                const totalProdCostRow = (row.productionCostPerKg ?? 0) * (row.goodOutputKg ?? 0);
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    style={{ opacity: isFullyDispatched ? 0.42 : 1 }}
                  >
                    <td className={`${bodyCell} text-center text-slate-400 font-mono font-bold`}>{idx + 1}</td>
                    <td className={`${bodyCell} font-bold text-blue-700`}>
                      <Tooltip
                        title={<HeatHoverDetails heatNo={row.heatNo} productionEntries={productionEntries} costEntries={costEntries} />}
                        placement="right"
                        slotProps={{
                          tooltip: {
                            sx: {
                              bgcolor: '#ffffff',
                              color: '#0f172a',
                              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                              border: '1px solid #e2e8f0',
                              borderRadius: 2,
                              p: 0,
                              maxWidth: 400,
                            }
                          }
                        }}
                      >
                        <span className="cursor-pointer hover:underline">{row.heatNo}</span>
                      </Tooltip>
                    </td>
                    <td className={bodyCell}>{fmtDate(row.productionDate)}</td>
                    <td className={`${bodyCell} text-right font-mono`}>{fmtKg(row.grossWeightKg)}</td>
                    <td className={`${bodyCell} text-right font-mono font-semibold text-slate-800`}>{fmtKg(row.goodOutputKg)}</td>
                    <td className={`${bodyCell} text-right font-mono font-semibold text-blue-700`}>
                      {row.efficiencyPercentage !== undefined ? `${row.efficiencyPercentage.toFixed(2)}%` : '—'}
                    </td>
                    <td className={`${bodyCell} text-right font-mono`}>{row.numberOfPieces || 0}</td>
                    <td className={`${bodyCell} text-right font-mono text-slate-700 font-semibold`}>
                      {totalProdCostRow > 0 ? '₹' + totalProdCostRow.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
                    </td>
                    <td className={`${bodyCell} text-right font-mono text-blue-800 font-bold`}>{fmtMoney(row.estimatedSellingPrice)}</td>
                    <td className={`${bodyCell} text-right font-mono text-blue-700`}>{(row.dispatchedPieces || 0).toLocaleString()}</td>
                    <td className={`${bodyCell} text-right font-mono font-bold text-slate-800`}>{(row.remainingPieces || 0).toLocaleString()}</td>
                    <td className={`${bodyCell} text-right font-mono text-blue-700`}>{fmtKg(row.dispatchedWeightKg)}</td>
                    <td className={`${bodyCell} text-right font-mono font-bold text-slate-800`}>{fmtKg(row.remainingWeightKg)}</td>
                    <td className={bodyCell}><StatusBadge status={row.status} /></td>
                    {isAdmin && (
                      <td className={`${bodyCell} text-center`}>
                        <Tooltip title="Edit Entry">
                          <IconButton
                            size="small"
                            onClick={() => onEdit(row)}
                            sx={{ color: THEME_BLUE, '&:hover': { background: '#eff6ff' } }}
                          >
                            <Edit size={13} />
                          </IconButton>
                        </Tooltip>
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr className="border-t-2" style={{ borderColor: `#bfdbfe`, background: `#f8fafc` }}>
                <td colSpan={3} className="px-3 py-2 text-xs font-black uppercase tracking-wider text-blue-800">
                  {group.alloyType} Totals
                </td>
                <td className="px-3 py-2 text-right text-xs font-black font-mono text-slate-700">
                  {fmtKg(group.entries.reduce((s, e) => s + (e.grossWeightKg ?? 0), 0))}
                </td>
                <td className="px-3 py-2 text-right text-xs font-black font-mono text-blue-800">
                  {fmtKg(group.totalGoodOutputKg)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-slate-500">—</td>
                <td className="px-3 py-2 text-right text-xs font-black font-mono text-slate-700">
                  {totalPieces.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-xs font-black font-mono text-slate-700">
                  {'₹' + totalProdCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-slate-500">—</td>
                <td className="px-3 py-2 text-right text-xs font-black font-mono text-blue-700">
                  {group.entries.reduce((s, e) => s + (e.dispatchedPieces ?? 0), 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-xs font-black font-mono text-slate-800">
                  {group.entries.reduce((s, e) => s + (e.remainingPieces ?? 0), 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-xs font-black font-mono text-blue-700">
                  {fmtKg(group.totalDispatchedKg)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-black font-mono text-slate-800">
                  {fmtKg(group.totalRemainingKg)}
                </td>
                <td colSpan={isAdmin ? 2 : 1} />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const FinishedGoodsPage = () => {
  const isAdmin = true;

  const [entries, setEntries] = useState<FinishedGoodEntry[]>([]);
  const [productionEntries, setProductionEntries] = useState<ProductionLedgerEntry[]>([]);
  const [costEntries, setCostEntries] = useState<CostLedgerEntry[]>([]);
  const [qcEntries, setQcEntries] = useState<QualityControlEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingHeatNo, setApprovingHeatNo] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<FinishedGoodEntry | null>(null);

  // View mode: 'group' (card overview), 'table' (flat), or 'approval' (pending queue)
  const [viewMode, setViewMode] = useState<'group' | 'table' | 'approval'>('group');

  // Which alloy group is expanded in drilldown (null = overview cards)
  const [selectedAlloy, setSelectedAlloy] = useState<string | null>(null);

  // Filters
  const [searchHeat, setSearchHeat] = useState('');
  const [alloyFilter, setAlloyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<FinishedGoodStatus | ''>('');

  // Sort (table view)
  const [sortKey, setSortKey] = useState<string>('productionDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination (table view)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [data, prodData, costData, qcData] = await Promise.all([
        fetchFinishedGoods(),
        fetchProductionLedger(),
        fetchCostLedger(),
        fetchQualityControlEntries(),
      ]);
      setEntries(data);
      setProductionEntries(prodData);
      setCostEntries(costData);
      setQcEntries(qcData);
    } catch (err) {
      console.error('Failed to load finished goods', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Approval Handler ────────────────────────────────────────────────────────
  const handleApprove = async (prod: ProductionLedgerEntry, costEntry: CostLedgerEntry | null) => {
    setApprovingHeatNo(prod.heatNo);
    try {
      await approveFinishedGood(prod, costEntry);
      await load();
    } catch (err) {
      console.error("Failed to approve heat:", err);
      alert("Failed to approve heat: " + (err as any).message);
    } finally {
      setApprovingHeatNo(null);
    }
  };

  // ── Unapproved Heats Selector (Approval Queue) ──────────────────────────────
  const unapprovedHeats = useMemo(() => {
    // A heat is only considered "already approved" when it was explicitly approved
    // via the Approval Queue (manuallyApproved === true).  Entries that snuck into
    // finishedGoods without that flag must still appear in the queue.
    const approvedHeatNos = new Set(
      entries.filter((e) => e.manuallyApproved === true).map((e) => e.heatNo)
    );

    // Keep only production entries with positive ingots and efficiency, and not approved yet
    const unapprovedProd = productionEntries.filter((p) => {
      const isProperProd = (p.goodIngots ?? 0) > 0 && (p.efficiencyPercentage ?? 0) > 0;
      return isProperProd && !approvedHeatNos.has(p.heatNo);
    });

    return unapprovedProd.map((prod) => {
      const costEntry = costEntries.find((c) => c.heatNo === prod.heatNo) || null;
      const isCostProper = costEntry !== null && (costEntry.totalProductionCostPerKg > 0 || costEntry.productionCostPerKg > 0);

      // QC: must have a verified, supervisor-submitted PASS report
      const qcEntry = qcEntries.find((q) => q.heatNo === prod.heatNo) || null;
      const isQcProper =
        qcEntry !== null &&
        qcEntry.supervisorSubmitted === true &&
        qcEntry.verified === true &&
        qcEntry.overallStatus === 'PASS';

      return {
        prod,
        costEntry,
        qcEntry,
        isProductionProper: true,
        isCostProper,
        isQcProper,
      };
    });
  }, [entries, productionEntries, costEntries, qcEntries]);

  // ── Approved Entries (Only explicitly approved via queue, with both prod and cost ledger) ───
  const approvedEntries = useMemo(() => {
    return entries.filter((e) => {
      if (e.manuallyApproved !== true) return false;
      const hasProd = productionEntries.some((p) => p.heatNo === e.heatNo);
      const hasCost = costEntries.some((c) => c.heatNo === e.heatNo && (c.totalProductionCostPerKg > 0 || c.productionCostPerKg > 0));
      return hasProd && hasCost;
    });
  }, [entries, productionEntries, costEntries]);

  // ── Unique filter values ──────────────────────────────────────────────────
  const uniqueAlloys = useMemo(
    () => Array.from(new Set(approvedEntries.map((e) => e.alloyType).filter(Boolean))).sort(),
    [approvedEntries],
  );

  // ── Analytics / KPIs ──────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const totalAvailable = approvedEntries.reduce((s, e) => s + (e.remainingWeightKg ?? 0), 0);
    const totalDispatched = approvedEntries.reduce((s, e) => s + (e.dispatchedWeightKg ?? 0), 0);
    const inventoryValue = approvedEntries.reduce(
      (s, e) => s + (e.remainingWeightKg ?? 0) * (e.estimatedSellingPrice ?? 0),
      0,
    );
    const totalOutput = approvedEntries.reduce((s, e) => s + (e.goodOutputKg ?? 0), 0);
    return { totalAvailable, totalDispatched, inventoryValue, totalOutput };
  }, [approvedEntries]);

  // ── Filter & Sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return approvedEntries.filter((e) => {
      if (searchHeat && !e.heatNo?.toLowerCase().includes(searchHeat.toLowerCase())) return false;
      if (alloyFilter && e.alloyType !== alloyFilter) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      return true;
    });
  }, [approvedEntries, searchHeat, alloyFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: any = (a as any)[sortKey];
      let bv: any = (b as any)[sortKey];
      if (sortKey === 'productionDate') {
        av = a.productionDate instanceof Timestamp ? a.productionDate.seconds : 0;
        bv = b.productionDate instanceof Timestamp ? b.productionDate.seconds : 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // ── Grouping ──────────────────────────────────────────────────────────────
  const groups: FinishedGoodsGroup[] = useMemo(() => {
    const map = new Map<string, FinishedGoodEntry[]>();
    sorted.forEach((e) => {
      const key = e.alloyType || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).map(([alloyType, grpEntries]) => ({
      alloyType,
      entries: grpEntries,
      totalGoodOutputKg: grpEntries.reduce((s, e) => s + (e.goodOutputKg ?? 0), 0),
      totalAvailableKg: grpEntries.reduce((s, e) => s + (e.availableWeightKg ?? 0), 0),
      totalDispatchedKg: grpEntries.reduce((s, e) => s + (e.dispatchedWeightKg ?? 0), 0),
      totalRemainingKg: grpEntries.reduce((s, e) => s + (e.remainingWeightKg ?? 0), 0),
      inventoryValue: grpEntries.reduce((s, e) => s + (e.remainingWeightKg ?? 0) * (e.estimatedSellingPrice ?? 0), 0),
    }));
  }, [sorted]);

  // Selected group for drilldown
  const selectedGroup = useMemo(
    () => groups.find((g) => g.alloyType === selectedAlloy) ?? null,
    [groups, selectedAlloy]
  );

  // ── Pagination (flat view) ─────────────────────────────────────────────────
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  useEffect(() => { setCurrentPage(1); }, [searchHeat, alloyFilter, statusFilter, pageSize]);

  const requestSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Edit save ──────────────────────────────────────────────────────────────
  const handleSaveEdit = async (form: FinishedGoodEditFormData) => {
    if (!editTarget) return;
    await updateFinishedGood(editTarget.id, form, editTarget.goodOutputKg, editTarget.numberOfPieces);
    await load();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const SortTh = ({ label, colKey, className = '' }: { label: string; colKey: string; className?: string }) => (
    <th
      onClick={() => requestSort(colKey)}
      className={`px-3 py-2 text-left border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors select-none ${className}`}
    >
      <div className="flex items-center gap-1">
        {label} <ArrowUpDown size={10} className="opacity-40" />
      </div>
    </th>
  );

  const stickyHead = 'bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]';
  const bodyCell = 'px-3 py-2 border-b border-slate-50 text-xs text-slate-700 whitespace-nowrap';

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%' }}>
      {/* ── Page Header ── */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ p: 1, background: 'linear-gradient(135deg,#1565C0,#1976d2)', borderRadius: 2, display: 'flex' }}>
              <Package size={22} color="#fff" />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>
              Finished Goods
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#64748b', ml: 6 }}>
            Verify and approve production heats to Finished Goods Inventory
          </Typography>
        </Box>
      </Box>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={<Package size={20} />} label="Available Stock" loading={loading}
          value={fmtKg(analytics.totalAvailable)} sub="remaining weight"
        />
        <KpiCard
          icon={<IndianRupee size={20} />} label="Inventory Value" loading={loading}
          value={loading ? '...' : '₹' + (analytics.inventoryValue / 1000).toFixed(1) + 'K'}
          sub="at selling price"
        />
        <KpiCard
          icon={<Truck size={20} />} label="Total Dispatched" loading={loading}
          value={fmtKg(analytics.totalDispatched)} sub="across all heats"
        />
        <KpiCard
          icon={<Layers size={20} />} label="Total Production" loading={loading}
          value={fmtKg(analytics.totalOutput)} sub="good output"
        />
      </div>

      {/* ── Filters & View Controls ── */}
      <Card sx={{ mb: 2.5, borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
        <CardContent sx={{ py: 2, px: 3, '&:last-child': { pb: 2 } }}>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchHeat}
                onChange={(e) => setSearchHeat(e.target.value)}
                placeholder="Search Heat No…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Alloy Filter */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Alloy Type</InputLabel>
              <Select label="Alloy Type" value={alloyFilter} onChange={(e) => setAlloyFilter(e.target.value)} sx={{ fontSize: '0.75rem' }}>
                <MenuItem value=""><em>All Alloys</em></MenuItem>
                {uniqueAlloys.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </Select>
            </FormControl>

            {/* Status Filter */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FinishedGoodStatus | '')} sx={{ fontSize: '0.75rem' }}>
                <MenuItem value=""><em>All Statuses</em></MenuItem>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>

            {/* View Toggle */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-slate-500 font-semibold">View:</span>
              <button
                onClick={() => { setViewMode('group'); setSelectedAlloy(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${viewMode === 'group' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <BarChart3 size={12} /> Group by Alloy
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${viewMode === 'table' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <TableIcon size={12} /> Table View
              </button>
              <button
                onClick={() => setViewMode('approval')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${viewMode === 'approval' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Approval Queue
                {unapprovedHeats.length > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {unapprovedHeats.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── APPROVAL QUEUE VIEW ── */}
      {viewMode === 'approval' && (
        <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <Typography className="font-extrabold text-sm text-slate-800">Pending Approvals Queue</Typography>
              <Typography className="text-[11px] text-slate-500 font-medium">Heats must have complete Production and Cost Ledger entries before approval.</Typography>
            </div>
            <Chip
              label={`${unapprovedHeats.length} pending heats`}
              size="small"
              sx={{ bgcolor: '#fff8e1', color: '#b78103', fontWeight: 700, border: '1px solid #ffe082', fontSize: '0.7rem' }}
            />
          </div>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="min-w-full text-left border-collapse">
              <thead className={`${stickyHead} sticky top-0 z-20 shadow-sm`}>
                <tr>
                  <th className="px-3 py-2 border-b border-slate-200 w-12 text-center bg-slate-100">#</th>
                  <th className="px-3 py-2 border-b border-slate-200 w-32 bg-slate-100">Heat No</th>
                  <th className="px-3 py-2 border-b border-slate-200 w-32">Date</th>
                  <th className="px-3 py-2 border-b border-slate-200 w-24">Alloy</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-right w-28">Gross (kg)</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-right w-28">Output (kg)</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-right w-24">Efficiency</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-center w-40">Production Ledger Proper</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-center w-40">Cost Ledger Proper</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-center w-44">QC Report Proper</th>
                  <th className="px-3 py-2 border-b border-slate-200 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 11 }).map((__, j) => (
                        <td key={j} className="px-3 py-2.5"><Skeleton height={14} /></td>
                      ))}
                    </tr>
                  ))
                ) : unapprovedHeats.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-12 text-center text-slate-400 font-medium bg-slate-50/50">
                      No heats pending approval. All active heats are approved to Finished Goods!
                    </td>
                  </tr>
                ) : (
                  unapprovedHeats.map((row, idx) => {
                    const isEven = idx % 2 === 0;
                    const canApprove = row.isProductionProper && row.isCostProper && row.isQcProper;

                    // Build QC tooltip text
                    const qcTooltip = row.qcEntry
                      ? !row.qcEntry.supervisorSubmitted
                        ? 'QC report not yet submitted by supervisor'
                        : !row.qcEntry.verified
                        ? 'QC report not yet verified by admin'
                        : row.qcEntry.overallStatus !== 'PASS'
                        ? `QC failed — overall status: ${row.qcEntry.overallStatus}`
                        : ''
                      : 'No QC report found for this heat';

                    return (
                      <tr key={row.prod.id} className={`hover:bg-blue-50/10 transition-colors ${isEven ? 'bg-white' : 'bg-slate-50/20'}`}>
                        <td className="px-3 py-2.5 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-blue-700">
                          <Tooltip
                            title={<HeatHoverDetails heatNo={row.prod.heatNo} productionEntries={productionEntries} costEntries={costEntries} />}
                            placement="right"
                            slotProps={{
                              tooltip: {
                                sx: {
                                  bgcolor: '#ffffff',
                                  color: '#0f172a',
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 2,
                                  p: 0,
                                  maxWidth: 400,
                                }
                              }
                            }}
                          >
                            <span className="cursor-pointer hover:underline">{row.prod.heatNo}</span>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-2.5">{fmtDate(row.prod.date)}</td>
                        <td className="px-3 py-2.5">
                          <Chip
                            label={row.prod.alloyType}
                            size="small"
                            sx={{ background: '#e3f2fd', color: '#1565C0', fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{fmtKg(row.prod.totalInput)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{fmtKg(row.prod.goodIngots)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-blue-700">
                          {row.prod.efficiencyPercentage !== undefined ? `${row.prod.efficiencyPercentage.toFixed(2)}%` : '—'}
                        </td>

                        {/* Production Ledger Proper */}
                        <td className="px-3 py-2.5 text-center">
                          <Chip
                            label="Yes"
                            size="small"
                            color="success"
                            sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                          />
                        </td>

                        {/* Cost Ledger Proper */}
                        <td className="px-3 py-2.5 text-center">
                          {row.isCostProper ? (
                            <Chip
                              label="Yes"
                              size="small"
                              color="success"
                              sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                            />
                          ) : (
                            <Chip
                              label="No"
                              size="small"
                              color="error"
                              sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                            />
                          )}
                        </td>

                        {/* QC Report Proper */}
                        <td className="px-3 py-2.5 text-center">
                          {row.isQcProper && row.qcEntry ? (
                            <Tooltip
                              title={<QCHoverDetails qcEntry={row.qcEntry} />}
                              placement="left"
                              slotProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: '#ffffff',
                                    color: '#0f172a',
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 2,
                                    p: 0,
                                    maxWidth: 400,
                                  }
                                }
                              }}
                            >
                              <Chip
                                label="Yes"
                                size="small"
                                color="success"
                                sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20, cursor: 'pointer' }}
                              />
                            </Tooltip>
                          ) : row.qcEntry ? (
                            // Has a QC entry but not fully proper — still show details on hover
                            <Tooltip
                              title={<QCHoverDetails qcEntry={row.qcEntry} />}
                              placement="left"
                              slotProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: '#ffffff',
                                    color: '#0f172a',
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 2,
                                    p: 0,
                                    maxWidth: 400,
                                  }
                                }
                              }}
                            >
                              <Chip
                                label={row.qcEntry.overallStatus === 'FAIL' ? 'FAIL' : 'Pending'}
                                size="small"
                                color="error"
                                sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20, cursor: 'help' }}
                              />
                            </Tooltip>
                          ) : (
                            // No QC entry at all — plain tooltip with text
                            <Tooltip title={qcTooltip} placement="top" arrow>
                              <Chip
                                label="Missing"
                                size="small"
                                color="error"
                                sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20, cursor: 'help' }}
                              />
                            </Tooltip>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-center">
                          <Tooltip
                            title={
                              !canApprove
                                ? !row.isCostProper
                                  ? 'Cost Ledger entry is missing or incomplete'
                                  : !row.isQcProper
                                  ? qcTooltip
                                  : ''
                                : ''
                            }
                            placement="top"
                            arrow
                          >
                            <span>
                              <Button
                                size="small"
                                variant="contained"
                                disabled={!canApprove || approvingHeatNo === row.prod.heatNo}
                                onClick={() => handleApprove(row.prod, row.costEntry)}
                                sx={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  textTransform: 'none',
                                  borderRadius: 1.5,
                                  px: 2,
                                }}
                              >
                                {approvingHeatNo === row.prod.heatNo ? 'Approving…' : 'Approve Heat'}
                              </Button>
                            </span>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GROUP VIEW ── */}
      {viewMode === 'group' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} sx={{ borderRadius: 3, border: '1px solid #f1f5f9' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Skeleton width={120} height={32} sx={{ mb: 2 }} />
                    <Skeleton width="100%" height={20} sx={{ mb: 1 }} />
                    <Skeleton width="80%" height={20} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <Card sx={{ borderRadius: 3, border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ py: 8, textAlign: 'center' }}>
                <Package size={40} className="mx-auto text-slate-300 mb-3" />
                <Typography color="text.secondary" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  No finished goods found.
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                  Go to "Approval Queue" to approve heats into Finished Goods.
                </Typography>
              </CardContent>
            </Card>
          ) : selectedAlloy && selectedGroup ? (
            /* Drilldown view */
            <AlloyDetailView
              group={selectedGroup}
              isAdmin={isAdmin}
              onEdit={(entry) => setEditTarget(entry)}
              onBack={() => setSelectedAlloy(null)}
              productionEntries={productionEntries}
              costEntries={costEntries}
            />
          ) : (
            /* Overview cards grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <AlloyOverviewCard
                  key={group.alloyType}
                  group={group}
                  onClick={() => setSelectedAlloy(group.alloyType)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FLAT TABLE VIEW ── */}
      {viewMode === 'table' && (
        <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="min-w-full text-left border-collapse">
              <thead className={`${stickyHead} sticky top-0 z-20 shadow-sm`}>
                <tr>
                  <th className="px-3 py-2 border-b border-slate-200 w-12 min-w-[48px] max-w-[48px] text-center sticky left-0 z-30 bg-slate-100">#</th>
                  <SortTh label="Heat No" colKey="heatNo" className="sticky left-12 z-30 bg-slate-100 w-32 min-w-[128px] max-w-[128px]" />
                  <SortTh label="Date" colKey="productionDate" className="w-36 min-w-[144px] max-w-[144px]" />
                  <SortTh label="Gross (kg)" colKey="grossWeightKg" className="text-right w-28 min-w-[112px] max-w-[112px]" />
                  <SortTh label="Output (kg)" colKey="goodOutputKg" className="text-right w-28 min-w-[112px] max-w-[112px]" />
                  <SortTh label="Efficiency" colKey="efficiencyPercentage" className="text-right w-28 min-w-[112px] max-w-[112px]" />
                  <SortTh label="Pieces Produced" colKey="numberOfPieces" className="text-right w-28 min-w-[112px] max-w-[112px]" />
                  <SortTh label="Total Prod. Cost" colKey="productionCostPerKg" className="text-right w-32 min-w-[128px] max-w-[128px]" />
                  <SortTh label="Selling Price/kg" colKey="estimatedSellingPrice" className="text-right w-32 min-w-[128px] max-w-[128px]" />
                  <SortTh label="Dispatched Pcs" colKey="dispatchedPieces" className="text-right w-28 min-w-[112px] max-w-[112px]" />
                  <SortTh label="Remaining Pcs" colKey="remainingPieces" className="text-right w-28 min-w-[112px] max-w-[112px]" />
                  <SortTh label="Dispatched Wt" colKey="dispatchedWeightKg" className="text-right w-28 min-w-[112px] max-w-[112px]" />
                  <SortTh label="Remaining Wt" colKey="remainingWeightKg" className="text-right w-28 min-w-[112px] max-w-[112px]" />
                  <th className="px-3 py-2 border-b border-slate-200 w-36 min-w-[144px] max-w-[144px]">Status</th>
                  {isAdmin && <th className="px-3 py-2 border-b border-slate-200 text-center w-20 min-w-[80px] max-w-[80px] sticky right-0 z-30 bg-slate-100">Actions</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: isAdmin ? 15 : 14 }).map((__, j) => (
                        <td key={j} className="px-3 py-2.5"><Skeleton height={14} /></td>
                      ))}
                    </tr>
                  ))
                  : paginated.length === 0
                    ? (
                      <tr>
                        <td colSpan={isAdmin ? 15 : 14} className="px-4 py-12 text-center text-slate-400 font-medium">
                          No records match the filters. Try approving heats from the Approval Queue.
                        </td>
                      </tr>
                    )
                    : paginated.map((row, idx) => {
                      const isEven = idx % 2 === 0;
                      const isFullyDispatched = row.status === 'Fully Dispatched';
                      const rowBg = isEven ? 'bg-white' : 'bg-slate-50';
                      const totalProdCostRow = (row.productionCostPerKg ?? 0) * (row.goodOutputKg ?? 0);
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-blue-50/20 transition-colors group ${rowBg}`}
                          style={{ opacity: isFullyDispatched ? 0.42 : 1 }}
                        >
                          <td className={`${bodyCell} w-12 min-w-[48px] max-w-[48px] text-center text-slate-400 font-mono font-bold sticky left-0 ${rowBg} group-hover:bg-blue-50`}>
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className={`${bodyCell} font-bold sticky left-12 w-32 min-w-[128px] max-w-[128px] ${rowBg} group-hover:bg-blue-50 text-blue-700`}>
                            <Tooltip
                              title={<HeatHoverDetails heatNo={row.heatNo} productionEntries={productionEntries} costEntries={costEntries} />}
                              placement="right"
                              slotProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: '#ffffff',
                                    color: '#0f172a',
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 2,
                                    p: 0,
                                    maxWidth: 400,
                                  }
                                }
                              }}
                            >
                              <span className="cursor-pointer hover:underline">{row.heatNo}</span>
                            </Tooltip>
                          </td>
                          <td className={`${bodyCell} w-36 min-w-[144px] max-w-[144px]`}>{fmtDate(row.productionDate)}</td>
                          <td className={`${bodyCell} text-right font-mono w-28 min-w-[112px] max-w-[112px]`}>{fmtKg(row.grossWeightKg)}</td>
                          <td className={`${bodyCell} text-right font-mono font-semibold w-28 min-w-[112px] max-w-[112px]`}>{fmtKg(row.goodOutputKg)}</td>
                          <td className={`${bodyCell} text-right font-mono font-semibold text-blue-700 w-28 min-w-[112px] max-w-[112px]`}>
                            {row.efficiencyPercentage !== undefined ? `${row.efficiencyPercentage.toFixed(2)}%` : '—'}
                          </td>
                          <td className={`${bodyCell} text-right font-mono w-28 min-w-[112px] max-w-[112px]`}>{row.numberOfPieces || 0}</td>
                          <td className={`${bodyCell} text-right font-mono text-slate-700 font-semibold w-32 min-w-[128px] max-w-[128px]`}>
                            {totalProdCostRow > 0 ? '₹' + totalProdCostRow.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
                          </td>
                          <td className={`${bodyCell} text-right font-mono text-blue-800 font-bold w-32 min-w-[128px] max-w-[128px]`}>{fmtMoney(row.estimatedSellingPrice)}</td>
                          <td className={`${bodyCell} text-right font-mono text-blue-700 w-28 min-w-[112px] max-w-[112px]`}>{(row.dispatchedPieces || 0).toLocaleString()}</td>
                          <td className={`${bodyCell} text-right font-mono font-bold w-28 min-w-[112px] max-w-[112px]`}>{(row.remainingPieces || 0).toLocaleString()}</td>
                          <td className={`${bodyCell} text-right font-mono text-blue-700 w-28 min-w-[112px] max-w-[112px]`}>{fmtKg(row.dispatchedWeightKg)}</td>
                          <td className={`${bodyCell} text-right font-mono font-bold w-28 min-w-[112px] max-w-[112px]`}>{fmtKg(row.remainingWeightKg)}</td>
                          <td className={`${bodyCell} w-36 min-w-[144px] max-w-[144px]`}><StatusBadge status={row.status} /></td>
                          {isAdmin && (
                            <td className={`${bodyCell} text-center sticky right-0 w-20 min-w-[80px] max-w-[80px] ${rowBg} group-hover:bg-blue-50`}>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => setEditTarget(row)} sx={{ color: THEME_BLUE, p: 0.5, '&:hover': { background: '#eff6ff' } }}>
                                  <Edit size={13} />
                                </IconButton>
                              </Tooltip>
                            </td>
                          )}
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && sorted.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded px-2 py-1"
                  >
                    {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span>records</span>
                </div>
                <span>|</span>
                <span>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, sorted.length)}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-2.5 py-1.5 border rounded transition-colors ${p === currentPage ? 'bg-blue-700 border-blue-700 text-white font-bold' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Dialog ── */}
      <EditDialog
        open={!!editTarget}
        entry={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
      />
    </Box>
  );
};

export default FinishedGoodsPage;
