import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Button, IconButton,
  Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Chip, Divider, Autocomplete, useTheme, useMediaQuery,
} from '@mui/material';
import {
  Truck, Plus, Edit2, Trash2, RefreshCw, Search,
  ChevronLeft, ChevronRight, ArrowUpDown, Package,
  User, Car, FileText, X, AlertTriangle, Weight,
  Hash, Building2, Maximize2, Minimize2,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

import {
  fetchDispatches,
  addDispatch,
  updateDispatch,
  deleteDispatch,
} from '../services/dispatch.service';
import type { DispatchEntry, DispatchFormData } from '../types/dispatch.types';

import { fetchFinishedGoods } from '../../finishedGoods/services/finishedGoods.service';
import type { FinishedGoodEntry } from '../../finishedGoods/types/finishedGoods.types';

import { fetchVendors } from '../../vendorMaster/services/vendorMaster.service';
import type { VendorMaster } from '../../vendorMaster/types/vendorMaster.types';

import { fetchProductionLedger } from '../../productionLedger/services/productionLedger.service';
import type { ProductionLedgerEntry } from '../../productionLedger/types/productionLedger.types';

import { fetchCostLedger } from '../../costLedger/services/costLedger.service';
import type { CostLedgerEntry } from '../../costLedger/types/costLedger.types';

import { useAuth } from '../../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const THEME = '#1565C0';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtDate = (ts: Timestamp | string | undefined | null): string => {
  if (!ts) return '—';
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as string);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtKg = (v: number | undefined | null) =>
  v == null ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' kg';
const fmtNum = (v: number | undefined | null, decimals = 1) => {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};


// ─── Customer Hover Popup ─────────────────────────────────────────────────────
const CustomerHoverPopup = ({ vendor }: { vendor: VendorMaster | undefined }) => {
  if (!vendor) return <Box sx={{ p: 1 }}><Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Customer details not found</Typography></Box>;
  const addr = vendor.companyAddress;
  const fullAddr = [addr?.addressLine1, addr?.city, addr?.state, addr?.pinCode].filter(Boolean).join(', ');
  return (
    <Box sx={{ p: 1.5, minWidth: 260, maxWidth: 340 }}>
      <Box sx={{ borderBottom: '1px solid #e2e8f0', pb: 1, mb: 1 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{vendor.vendorName}</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          <Chip label={vendor.vendorCode} size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#eff6ff', color: THEME, fontWeight: 700 }} />
          <Chip label={vendor.vendorCategory} size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 700 }} />
          <Chip label={vendor.status} size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: vendor.status === 'Active' ? '#f0fdf4' : '#fef2f2', color: vendor.status === 'Active' ? '#15803d' : '#dc2626', fontWeight: 700 }} />
        </Box>
      </Box>
      {[
        fullAddr && ['Address', fullAddr],
        vendor.contactPersonName && ['Contact', vendor.contactPersonName],
        vendor.contactNumber && ['Phone', vendor.contactNumber],
        vendor.email && ['Email', vendor.email],
        vendor.gstNumber && ['GST', vendor.gstNumber],
        vendor.panNumber && ['PAN', vendor.panNumber],
        vendor.vendorType && ['Type', vendor.vendorType],
      ].filter(Boolean).map(([label, val]: any) => (
        <Box key={label} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', minWidth: 60 }}>{label}:</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#1e293b', wordBreak: 'break-word' }}>{val}</Typography>
        </Box>
      ))}
    </Box>
  );
};

