import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  Box, Typography, Button, TextField, MenuItem,
  Select, FormControl, InputLabel, CircularProgress,
  Divider, InputAdornment, Switch,
  Table, TableHead, TableBody, TableRow, TableCell,
  Tooltip, IconButton, Chip, Autocomplete,
} from '@mui/material';
import {
  Percent, Palette, Zap, CheckCircle2, XCircle,
  FlaskConical, PlusCircle, Trash2,
} from 'lucide-react';
import type { AlloyMaster, AlloyMasterFormData, ChemicalElement } from '../types/alloyMaster.types';
import {
  getEmptyAlloyForm, ALLOY_CATEGORIES, ALLOY_STATUSES,
  ALLOY_TEMPLATES, DEFAULT_ELEMENTS,
} from '../types/alloyMaster.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (form: AlloyMasterFormData) => Promise<void>;
  editAlloy: AlloyMaster | null;
}

const PRESET_COLORS = [
  '#1565C0', '#0891b2', '#15803d', '#dc2626',
  '#9333ea', '#d97706', '#374151', '#be185d',
  '#4A4A4A', '#FFC107', '#8E24AA', '#C62828',
  '#2E7D32', '#424242', '#FDD835', '#0e7490',
];

// ─── Mini Color Picker ──────────────────────────────────────────────────────
const MiniColorPicker = ({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
      <Palette size={13} color="#64748b" />
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151' }}>{label}</Typography>
      <Box sx={{
        width: 16, height: 16, borderRadius: '50%', bgcolor: value || 'transparent',
        border: '2px solid rgba(0,0,0,0.15)', ml: 'auto',
      }} />
    </Box>
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
      {PRESET_COLORS.map((c) => (
        <Box
          key={c}
          onClick={() => onChange(c)}
          sx={{
            width: 18, height: 18, borderRadius: 0.5, bgcolor: c, cursor: 'pointer',
            border: value === c ? '3px solid #1565C0' : '1px solid rgba(0,0,0,0.1)',
            transition: 'transform 0.12s',
            '&:hover': { transform: 'scale(1.25)' },
          }}
        />
      ))}
      <Box
        component="label"
        sx={{
          width: 18, height: 18, borderRadius: 0.5, bgcolor: '#f1f5f9',
          border: '1px dashed #cbd5e1', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#94a3b8',
          '&:hover': { bgcolor: '#e2e8f0' },
        }}
        title="Custom color"
      >
        +
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
      </Box>
    </Box>
    <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>
      {value || '—'}
    </Typography>
  </Box>
);

// ─── Chemical Composition Row ───────────────────────────────────────────────
const CompositionRow = ({
  el, idx, onChange, onRemove, canRemove,
}: {
  el: ChemicalElement;
  idx: number;
  onChange: (idx: number, field: keyof ChemicalElement, val: any) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) => (
  <TableRow sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: '#f8fafc' } }}>
    <TableCell sx={{ px: 1, py: 0.75 }}>
      <TextField
        value={el.element}
        onChange={(e) => onChange(idx, 'element', e.target.value.toUpperCase())}
        size="small"
        slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' } } }}
        sx={{ width: 70, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
      />
    </TableCell>
    <TableCell sx={{ px: 1, py: 0.75 }}>
      <TextField
        value={el.min}
        onChange={(e) => onChange(idx, 'min', parseFloat(e.target.value) || 0)}
        size="small"
        type="number"
        slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01, style: { fontSize: '0.78rem' } } }}
        sx={{ width: 90, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
      />
    </TableCell>
    <TableCell sx={{ px: 1, py: 0.75 }}>
      <TextField
        value={el.max}
        onChange={(e) => onChange(idx, 'max', parseFloat(e.target.value) || 0)}
        size="small"
        type="number"
        slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01, style: { fontSize: '0.78rem' } } }}
        sx={{ width: 90, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
      />
    </TableCell>
    <TableCell sx={{ px: 1, py: 0.75 }}>
      <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>%</Typography>
    </TableCell>
    <TableCell sx={{ px: 0.5, py: 0.75 }}>
      {canRemove && (
        <Tooltip title="Remove element">
          <IconButton size="small" onClick={() => onRemove(idx)} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}>
            <Trash2 size={12} />
          </IconButton>
        </Tooltip>
      )}
    </TableCell>
  </TableRow>
);

