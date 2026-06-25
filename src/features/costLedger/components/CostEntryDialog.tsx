import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box,
  CircularProgress, MenuItem,
  FormControlLabel, Checkbox,
} from '@mui/material';
import { X, Calculator, RefreshCw } from 'lucide-react';
import {
  buildEmptyCostForm,
  calculateTotals,
  type CostLedgerFormData,
  type CostLedgerEntry,
} from '../types/costLedger.types';
import { fetchProductionHeats } from '../services/costLedger.service';
import type { ProductionLedgerEntry } from '../../productionLedger/types/productionLedger.types';
import { useMaterials } from '../../../context/MaterialContext';
import { Timestamp } from 'firebase/firestore';
import { subscribeActiveAlloys } from '../../alloyMaster/services/alloyMaster.service';
import type { AlloyMaster } from '../../alloyMaster/types/alloyMaster.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (form: CostLedgerFormData) => Promise<void>;
  editEntry?: CostLedgerEntry | null;
}

const CostEntryDialog = ({ open, onClose, onSave, editEntry }: Props) => {
  const { getByModule, loading: materialsLoading } = useMaterials();
  const activeMaterials = useMemo(() => getByModule('costLedger'), [getByModule]);

  const [form, setForm] = useState<CostLedgerFormData>(() => buildEmptyCostForm(activeMaterials));
  const [heats, setHeats] = useState<ProductionLedgerEntry[]>([]);
  const [alloys, setAlloys] = useState<AlloyMaster[]>([]);
  const [heatsLoading, setHeatsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Subscribe to alloys on open
  useEffect(() => {
    if (open) {
      const unsub = subscribeActiveAlloys((fetched) => {
        setAlloys(fetched);
      });
      return () => unsub();
    }
  }, [open]);

  // Fetch production heats on open
  useEffect(() => {
    if (open) {
      const loadHeats = async () => {
        setHeatsLoading(true);
        try {
          const fetched = await fetchProductionHeats();
          setHeats(fetched);
        } catch (err) {
          console.error("Failed to load heats", err);
        } finally {
          setHeatsLoading(false);
        }
      };
      loadHeats();
    }
  }, [open]);

  // Load edit entry or reset form
  useEffect(() => {
    if (!open) return;

    if (editEntry) {
      const dateStr = editEntry.date instanceof Timestamp
        ? editEntry.date.toDate().toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Merge saved materials with active materials (ensures any new materials also show up)
      const mergedMaterials = activeMaterials.map((m) => {
        const saved = editEntry.materials?.find(
          (sm) => sm.materialId === m.id || sm.materialId === m.materialId || sm.materialCode === m.materialCode
        );
        const savedRate = saved ? (saved.ratePerKg ?? (saved as any).costPerKg ?? (saved as any).rate ?? 0) : 0;
        const savedAmt = saved ? (saved.amount ?? (saved as any).totalCost ?? 0) : 0;
        return {
          materialId: m.id,
          materialCode: m.materialCode,
          materialName: m.materialName,
          weightKg: saved ? (saved.weightKg ?? 0) : 0,
          ratePerKg: savedRate,
          amount: savedAmt || (saved ? saved.weightKg * savedRate : 0),
        };
      });

      setForm({
        heatNo: editEntry.heatNo,
        date: dateStr,
        alloyType: editEntry.alloyType,
        employeeName: editEntry.employeeName || '',
        role: editEntry.role || '',
        notified: editEntry.notified || false,
        goodIngotsKg: editEntry.goodIngotsKg || 0,
        laborCostPerKg: editEntry.laborCostPerKg ?? 0,
        marginPercentage: editEntry.marginPercentage ?? editEntry.sellingMarginPercentage ?? 6,
        materials: mergedMaterials,
      });
    } else {
      setForm(buildEmptyCostForm(activeMaterials));
    }
    setError('');
  }, [editEntry, open, activeMaterials]); // eslint-disable-line react-hooks/exhaustive-deps

  // Form value setters
  const set = (key: keyof Omit<CostLedgerFormData, 'materials'>, val: any) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const setNum = (key: keyof Omit<CostLedgerFormData, 'materials'>, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val === '' ? 0 : parseFloat(val) || 0 }));

  const setMaterialRate = (materialId: string, val: string) => {
    const rate = val === '' ? 0 : parseFloat(val) || 0;
    setForm((prev) => ({
      ...prev,
      materials: prev.materials.map((m) =>
        m.materialId === materialId
          ? { ...m, ratePerKg: rate, amount: m.weightKg * rate }
          : m
      ),
    }));
  };

  // Handle Heat Selection
  const handleHeatChange = (heatNo: string) => {
    const selected = heats.find(h => h.heatNo === heatNo);
    if (!selected) return;

    const dateStr = selected.date instanceof Timestamp
      ? selected.date.toDate().toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Find default selling margin from Alloy Master for this alloy code
    const matchingAlloy = alloys.find(
      a => a.alloyCode.trim().toUpperCase() === selected.alloyType.trim().toUpperCase()
    );
    const defaultMargin = matchingAlloy ? matchingAlloy.defaultSellingMarginPercentage : 6;

    setForm((prev) => {
      // Map selected production materials to our cost ledger form's materials
      const updatedMaterials = prev.materials.map((m) => {
        const prodMat = selected.materials?.find(
          (pm) => pm.materialId === m.materialId || pm.materialCode === m.materialCode
        );
        const weight = prodMat ? prodMat.weightKg : 0;
        const rate = m.ratePerKg || 0;
        return {
          ...m,
          weightKg: weight,
          ratePerKg: rate,
          amount: weight * rate,
        };
      });

      return {
        ...prev,
        heatNo: selected.heatNo,
        date: dateStr,
        alloyType: selected.alloyType,
        goodIngotsKg: selected.goodIngots || 0,
        marginPercentage: defaultMargin,
        materials: updatedMaterials,
      };
    });
  };

  const liveTotals = calculateTotals(form);

  const handleSave = async () => {
    if (!form.heatNo.trim()) { setError('Heat No is required.'); return; }
    if (!form.employeeName.trim()) { setError('Employee Name is required.'); return; }
    if (!form.role.trim()) { setError('Employee Role is required.'); return; }

    setSaving(true);
    try {
      // Map materials to use master materialId (e.g. "MAT003") for Firestore schema compliance
      const mappedMaterials = form.materials.map((m) => {
        const match = activeMaterials.find(
          (am) => am.id === m.materialId || am.materialCode === m.materialCode
        );
        return {
          materialId: match ? match.materialId : m.materialId,
          materialCode: m.materialCode,
          materialName: m.materialName,
          weightKg: m.weightKg,
          ratePerKg: m.ratePerKg,
          amount: m.amount,
        };
      });

      await onSave({
        ...form,
        materials: mappedMaterials,
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save Cost Entry.');
    } finally {
      setSaving(false);
    }
  };

  const isFormLoading = materialsLoading;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      slotProps={{ paper: { className: "rounded-xl max-h-[95vh] text-slate-800" } }}
    >
      {/* Header */}
      <DialogTitle className="flex items-center justify-between border-b border-slate-100 py-4 px-6 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 text-white rounded-lg">
            <Calculator size={18} />
          </div>
          <div>
            <Typography className="font-bold text-lg leading-tight">
              {editEntry ? 'Edit Cost Entry' : 'Add Cost Ledger Entry'}
            </Typography>
            <Typography className="text-xs text-slate-500 font-normal">
              Enter material rates and production sales details.
            </Typography>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={20} />
        </button>
      </DialogTitle>

      <DialogContent className="py-6 px-6 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        {isFormLoading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress size={32} />
            <Typography sx={{ mt: 2, fontSize: '0.9rem', color: 'text.secondary' }}>
              Loading materials master data...
            </Typography>
          </Box>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel - General and Production info */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-4">
                <Typography className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  General Information
                </Typography>

                {/* Heat Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Select Heat from Production *</label>
                  {heatsLoading ? (
                    <div className="flex items-center gap-2 py-2 text-slate-500 text-xs">
                      <RefreshCw size={14} className="animate-spin" /> Loading production heats...
                    </div>
                  ) : (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={form.heatNo}
                      onChange={(e) => handleHeatChange(e.target.value)}
                      disabled={!!editEntry}
                      className="bg-slate-50/50"
                      slotProps={{
                        select: {
                          MenuProps: { slotProps: { paper: { sx: { maxHeight: 300 } } } }
                        }
                      }}
                    >
                      <MenuItem value="" disabled>-- Select a Heat Number --</MenuItem>
                      {heats.map((h) => (
                        <MenuItem key={h.id} value={h.heatNo}>
                          {h.heatNo} ({h.alloyType} - {new Date(h.date instanceof Timestamp ? h.date.seconds * 1000 : h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </div>

                {/* Heat No Manual override display */}
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Heat No"
                    size="small"
                    value={form.heatNo}
                    disabled
                    fullWidth
                    className="bg-slate-100"
                  />
                  <TextField
                    label="Alloy Type"
                    size="small"
                    value={form.alloyType}
                    disabled
                    fullWidth
                    className="bg-slate-100"
                  />
                </div>

                <div>
                  <TextField
                    label="Date"
                    type="date"
                    size="small"
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                    fullWidth
                    slotProps={{
                      inputLabel: { shrink: true },
                      input: {
                        onClick: (e) => {
                          try {
                            (e.target as any).showPicker?.();
                          } catch (err) {}
                        }
                      }
                    }}
                  />
                </div>

                {/* Employee attribution */}
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Employee Name *"
                    size="small"
                    value={form.employeeName}
                    onChange={(e) => set('employeeName', e.target.value)}
                    fullWidth
                    placeholder="e.g. John Doe"
                  />
                  <TextField
                    label="Employee Role *"
                    size="small"
                    value={form.role}
                    onChange={(e) => set('role', e.target.value)}
                    fullWidth
                    placeholder="e.g. Supervisor"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.notified}
                        onChange={(e) => set('notified', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={<span className="text-xs font-semibold text-slate-700">Notified to Management</span>}
                  />
                </div>
              </div>

              {/* Sales Cost Section */}
              <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-4">
                <Typography className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Sales & Revenue Setup
                </Typography>

                <div>
                  <TextField
                    label="Good Ingots Produced (Kg)"
                    size="small"
                    type="number"
                    value={form.goodIngotsKg || ''}
                    disabled
                    fullWidth
                    className="bg-slate-100"
                    slotProps={{
                      input: {
                        endAdornment: <span className="text-xs text-slate-400 font-semibold">Kg</span>
                      }
                    }}
                  />
                </div>

                <div>
                  <TextField
                    label="Labor Cost per Kg (₹/Kg) *"
                    size="small"
                    type="number"
                    value={form.laborCostPerKg || ''}
                    onChange={(e) => setNum('laborCostPerKg', e.target.value)}
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: <span className="text-xs text-slate-400 mr-1 font-semibold">₹</span>,
                        endAdornment: <span className="text-xs text-slate-400 font-semibold">/Kg</span>
                      }
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Selling Margin (%) *"
                    size="small"
                    type="number"
                    value={form.marginPercentage || ''}
                    onChange={(e) => setNum('marginPercentage', e.target.value)}
                    fullWidth
                    slotProps={{
                      input: {
                        endAdornment: <span className="text-xs text-slate-400 font-semibold">%</span>
                      }
                    }}
                  />
                  <TextField
                    label="Selling Price per Kg (Auto)"
                    size="small"
                    type="number"
                    value={liveTotals.sellingPricePerKg ? liveTotals.sellingPricePerKg.toFixed(4) : ''}
                    disabled
                    fullWidth
                    className="bg-slate-100"
                    slotProps={{
                      input: {
                        startAdornment: <span className="text-xs text-slate-400 mr-1 font-semibold">₹</span>,
                        endAdornment: <span className="text-xs text-slate-400 font-semibold">/Kg</span>
                      }
                    }}
                  />
                </div>
              </div>

              {/* Real-time calculated Profit Metrics */}
              <div className="bg-slate-900 text-white p-4 rounded-lg space-y-3 shadow-md">
                <Typography className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Live Cost Sheet Summary
                </Typography>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Total Input:</span>
                    <div className="font-bold text-sm text-slate-100">{liveTotals.totalInputKg.toLocaleString()} Kg</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Yield Efficiency:</span>
                    <div className="font-bold text-sm text-slate-100">{liveTotals.efficiencyPercentage}%</div>
                  </div>
                  <div className="mt-2">
                    <span className="text-slate-400">Total Material Cost:</span>
                    <div className="font-bold text-sm text-amber-400">₹{liveTotals.totalMaterialCost.toLocaleString()}</div>
                  </div>
                  <div className="mt-2">
                    <span className="text-slate-400">Mat Cost per Kg:</span>
                    <div className="font-bold text-sm text-amber-300">₹{liveTotals.materialCostPerKg.toLocaleString()}/Kg</div>
                  </div>
                  <div className="mt-2">
                    <span className="text-slate-400">Labor Cost per Kg:</span>
                    <div className="font-bold text-sm text-blue-300">₹{liveTotals.laborCostPerKg.toLocaleString()}/Kg</div>
                  </div>
                  <div className="mt-2">
                    <span className="text-slate-400">Total Prod Cost:</span>
                    <div className="font-bold text-sm text-amber-400">₹{liveTotals.totalProductionCost.toLocaleString()}</div>
                  </div>
                  <div className="mt-2">
                    <span className="text-slate-400">Production Cost per Kg:</span>
                    <div className="font-bold text-sm text-emerald-300">₹{liveTotals.totalProductionCostPerKg.toLocaleString()}/Kg</div>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-xs mt-2">
                  <span className="text-slate-400">Selling Margin % (Selling Price):</span>
                  <span className="font-extrabold text-sm text-emerald-400">
                    {form.marginPercentage}% (₹{liveTotals.sellingPricePerKg.toFixed(4)}/Kg)
                  </span>
                </div>
              </div>
            </div>

            {/* Right Panel - Excel-like ledger grid for rates */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="border border-slate-200 rounded-lg overflow-hidden flex-1 flex flex-col bg-slate-50">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                  <Typography className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Excel-Like Materials Rates Ledger
                  </Typography>
                  <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded font-mono">
                    Quantities imported from Production
                  </span>
                </div>

                <div className="overflow-y-auto max-h-[500px] flex-1">
                  <table className="min-w-full divide-y divide-slate-200 border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-8">#</th>
                        <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Material Name</th>
                        <th scope="col" className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-28">Quantity (Kg)</th>
                        <th scope="col" className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-36">Rate (₹/Kg)</th>
                        <th scope="col" className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-36">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {form.materials.map((m, index) => {
                        const qty = m.weightKg;
                        const rate = m.ratePerKg;
                        const amount = m.amount;
                        const hasQty = qty > 0;

                        return (
                          <tr
                            key={m.materialId}
                            className={`hover:bg-blue-50/20 transition-colors ${hasQty ? 'bg-amber-50/10 font-medium' : 'opacity-60'}`}
                          >
                            <td className="px-3 py-1.5 text-slate-400 font-mono text-[10px] text-center border-r border-slate-100">
                              {index + 1}
                            </td>
                            <td className="px-4 py-1.5 text-xs text-slate-700">
                              <span className="font-semibold">{m.materialCode}</span>
                              <span className="text-[10px] text-slate-400 block -mt-0.5">{m.materialName}</span>
                            </td>
                            <td className="px-4 py-1.5 text-xs text-right font-mono text-slate-600">
                              {hasQty ? qty.toLocaleString() : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-1.5 text-xs text-right">
                              <div className="relative inline-block w-28">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">₹</span>
                                <input
                                  type="number"
                                  value={rate === 0 ? '' : rate}
                                  onChange={(e) => setMaterialRate(m.materialId, e.target.value)}
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="w-full pl-6 pr-2 py-1 text-right text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-1.5 text-xs text-right font-mono font-semibold text-slate-700">
                              {amount > 0 ? `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Footer */}
      <DialogActions className="border-t border-slate-100 py-3 px-6 gap-2 bg-slate-50/50">
        <Button onClick={onClose} variant="outlined" className="text-slate-600 border-slate-300 hover:bg-slate-100 rounded-lg px-4" disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || !form.heatNo || isFormLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-semibold"
        >
          {saving ? (
            <div className="flex items-center gap-1.5">
              <CircularProgress size={16} className="text-white" />
              <span>Saving...</span>
            </div>
          ) : (
            editEntry ? 'Update Entry' : 'Add Cost Entry'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CostEntryDialog;