// ─── Heat Hover Popup ─────────────────────────────────────────────────────────
const HeatHoverPopup = ({
  heatNo,
  productionEntries,
  costEntries,
}: {
  heatNo: string;
  productionEntries: ProductionLedgerEntry[];
  costEntries: CostLedgerEntry[];
}) => {
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

  const dateStr = prod.date
    ? (prod.date instanceof Timestamp ? prod.date.toDate() : new Date(prod.date as string)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const materials = cost?.materials || prod.materials || [];

  const totalProductionCost = cost
    ? (cost.totalProductionCost ?? (cost.totalProductionCostPerKg ?? cost.productionCostPerKg ?? 0) * (cost.goodIngotsKg ?? 0))
    : 0;

  return (
    <Box sx={{ p: 1.5, minWidth: 280, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Header */}
      <Box sx={{ borderBottom: '1px solid #e2e8f0', pb: 1 }}>
        <Typography sx={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>
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
                if (qty === 0) return null;
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


// ─── Dispatch Dialog ──────────────────────────────────────────────────────────
interface DispatchDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (form: DispatchFormData) => Promise<void>;
  initial?: DispatchEntry | null;
  finishedGoods: FinishedGoodEntry[];
  customers: VendorMaster[];
  saving: boolean;
}

const DispatchDialog = ({ open, onClose, onSave, initial, finishedGoods, customers, saving }: DispatchDialogProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const emptyForm = (): DispatchFormData => ({
    dispatchDate: new Date().toISOString().slice(0, 10),
    customerId: '',
    customerName: '',
    alloyType: '',
    dispatchItems: [],
    vehicleNumber: '',
    driverName: '',
    remarks: '',
  });

  const [form, setForm] = useState<DispatchFormData>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Available heats for dispatch (manuallyApproved, remaining > 0)
  const availableHeats = useMemo(() =>
    finishedGoods.filter((fg) => fg.manuallyApproved === true && (fg.remainingWeightKg ?? 0) > 0),
    [finishedGoods]
  );



  // Heats for the selected alloy (and not already added)
  const heatsForAlloy = useMemo(() => {
    const addedIds = new Set(form.dispatchItems.map((i) => i.finishedGoodsId));
    return availableHeats.filter(
      (fg) => (!form.alloyType || fg.alloyType === form.alloyType) && !addedIds.has(fg.id)
    );
  }, [availableHeats, form.alloyType, form.dispatchItems]);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          dispatchDate: initial.dispatchDate instanceof Timestamp
            ? initial.dispatchDate.toDate().toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          customerId: initial.customerId,
          customerName: initial.customerName,
          alloyType: initial.alloyType,
          dispatchItems: initial.dispatchItems.map((i) => ({
            ...i,
            dispatchWeightKg: i.dispatchWeightKg,
            dispatchPieces: i.dispatchPieces,
          })),
          vehicleNumber: initial.vehicleNumber,
          driverName: initial.driverName,
          remarks: initial.remarks,
        });
      } else {
        setForm(emptyForm());
      }
      setErrors({});
    }
  }, [open, initial]);

  const addHeat = (fg: FinishedGoodEntry) => {
    setForm((prev) => ({
      ...prev,
      alloyType: prev.alloyType || fg.alloyType,
      dispatchItems: [
        ...prev.dispatchItems,
        {
          finishedGoodsId: fg.id,
          heatNo: fg.heatNo,
          availableWeightKg: fg.remainingWeightKg ?? 0,
          availablePieces: fg.remainingPieces ?? 0,
          dispatchWeightKg: '',
          dispatchPieces: '',
        },
      ],
    }));
  };

  const removeHeat = (idx: number) => {
    setForm((prev) => {
      const newItems = prev.dispatchItems.filter((_, i) => i !== idx);
      return {
        ...prev,
        dispatchItems: newItems,
        alloyType: newItems.length === 0 ? '' : prev.alloyType,
      };
    });
  };

  const updateItem = (idx: number, field: 'dispatchWeightKg' | 'dispatchPieces', val: string) => {
    setForm((prev) => {
      const items = [...prev.dispatchItems];
      items[idx] = { ...items[idx], [field]: val === '' ? '' : Number(val) };
      return { ...prev, dispatchItems: items };
    });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.dispatchDate) e.dispatchDate = 'Required';
    if (!form.customerId) e.customerId = 'Select a customer';
    if (form.dispatchItems.length === 0) e.items = 'Add at least one heat';
    form.dispatchItems.forEach((item, idx) => {
      const wt = Number(item.dispatchWeightKg);
      const pcs = Number(item.dispatchPieces);
      if (!wt || wt <= 0) e[`wt_${idx}`] = 'Required';
      if (wt > item.availableWeightKg) e[`wt_${idx}`] = `Max ${item.availableWeightKg} kg`;
      if (!pcs || pcs <= 0) e[`pcs_${idx}`] = 'Required';
      if (pcs > item.availablePieces) e[`pcs_${idx}`] = `Max ${item.availablePieces} pcs`;
    });
    if (!form.vehicleNumber.trim()) e.vehicleNumber = 'Required';
    if (!form.driverName.trim()) e.driverName = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await onSave(form);
  };



  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      fullScreen={isMobile}
      slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3, maxHeight: isMobile ? '100vh' : '90vh' } } }}
    >
      <DialogTitle sx={{ pb: 1, borderBottom: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Truck size={20} color={THEME} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e293b' }}>
              {initial ? 'Edit Dispatch' : 'New Dispatch'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small"><X size={18} /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Row 1: Date + Customer */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
          <TextField
            label="Dispatch Date"
            type="date"
            size="small"
            value={form.dispatchDate}
            onChange={(e) => setForm((p) => ({ ...p, dispatchDate: e.target.value }))}
            error={!!errors.dispatchDate}
            helperText={errors.dispatchDate}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControl size="small" error={!!errors.customerId}>
            <InputLabel>Customer</InputLabel>
            <Select
              label="Customer"
              value={form.customerId}
              onChange={(e) => {
                const vendor = customers.find((c) => c.id === e.target.value);
                setForm((p) => ({ ...p, customerId: e.target.value as string, customerName: vendor?.vendorName ?? '' }));
              }}
            >
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  <Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.vendorName}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>{c.vendorCode} · {c.companyAddress?.city}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.customerId && <Typography sx={{ fontSize: '0.7rem', color: '#d32f2f', mt: 0.25, ml: 1.5 }}>{errors.customerId}</Typography>}
          </FormControl>
        </Box>

        {/* Row 2: Vehicle + Driver */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            label="Vehicle Number"
            size="small"
            value={form.vehicleNumber}
            onChange={(e) => setForm((p) => ({ ...p, vehicleNumber: e.target.value.toUpperCase() }))}
            error={!!errors.vehicleNumber}
            helperText={errors.vehicleNumber}
            placeholder="e.g. TN-2026-CM"
          />
          <TextField
            label="Driver Name"
            size="small"
            value={form.driverName}
            onChange={(e) => setForm((p) => ({ ...p, driverName: e.target.value }))}
            error={!!errors.driverName}
            helperText={errors.driverName}
          />
        </Box>

        {/* Remarks */}
        <TextField
          label="Remarks (optional)"
          size="small"
          multiline
          rows={2}
          value={form.remarks}
          onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
        />

        <Divider />

        {/* Dispatch Items */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
              Dispatch Items
            </Typography>
            {form.alloyType && (
              <Chip label={`Alloy: ${form.alloyType}`} size="small" sx={{ bgcolor: '#eff6ff', color: THEME, fontWeight: 700 }} />
            )}
          </Box>

          {errors.items && (
            <Typography sx={{ fontSize: '0.75rem', color: '#d32f2f', mb: 1 }}>{errors.items}</Typography>
          )}

          {/* Add heat selector */}
          <Box sx={{ mb: 2 }}>
            <Autocomplete
              size="small"
              options={heatsForAlloy}
              getOptionLabel={(fg) => `${fg.heatNo} — ${fg.alloyType} (${fg.remainingWeightKg?.toFixed(1)} kg, ${fg.remainingPieces} pcs)`}
              onChange={(_, fg) => { if (fg) addHeat(fg); }}
              value={null}
              renderInput={(params) => (
                <TextField {...params} label="Add Heat Number from Finished Goods" placeholder="Search heat..." />
              )}
              noOptionsText={
                availableHeats.length === 0
                  ? 'No approved finished goods available'
                  : form.alloyType
                  ? `No more heats for ${form.alloyType}`
                  : 'No heats available'
              }
            />
          </Box>

          {/* Item rows */}
          {form.dispatchItems.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
              <Package size={24} color="#94a3b8" />
              <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', mt: 0.5 }}>No heat numbers added yet</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Header */}
              <Box sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 1, px: 1.5 }}>
                {['Heat No.', 'Dispatch Wt (kg)', 'Max Avail (kg)', 'Dispatch Pcs', ''].map((h) => (
                  <Typography key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</Typography>
                ))}
              </Box>
              {form.dispatchItems.map((item, idx) => (
                <Box
                  key={idx}
                  sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr auto' }, 
                    gap: 1.5, 
                    alignItems: 'center', 
                    bgcolor: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: 1.5, 
                    px: 1.5, 
                    py: 1 
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: THEME }}>{item.heatNo}</Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>Avail: {item.availablePieces} pcs</Typography>
                    </Box>
                    <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                      <IconButton size="small" onClick={() => removeHeat(idx)} sx={{ color: '#ef4444' }}>
                        <X size={16} />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>Dispatch Wt (kg)</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={item.dispatchWeightKg}
                      onChange={(e) => updateItem(idx, 'dispatchWeightKg', e.target.value)}
                      error={!!errors[`wt_${idx}`]}
                      helperText={errors[`wt_${idx}`] || (isMobile ? `Max: ${item.availableWeightKg} kg` : '')}
                      slotProps={{ htmlInput: { min: 0, max: item.availableWeightKg, step: 0.1 } }}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem' } }}
                    />
                  </Box>

                  <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: '0.75rem', color: '#64748b', pl: 0.5 }}>
                    ≤ {item.availableWeightKg} kg
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>Dispatch Pieces</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={item.dispatchPieces}
                      onChange={(e) => updateItem(idx, 'dispatchPieces', e.target.value)}
                      error={!!errors[`pcs_${idx}`]}
                      helperText={errors[`pcs_${idx}`] || (isMobile ? `Max: ${item.availablePieces} pcs` : '')}
                      slotProps={{ htmlInput: { min: 0, max: item.availablePieces, step: 1 } }}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.82rem' } }}
                    />
                  </Box>

                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                    <IconButton size="small" onClick={() => removeHeat(idx)} sx={{ color: '#ef4444' }}>
                      <X size={14} />
                    </IconButton>
                  </Box>
                </Box>
              ))}

              {/* Totals row */}
              {form.dispatchItems.length > 0 && (
                <Box sx={{ display: 'flex', gap: 3, justifyContent: 'flex-end', px: 1, pt: 0.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                    Total: {form.dispatchItems.reduce((s, i) => s + (Number(i.dispatchWeightKg) || 0), 0).toFixed(2)} kg
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                    {form.dispatchItems.reduce((s, i) => s + (Number(i.dispatchPieces) || 0), 0)} pcs
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #f1f5f9', gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Truck size={15} />}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: THEME }}
        >
          {saving ? 'Saving…' : initial ? 'Update Dispatch' : 'Create Dispatch'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────
const DeleteConfirmDialog = ({
  open,
  dispatchNumber,
  onClose,
  onConfirm,
  deleting,
}: {
  open: boolean;
  dispatchNumber: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  deleting: boolean;
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth 
      fullScreen={isMobile}
      slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3 } } }}
    >
    <DialogTitle sx={{ pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AlertTriangle size={20} color="#dc2626" />
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>Delete Dispatch</Typography>
      </Box>
    </DialogTitle>
    <DialogContent>
      <Typography sx={{ color: '#475569', fontSize: '0.875rem' }}>
        Are you sure you want to delete <strong>{dispatchNumber}</strong>? This will restore the dispatched weight/pieces back to the finished goods inventory.
      </Typography>
    </DialogContent>
    <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={deleting}
          startIcon={deleting ? <CircularProgress size={13} color="inherit" /> : <Trash2 size={13} />}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) => (
  <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, flex: { xs: '1 1 100%', sm: '1 1 200px' }, minWidth: 0 }}>
    <CardContent sx={{ p: '16px !important' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>{label}</Typography>
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{value}</Typography>
          {sub && <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.25 }}>{sub}</Typography>}
        </Box>
        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: color + '18' }}>{icon}</Box>
      </Box>
    </CardContent>
  </Card>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DispatchPage({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [tableMaximized, setTableMaximized] = useState(false);

  // Data
  const [dispatches, setDispatches] = useState<DispatchEntry[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGoodEntry[]>([]);
  const [customers, setCustomers] = useState<VendorMaster[]>([]);
  const [productionEntries, setProductionEntries] = useState<ProductionLedgerEntry[]>([]);
  const [costEntries, setCostEntries] = useState<CostLedgerEntry[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DispatchEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DispatchEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [alloyFilter, setAlloyFilter] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState('dispatchDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [hoveredDispatchId, setHoveredDispatchId] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dispData, fgData, vendorData, prodData, costData] = await Promise.all([
        fetchDispatches(),
        fetchFinishedGoods(),
        fetchVendors(),
        fetchProductionLedger(),
        fetchCostLedger(),
      ]);
      setDispatches(dispData);
      setFinishedGoods(fgData);
      // Customers = vendors with category Customer or Both
      setCustomers(vendorData.filter((v) => v.vendorCategory === 'Customer' || v.vendorCategory === 'Both'));
      setProductionEntries(prodData);
      setCostEntries(costData);
    } catch (err) {
      console.error('Failed to load dispatch data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  // ── Analytics ─────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const totalWeight = dispatches.reduce((s, d) => s + (d.totalDispatchWeightKg ?? 0), 0);
    const totalPieces = dispatches.reduce((s, d) => s + (d.totalDispatchPieces ?? 0), 0);
    const customerCounts: Record<string, number> = {};
    dispatches.forEach((d) => { customerCounts[d.customerName] = (customerCounts[d.customerName] || 0) + 1; });
    const topCustomer = Object.entries(customerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    return { totalWeight, totalPieces, topCustomer };
  }, [dispatches]);

  // ── Filter / Sort / Paginate ──────────────────────────────────────────────
  const uniqueCustomers = useMemo(() => [...new Set(dispatches.map((d) => d.customerName).filter(Boolean))].sort(), [dispatches]);
  const uniqueAlloys = useMemo(() => [...new Set(dispatches.map((d) => d.alloyType).filter(Boolean))].sort(), [dispatches]);

  const filtered = useMemo(() => {
    let rows = [...dispatches];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((d) =>
        d.dispatchNumber?.toLowerCase().includes(q) ||
        d.customerName?.toLowerCase().includes(q) ||
        d.vehicleNumber?.toLowerCase().includes(q) ||
        d.driverName?.toLowerCase().includes(q) ||
        d.dispatchItems?.some((i) => i.heatNo?.toLowerCase().includes(q))
      );
    }
    if (customerFilter) rows = rows.filter((d) => d.customerName === customerFilter);
    if (alloyFilter) rows = rows.filter((d) => d.alloyType === alloyFilter);

    rows.sort((a, b) => {
      let av: any = a[sortKey as keyof DispatchEntry];
      let bv: any = b[sortKey as keyof DispatchEntry];
      if (av instanceof Timestamp) av = av.toMillis();
      if (bv instanceof Timestamp) bv = bv.toMillis();
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
    return rows;
  }, [dispatches, search, customerFilter, alloyFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = async (form: DispatchFormData) => {
    setSaving(true);
    try {
      if (editTarget) {
        await updateDispatch(editTarget.id, form, user?.displayName ?? user?.email ?? 'Admin');
        setToast({ msg: 'Dispatch updated successfully', type: 'success' });
      } else {
        await addDispatch(form, dispatches, user?.displayName ?? user?.email ?? 'Admin');
        setToast({ msg: 'Dispatch created successfully', type: 'success' });
      }
      setDialogOpen(false);
      setEditTarget(null);
      await load();
    } catch (err) {
      console.error(err);
      setToast({ msg: 'Failed to save dispatch: ' + (err as any).message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDispatch(deleteTarget.id);
      setToast({ msg: `${deleteTarget.dispatchNumber} deleted`, type: 'success' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setToast({ msg: 'Failed to delete dispatch', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (d: DispatchEntry) => { setEditTarget(d); setDialogOpen(true); };



  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f8fafc', minHeight: '100vh' }}>
      <style>{`
        .dispatch-grid-table th,
        .dispatch-grid-table td {
          border-bottom: 1px solid ${isDark ? '#4a5568' : '#cbd5e1'} !important;
          border-right: 1px solid ${isDark ? '#4a5568' : '#cbd5e1'} !important;
        }
        .dispatch-grid-table th:last-child,
        .dispatch-grid-table td:last-child {
          border-right: none !important;
        }
      `}</style>
      {/* Toast */}
      {toast && (
        <Box sx={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999,
          bgcolor: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: toast.type === 'success' ? '#15803d' : '#dc2626',
          borderRadius: 2, px: 2.5, py: 1.25, fontWeight: 600, fontSize: '0.85rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </Box>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ p: 1, bgcolor: THEME, borderRadius: 1.5 }}>
              <Truck size={20} color="#fff" />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>Dispatch Management</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#64748b', ml: 5.5 }}>
            Track all outgoing finished goods delivered to customers
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, alignItems: 'center' }}>
          <Tooltip title="Refresh">
            <IconButton onClick={load} disabled={loading} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
          {!readOnly && (
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => { setEditTarget(null); setDialogOpen(true); }}
              sx={{ bgcolor: THEME, borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 2.5, flexGrow: { xs: 1, sm: 0 } }}
            >
              New Dispatch
            </Button>
          )}
        </Box>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <KpiCard icon={<Truck size={20} color={THEME} />} label="Total Dispatches" value={String(dispatches.length)} color={THEME} />
        <KpiCard icon={<Weight size={20} color="#7c3aed" />} label="Total Weight" value={analytics.totalWeight.toFixed(1) + ' kg'} color="#7c3aed" />
        <KpiCard icon={<Hash size={20} color="#0891b2" />} label="Total Pieces" value={String(analytics.totalPieces)} color="#0891b2" />
        <KpiCard icon={<Building2 size={20} color="#059669" />} label="Top Customer" value={analytics.topCustomer} color="#059669" />
      </Box>

      {/* Filters */}
      <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, mb: 2 }}>
        <CardContent sx={{ p: '12px 16px !important' }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: { xs: '1 1 100%', sm: '1 1 220px' }, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, px: 1.5, py: 0.5 }}>
              <Search size={14} color="#94a3b8" />
              <input
                placeholder="Search dispatch no., customer, vehicle, heat…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.82rem', width: '100%', color: '#1e293b' }}
              />
            </Box>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Customer</InputLabel>
              <Select
                label="Customer" value={customerFilter} onChange={(e) => { setCustomerFilter(e.target.value as string); setPage(1); }}
                sx={{ fontSize: '0.82rem' }}
              >
                <MenuItem value="">All Customers</MenuItem>
                {uniqueCustomers.map((c) => <MenuItem key={c} value={c} sx={{ fontSize: '0.82rem' }}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 130 } }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Alloy</InputLabel>
              <Select
                label="Alloy" value={alloyFilter} onChange={(e) => { setAlloyFilter(e.target.value as string); setPage(1); }}
                sx={{ fontSize: '0.82rem' }}
              >
                <MenuItem value="">All Alloys</MenuItem>
                {uniqueAlloys.map((a) => <MenuItem key={a} value={a} sx={{ fontSize: '0.82rem' }}>{a}</MenuItem>)}
              </Select>
            </FormControl>
            {(search || customerFilter || alloyFilter) && (
              <Tooltip title="Clear filters">
                <IconButton size="small" onClick={() => { setSearch(''); setCustomerFilter(''); setAlloyFilter(''); setPage(1); }}>
                  <X size={14} />
                </IconButton>
              </Tooltip>
            )}
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', ml: 'auto' }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {tableMaximized && (
        <div
          onClick={() => setTableMaximized(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1290,
          }}
        />
      )}

      {/* Table */}
      <Card 
        elevation={0} 
        sx={{ 
          border: '1px solid #e2e8f0', 
          borderRadius: 2.5,
          transition: 'all 0.2s ease',
          ...(tableMaximized && {
            position: 'fixed',
            top: '5vh',
            left: '5vw',
            width: '90vw',
            height: '90vh',
            zIndex: 1300,
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            bgcolor: 'background.paper',
          })
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderBottom: isDark ? '1px solid #2d3748' : '1px solid #e2e8f0', bgcolor: isDark ? '#1a2130' : '#f8fafc' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {tableMaximized ? 'Dispatch Records (Expanded View)' : 'Dispatch Records'}
          </Typography>
          <Tooltip title={tableMaximized ? "Close / Minimize" : "Maximize Table"}>
            <IconButton size="small" onClick={() => setTableMaximized(!tableMaximized)} sx={{ color: 'text.secondary' }}>
              {tableMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </IconButton>
          </Tooltip>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={28} sx={{ color: THEME }} />
          </Box>
        ) : paged.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Truck size={40} color="#cbd5e1" />
            <Typography sx={{ color: '#94a3b8', mt: 1.5, fontWeight: 600 }}>No dispatches found</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Plus size={14} />}
              onClick={() => setDialogOpen(true)}
              sx={{ mt: 2, borderRadius: 2, textTransform: 'none', borderColor: THEME, color: THEME }}
            >
              Create First Dispatch
            </Button>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto', maxHeight: tableMaximized ? 'calc(90vh - 120px)' : 'none' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }} className="dispatch-grid-table">
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th rowSpan={2} style={{
                    padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc'
                  }}>
                    SI No
                  </th>
                  <th rowSpan={2} onClick={() => toggleSort('dispatchNumber')} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8fafc'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Dispatch No.
                      <ArrowUpDown size={10} style={{ color: sortKey === 'dispatchNumber' ? THEME : '#94a3b8' }} />
                    </span>
                  </th>
                  <th rowSpan={2} onClick={() => toggleSort('dispatchDate')} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8fafc'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Date
                      <ArrowUpDown size={10} style={{ color: sortKey === 'dispatchDate' ? THEME : '#94a3b8' }} />
                    </span>
                  </th>
                  <th rowSpan={2} onClick={() => toggleSort('customerName')} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8fafc'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Customer
                      <ArrowUpDown size={10} style={{ color: sortKey === 'customerName' ? THEME : '#94a3b8' }} />
                    </span>
                  </th>
                  <th rowSpan={2} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc'
                  }}>
                    Alloy
                  </th>
                  <th colSpan={5} style={{
                    padding: '6px 14px', textAlign: 'center', fontWeight: 800, color: '#1e40af', backgroundColor: '#eff6ff', fontSize: '0.7rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid #bfdbfe',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    Dispatched Items
                  </th>
                  <th rowSpan={2} onClick={() => toggleSort('totalDispatchWeightKg')} style={{
                    padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8fafc'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      Total Wt.
                      <ArrowUpDown size={10} style={{ color: sortKey === 'totalDispatchWeightKg' ? THEME : '#94a3b8' }} />
                    </span>
                  </th>
                  <th rowSpan={2} onClick={() => toggleSort('totalDispatchPieces')} style={{
                    padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none', backgroundColor: '#f8fafc'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      Total Pcs.
                      <ArrowUpDown size={10} style={{ color: sortKey === 'totalDispatchPieces' ? THEME : '#94a3b8' }} />
                    </span>
                  </th>
                  <th rowSpan={2} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc'
                  }}>
                    Vehicle / Driver
                  </th>
                  <th rowSpan={2} style={{
                    padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc'
                  }}>
                    Actions
                  </th>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc', position: 'sticky', top: '34px', zIndex: 10 }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Heat No.</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Available Wt</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Dispatched Wt</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Available Pcs</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Dispatched Pcs</th>
                </tr>
              </thead>
              <tbody>
                {paged.flatMap((d, idx) => {
                  const isEven = idx % 2 === 0;
                  const vendor = customers.find((c) => c.id === d.customerId);
                  const items = d.dispatchItems ?? [];
                  const isHovered = hoveredDispatchId === d.id;

                  if (items.length === 0) {
                    return (
                      <tr
                        key={d.id}
                        style={{
                          backgroundColor: isHovered ? '#eff6ff' : (isEven ? '#fff' : '#f8fafc'),
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={() => setHoveredDispatchId(d.id)}
                        onMouseLeave={() => setHoveredDispatchId(null)}
                      >
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                          {(page - 1) * pageSize + idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: THEME, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                          {d.dispatchNumber}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', fontWeight: 600 }}>
                          {fmtDate(d.dispatchDate)}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                          <Tooltip
                            arrow
                            placement="right"
                            slotProps={{
                              tooltip: {
                                sx: {
                                  bgcolor: '#ffffff',
                                  color: '#1e293b',
                                  boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                                  p: 0,
                                  borderRadius: 1.5,
                                  border: '1px solid #e2e8f0',
                                }
                              },
                              arrow: { sx: { color: '#ffffff', '&::before': { border: '1px solid #e2e8f0' } } }
                            }}
                            title={<CustomerHoverPopup vendor={vendor} />}
                          >
                            <Box sx={{ cursor: 'default' }}>
                              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
                                {d.customerName}
                              </Typography>
                              {vendor?.companyAddress?.city && (
                                <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                  {vendor.companyAddress.city}
                                </Typography>
                              )}
                            </Box>
                          </Tooltip>
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                          <Chip label={d.alloyType || '—'} size="small" sx={{ fontSize: '0.7rem', fontWeight: 700, bgcolor: '#eff6ff', color: THEME, height: 22 }} />
                        </td>
                        {/* Split Cols (Empty) */}
                        <td style={{ padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>—</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>—</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>—</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>—</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>—</td>
                        {/* Remaining cols */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                          {fmtKg(d.totalDispatchWeightKg)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                          {d.totalDispatchPieces ?? '—'}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                            <Car size={12} color="#64748b" />
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>{d.vehicleNumber || '—'}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <User size={12} color="#94a3b8" />
                            <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>{d.driverName || '—'}</Typography>
                          </Box>
                        </td>
                        {!readOnly && (
                          <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => openEdit(d)} sx={{ color: THEME, '&:hover': { bgcolor: '#eff6ff' } }}>
                                  <Edit2 size={14} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" onClick={() => setDeleteTarget(d)} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}>
                                  <Trash2 size={14} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </td>
                        )}
                      </tr>
                    );
                  }

                  return items.map((item, mi) => {
                    const isFirst = mi === 0;
                    return (
                      <tr
                        key={`${d.id}-${mi}`}
                        style={{
                          backgroundColor: isHovered ? '#eff6ff' : (isEven ? '#fff' : '#f8fafc'),
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={() => setHoveredDispatchId(d.id)}
                        onMouseLeave={() => setHoveredDispatchId(null)}
                      >
                        {isFirst && (
                          <>
                            <td rowSpan={items.length} style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                              {(page - 1) * pageSize + idx + 1}
                            </td>
                            <td rowSpan={items.length} style={{ padding: '10px 14px', fontWeight: 700, color: THEME, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                              {d.dispatchNumber}
                            </td>
                            <td rowSpan={items.length} style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', fontWeight: 600 }}>
                              {fmtDate(d.dispatchDate)}
                            </td>
                            <td rowSpan={items.length} style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                              <Tooltip
                                arrow
                                placement="right"
                                slotProps={{
                                  tooltip: {
                                    sx: {
                                      bgcolor: '#ffffff',
                                      color: '#1e293b',
                                      boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                                      p: 0,
                                      borderRadius: 1.5,
                                      border: '1px solid #e2e8f0',
                                    }
                                  },
                                  arrow: { sx: { color: '#ffffff', '&::before': { border: '1px solid #e2e8f0' } } }
                                }}
                                title={<CustomerHoverPopup vendor={vendor} />}
                              >
                                <Box sx={{ cursor: 'default' }}>
                                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
                                    {d.customerName}
                                  </Typography>
                                  {vendor?.companyAddress?.city && (
                                    <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                      {vendor.companyAddress.city}
                                    </Typography>
                                  )}
                                </Box>
                              </Tooltip>
                            </td>
                            <td rowSpan={items.length} style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                              <Chip label={d.alloyType || '—'} size="small" sx={{ fontSize: '0.7rem', fontWeight: 700, bgcolor: '#eff6ff', color: THEME, height: 22 }} />
                            </td>
                          </>
                        )}

                        {/* Split columns for the nested items */}
                        <td style={{
                          padding: '10px 14px',
                          borderBottom: mi === items.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                          borderRight: '1px solid #e2e8f0',
                          verticalAlign: 'middle'
                        }}>
                          <Tooltip
                            arrow
                            placement="right"
                            slotProps={{
                              tooltip: {
                                sx: {
                                  bgcolor: '#ffffff',
                                  color: '#1e293b',
                                  boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                                  p: 0,
                                  borderRadius: 1.5,
                                  border: '1px solid #e2e8f0',
                                }
                              },
                              arrow: { sx: { color: '#ffffff', '&::before': { border: '1px solid #e2e8f0' } } }
                            }}
                            title={
                              <HeatHoverPopup
                                heatNo={item.heatNo}
                                productionEntries={productionEntries}
                                costEntries={costEntries}
                              />
                            }
                          >
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: THEME, cursor: 'default', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                              {item.heatNo}
                            </Typography>
                          </Tooltip>
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: '#475569',
                          fontWeight: 600,
                          borderBottom: mi === items.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                          borderRight: '1px solid #e2e8f0',
                          verticalAlign: 'middle'
                        }}>
                          {fmtNum(item.availableWeightKg)}
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: '#dc2626',
                          fontWeight: 700,
                          borderBottom: mi === items.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                          borderRight: '1px solid #e2e8f0',
                          verticalAlign: 'middle'
                        }}>
                          {fmtNum(item.dispatchWeightKg)}
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: '#475569',
                          fontWeight: 600,
                          borderBottom: mi === items.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                          borderRight: '1px solid #e2e8f0',
                          verticalAlign: 'middle'
                        }}>
                          {item.availablePieces}
                        </td>
                        <td style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: '#dc2626',
                          fontWeight: 700,
                          borderBottom: mi === items.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                          borderRight: '1px solid #e2e8f0',
                          verticalAlign: 'middle'
                        }}>
                          {item.dispatchPieces}
                        </td>

                        {isFirst && (
                          <>
                            <td rowSpan={items.length} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', fontFamily: 'monospace' }}>
                              {fmtNum(d.totalDispatchWeightKg)} kg
                            </td>
                            <td rowSpan={items.length} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', fontFamily: 'monospace' }}>
                              {d.totalDispatchPieces}
                            </td>
                            <td rowSpan={items.length} style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                <Car size={12} color="#64748b" />
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>{d.vehicleNumber || '—'}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <User size={12} color="#94a3b8" />
                                <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>{d.driverName || '—'}</Typography>
                              </Box>
                              {d.remarks && (
                                <Tooltip title={d.remarks} arrow>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, cursor: 'default' }}>
                                    <FileText size={11} color="#94a3b8" />
                                    <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {d.remarks}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              )}
                            </td>
                            {!readOnly && (
                              <td rowSpan={items.length} style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => openEdit(d)} sx={{ color: THEME, '&:hover': { bgcolor: '#eff6ff' } }}>
                                      <Edit2 size={14} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton size="small" onClick={() => setDeleteTarget(d)} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}>
                                      <Trash2 size={14} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </Box>

        )}

        {/* Pagination */}
        {!loading && filtered.length > pageSize && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 1.5, borderTop: '1px solid #f1f5f9' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Page {page} of {totalPages} · {filtered.length} records
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={16} />
              </IconButton>
              <IconButton size="small" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={16} />
              </IconButton>
            </Box>
          </Box>
        )}
      </Card>

      {/* Dispatch Dialog */}
      <DispatchDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
        finishedGoods={finishedGoods}
        customers={customers}
        saving={saving}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        dispatchNumber={deleteTarget?.dispatchNumber ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </Box>
  );
}