// ─── Main Dialog ────────────────────────────────────────────────────────────
const AlloyDialog = ({ open, onClose, onSave, editAlloy }: Props) => {
  const [form, setForm] = useState<AlloyMasterFormData>(getEmptyAlloyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AlloyMasterFormData, string>>>({});
  const [loadTemplate, setLoadTemplate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'composition' | 'compliance'>('basic');

  useEffect(() => {
    if (open) {
      if (editAlloy) {
        setForm({
          alloyCode: editAlloy.alloyCode,
          alloyName: editAlloy.alloyName,
          alloyCategory: editAlloy.alloyCategory,
          description: editAlloy.description ?? '',
          defaultSellingMarginPercentage: editAlloy.defaultSellingMarginPercentage,
          displayColors: editAlloy.displayColors ?? {
            primaryColor: editAlloy.displayColor ?? '#1565C0',
            secondaryColor: editAlloy.secondaryColor ?? '',
          },
          chemicalComposition: editAlloy.chemicalComposition?.length
            ? editAlloy.chemicalComposition
            : DEFAULT_ELEMENTS.map((e) => ({ ...e })),
          keyProperties: editAlloy.keyProperties ?? '',
          bisCompliant: editAlloy.bisCompliant ?? true,
          isoCompliant: editAlloy.isoCompliant ?? false,
          status: editAlloy.status,
        });
      } else {
        setForm(getEmptyAlloyForm());
      }
      setErrors({});
      setLoadTemplate(null);
      setActiveTab('basic');
    }
  }, [open, editAlloy]);

  const set = <K extends keyof AlloyMasterFormData>(field: K, value: AlloyMasterFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Load alloy template
  const handleLoadTemplate = (code: string | null) => {
    setLoadTemplate(code);
    if (!code) return;
    const tpl = ALLOY_TEMPLATES.find((t) => t.alloyCode === code);
    if (!tpl) return;
    setForm((prev) => ({
      ...prev,
      alloyCode: tpl.alloyCode,
      alloyName: tpl.alloyName,
      alloyCategory: tpl.alloyCategory,
      displayColors: { ...tpl.displayColors },
      chemicalComposition: tpl.chemicalComposition.map((e) => ({ ...e })),
      keyProperties: tpl.keyProperties,
      bisCompliant: tpl.bisCompliant,
      isoCompliant: tpl.isoCompliant,
    }));
    setErrors({});
  };

  // Chemical composition handlers
  const handleCompChange = (idx: number, field: keyof ChemicalElement, val: any) => {
    setForm((prev) => {
      const comp = [...prev.chemicalComposition];
      comp[idx] = { ...comp[idx], [field]: val };
      return { ...prev, chemicalComposition: comp };
    });
  };

  const handleAddElement = () => {
    setForm((prev) => ({
      ...prev,
      chemicalComposition: [...prev.chemicalComposition, { element: '', min: 0, max: 0, unit: '%' }],
    }));
  };

  const handleRemoveElement = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      chemicalComposition: prev.chemicalComposition.filter((_, i) => i !== idx),
    }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof AlloyMasterFormData, string>> = {};
    if (!form.alloyCode.trim()) e.alloyCode = 'Alloy Code is required';
    if (!form.alloyName.trim()) e.alloyName = 'Alloy Name is required';
    if (!form.alloyCategory) e.alloyCategory = 'Category is required';
    if (form.defaultSellingMarginPercentage < 0 || form.defaultSellingMarginPercentage > 100) {
      e.defaultSellingMarginPercentage = 'Margin must be between 0–100';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { setActiveTab('basic'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!editAlloy;

  const tabs = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'composition', label: 'Chemical Composition' },
    { key: 'compliance', label: 'Standards & Colors' },
  ] as const;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: 'hidden', maxHeight: '92vh' } } }}
    >
      {/* ── Header ── */}
      <Box sx={{ px: 3, py: 2.5, background: 'linear-gradient(135deg, #1565C0 0%, #0d47a1 100%)', color: 'white', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1.5, display: 'flex' }}>
            <FlaskConical size={18} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
              {isEdit ? 'Edit Alloy' : 'Add New Alloy'}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', opacity: 0.8 }}>
              {isEdit ? `Editing ${editAlloy?.alloyCode}` : 'Configure alloy details, composition & compliance'}
            </Typography>
          </Box>
          {/* Load Template (only for new) */}
          {!isEdit && (
            <Box sx={{ ml: 'auto', minWidth: 220 }}>
              <Autocomplete
                size="small"
                options={ALLOY_TEMPLATES.map((t) => t.alloyCode)}
                getOptionLabel={(code) => {
                  const tpl = ALLOY_TEMPLATES.find((t) => t.alloyCode === code);
                  return tpl ? `${tpl.alloyName} (${tpl.alloyCode})` : code;
                }}
                value={loadTemplate}
                onChange={(_, val) => handleLoadTemplate(val)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Load Alloy Type..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(255,255,255,0.15)',
                        color: 'white',
                        borderRadius: 2,
                        fontSize: '0.78rem',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
                        '&.Mui-focused fieldset': { borderColor: 'white' },
                      },
                      '& .MuiAutocomplete-popupIndicator': { color: 'white' },
                      '& .MuiAutocomplete-clearIndicator': { color: 'white' },
                      input: { color: 'white', '&::placeholder': { color: 'rgba(255,255,255,0.7)' } },
                    }}
                    slotProps={{
                      ...params.slotProps,
                      input: {
                        ...params.slotProps.input,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <Zap size={14} color="rgba(255,255,255,0.8)" />
                            </InputAdornment>
                            {params.slotProps.input.startAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
                slotProps={{
                  paper: {
                    sx: { bgcolor: '#fff', borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', mt: 0.5 }
                  }
                }}
              />
              {loadTemplate && (
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.75)', mt: 0.5, textAlign: 'right' }}>
                  ✓ Template loaded — review & customize below
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Tab Bar */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {tabs.map((t) => (
            <Box
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              sx={{
                px: 2, py: 0.75, borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '0.75rem',
                fontWeight: activeTab === t.key ? 700 : 500,
                bgcolor: activeTab === t.key ? 'white' : 'rgba(255,255,255,0.15)',
                color: activeTab === t.key ? '#1565C0' : 'rgba(255,255,255,0.85)',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: activeTab === t.key ? 'white' : 'rgba(255,255,255,0.25)' },
              }}
            >
              {t.label}
            </Box>
          ))}
        </Box>
      </Box>

      <DialogContent sx={{ px: 3, py: 3, overflowY: 'auto' }}>

        {/* ══ TAB: BASIC INFO ══ */}
        {activeTab === 'basic' && (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Alloy Code *"
                value={form.alloyCode}
                onChange={(e) => set('alloyCode', e.target.value.toUpperCase())}
                error={!!errors.alloyCode}
                helperText={errors.alloyCode || 'e.g. ADC12, LM6, LM25'}
                size="small"
                sx={{ flex: 1 }}
                slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontWeight: 700 } } }}
                disabled={isEdit}
              />
              <TextField
                label="Alloy Name *"
                value={form.alloyName}
                onChange={(e) => set('alloyName', e.target.value)}
                error={!!errors.alloyName}
                helperText={errors.alloyName}
                size="small"
                sx={{ flex: 1 }}
              />
            </Box>

            <FormControl size="small" fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category *</InputLabel>
              <Select
                label="Category *"
                value={form.alloyCategory}
                onChange={(e) => set('alloyCategory', e.target.value as any)}
                error={!!errors.alloyCategory}
              >
                {ALLOY_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
              {errors.alloyCategory && (
                <Typography sx={{ fontSize: '0.72rem', color: '#d32f2f', mt: 0.5, ml: 1.5 }}>{errors.alloyCategory}</Typography>
              )}
            </FormControl>

            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
              placeholder="Optional: alloy composition, use case, specifications..."
              sx={{ mb: 2 }}
            />

            <TextField
              label="Key Properties"
              value={form.keyProperties}
              onChange={(e) => set('keyProperties', e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
              placeholder="e.g. Good corrosion resistance, high fluidity, heat treatable..."
              sx={{ mb: 2.5 }}
            />

            <Divider sx={{ mb: 2.5 }} />

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                label="Default Selling Margin %"
                value={form.defaultSellingMarginPercentage}
                onChange={(e) => set('defaultSellingMarginPercentage', parseFloat(e.target.value) || 0)}
                error={!!errors.defaultSellingMarginPercentage}
                helperText={errors.defaultSellingMarginPercentage || 'Used in Cost Ledger calculations'}
                size="small"
                type="number"
                sx={{ flex: 1 }}
                slotProps={{
                  htmlInput: { min: 0, max: 100, step: 0.5 },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Percent size={14} color="#94a3b8" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as any)}
                >
                  {ALLOY_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {form.status === 'Inactive' && (
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef9c3', borderRadius: 1.5, border: '1px solid #fde68a' }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>
                  ⚠ Inactive alloys cannot be selected in Heat Entry, Production, Cost Ledger, or Dispatch.
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* ══ TAB: CHEMICAL COMPOSITION ══ */}
        {activeTab === 'composition' && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Chemical Composition
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.25 }}>
                  Define element ranges (min–max in %). Leave min = 0 for max-only specs.
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<PlusCircle size={13} />}
                onClick={handleAddElement}
                variant="outlined"
                sx={{ borderRadius: 2, fontSize: '0.72rem' }}
              >
                Add Element
              </Button>
            </Box>

            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    {['Element', 'Min (%)', 'Max (%)', 'Unit', ''].map((h) => (
                      <TableCell key={h} sx={{
                        fontSize: '0.62rem', fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        borderBottom: '1px solid #e2e8f0', py: 1, px: 1,
                      }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.chemicalComposition.map((el, idx) => (
                    <CompositionRow
                      key={idx}
                      el={el}
                      idx={idx}
                      onChange={handleCompChange}
                      onRemove={handleRemoveElement}
                      canRemove={form.chemicalComposition.length > 1}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>

            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#eff6ff', borderRadius: 1.5, border: '1px solid #bfdbfe' }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600 }}>
                💡 Tip: For elements with only a maximum limit (e.g. Fe ≤ 1.00%), set Min = 0 and Max = the limit.
                For ranges (e.g. Si 10.5–13.5%), enter both Min and Max values.
              </Typography>
            </Box>
          </Box>
        )}

        {/* ══ TAB: STANDARDS & COLORS ══ */}
        {activeTab === 'compliance' && (
          <Box>
            {/* Quality Standards */}
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 2 }}>
              Quality Standards & Compliance
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              {/* BIS */}
              <Box sx={{
                flex: 1, p: 2, borderRadius: 2,
                border: form.bisCompliant ? '2px solid #22c55e' : '1px solid #e2e8f0',
                bgcolor: form.bisCompliant ? '#f0fdf4' : '#fafafa',
                transition: 'all 0.2s',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {form.bisCompliant
                      ? <CheckCircle2 size={16} color="#16a34a" />
                      : <XCircle size={16} color="#94a3b8" />}
                    <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: form.bisCompliant ? '#15803d' : '#64748b' }}>
                      BIS Compliant
                    </Typography>
                  </Box>
                  <Switch
                    checked={form.bisCompliant}
                    onChange={(e) => set('bisCompliant', e.target.checked)}
                    size="small"
                    color="success"
                  />
                </Box>
                <Typography sx={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.5 }}>
                  Bureau of Indian Standards (IS standards for aluminium casting alloys)
                </Typography>
                {form.bisCompliant && (
                  <Chip label="BIS Certified" size="small" sx={{ mt: 1, bgcolor: '#dcfce7', color: '#15803d', fontSize: '0.62rem', fontWeight: 700 }} />
                )}
              </Box>

              {/* ISO */}
              <Box sx={{
                flex: 1, p: 2, borderRadius: 2,
                border: form.isoCompliant ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                bgcolor: form.isoCompliant ? '#eff6ff' : '#fafafa',
                transition: 'all 0.2s',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {form.isoCompliant
                      ? <CheckCircle2 size={16} color="#2563eb" />
                      : <XCircle size={16} color="#94a3b8" />}
                    <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: form.isoCompliant ? '#1d4ed8' : '#64748b' }}>
                      ISO Compliant
                    </Typography>
                  </Box>
                  <Switch
                    checked={form.isoCompliant}
                    onChange={(e) => set('isoCompliant', e.target.checked)}
                    size="small"
                    color="primary"
                  />
                </Box>
                <Typography sx={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.5 }}>
                  International Organization for Standardization (ISO 3522 etc.)
                </Typography>
                {form.isoCompliant && (
                  <Chip label="ISO Certified" size="small" sx={{ mt: 1, bgcolor: '#dbeafe', color: '#1d4ed8', fontSize: '0.62rem', fontWeight: 700 }} />
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            {/* Display Colors */}
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
              Display Colors
            </Typography>

            {/* Color Preview */}
            <Box sx={{
              mb: 2.5, p: 2, borderRadius: 2,
              background: `linear-gradient(135deg, ${form.displayColors.primaryColor} 0%, ${form.displayColors.secondaryColor || form.displayColors.primaryColor} 100%)`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', borderRadius: 2 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'white' }} />
                <Typography sx={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>
                  {form.alloyCode || 'PREVIEW'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                {form.displayColors.primaryColor} → {form.displayColors.secondaryColor || 'same'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box sx={{ flex: 1 }}>
                <MiniColorPicker
                  label="Primary Color *"
                  value={form.displayColors.primaryColor}
                  onChange={(v) => set('displayColors', { ...form.displayColors, primaryColor: v })}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <MiniColorPicker
                  label="Secondary Color"
                  value={form.displayColors.secondaryColor}
                  onChange={(v) => set('displayColors', { ...form.displayColors, secondaryColor: v })}
                />
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1, borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
        {/* Tab Navigation inside footer */}
        <Box sx={{ flex: 1, display: 'flex', gap: 0.5 }}>
          {activeTab !== 'basic' && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setActiveTab(activeTab === 'compliance' ? 'composition' : 'basic')}
              sx={{ borderRadius: 2, fontSize: '0.72rem' }}
            >
              ← Previous
            </Button>
          )}
          {activeTab !== 'compliance' && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setActiveTab(activeTab === 'basic' ? 'composition' : 'compliance')}
              sx={{ borderRadius: 2, fontSize: '0.72rem' }}
            >
              Next →
            </Button>
          )}
        </Box>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving}
          sx={{ borderRadius: 2, fontWeight: 600, px: 3 }}
        >
          {saving
            ? <CircularProgress size={14} sx={{ color: 'white' }} />
            : isEdit ? 'Save Changes' : 'Add Alloy'
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlloyDialog;
