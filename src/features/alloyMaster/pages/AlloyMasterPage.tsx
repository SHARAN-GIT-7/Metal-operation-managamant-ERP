import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Chip, Tooltip,
  CircularProgress, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Select, FormControl, InputLabel, Tab, Tabs,
  useTheme, useMediaQuery,
} from '@mui/material';
import {
  Plus, Search, Edit2, Trash2, Beaker,
  CheckCircle, AlertTriangle,
  Filter, RefreshCw, Percent, Ban,
  ShieldCheck, ShieldOff, FlaskConical, BarChart3,
  ArrowUpDown, Maximize2, Minimize2,
} from 'lucide-react';
import type { AlloyMaster, AlloyMasterFormData, AlloyStatus } from '../types/alloyMaster.types';
import { ALLOY_CATEGORIES } from '../types/alloyMaster.types';
import {
  subscribeAlloys,
  addAlloy,
  updateAlloy,
  updateAlloyStatus,
  deleteAlloy,
} from '../services/alloyMaster.service';
import AlloyDialog from '../components/AlloyDialog';
import { useAuth } from '../../../context/AuthContext';
import { Timestamp } from 'firebase/firestore';

// ─── Status Badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: AlloyStatus }) => {
  const cfg: Record<AlloyStatus, { bg: string; color: string; border: string }> = {
    Active:   { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
    Inactive: { bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
  };
  const c = cfg[status];
  return (
    <Chip
      label={status}
      size="small"
      sx={{ fontSize: '0.65rem', fontWeight: 700, bgcolor: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    />
  );
};

// ─── Color Swatch ─────────────────────────────────────────────────────────
const ColorSwatch = ({ primary, secondary }: { primary: string; secondary?: string }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
    <Tooltip title={primary} arrow>
      <Box sx={{
        width: 14, height: 14, borderRadius: '50%', bgcolor: primary,
        border: '2px solid rgba(0,0,0,0.1)', flexShrink: 0,
      }} />
    </Tooltip>
    {secondary && (
      <Tooltip title={secondary} arrow>
        <Box sx={{
          width: 14, height: 14, borderRadius: '50%', bgcolor: secondary,
          border: '2px solid rgba(0,0,0,0.1)', flexShrink: 0,
        }} />
      </Tooltip>
    )}
  </Box>
);

// ─── Compliance Badge ─────────────────────────────────────────────────────
const CompBadge = ({ yes, label }: { yes: boolean; label: string }) => (
  <Chip
    icon={yes
      ? <ShieldCheck size={10} style={{ marginLeft: 6 }} />
      : <ShieldOff size={10} style={{ marginLeft: 6 }} />}
    label={label}
    size="small"
    sx={{
      fontSize: '0.6rem', fontWeight: 700,
      bgcolor: yes ? '#dcfce7' : '#f1f5f9',
      color: yes ? '#15803d' : '#94a3b8',
      border: `1px solid ${yes ? '#bbf7d0' : '#e2e8f0'}`,
      '& .MuiChip-icon': { color: yes ? '#15803d' : '#94a3b8' },
    }}
  />
);

// ─── Format composition range ─────────────────────────────────────────────
const fmtRange = (min: number, max: number) => {
  if (min === 0 && max === 0) return '—';
  if (min === 0) return `≤ ${max}`;
  if (min === max) return `${min}`;
  return `${min}–${max}`;
};

// ─── Main Page ────────────────────────────────────────────────────────────
const AlloyMasterPage = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tableMaximized, setTableMaximized] = useState(false);
  const { user } = useAuth();
  const [alloys, setAlloys] = useState<AlloyMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState<0 | 1>(0); // 0=Alloy List, 1=Compliance Table

  // Filters & search
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<AlloyStatus | 'All'>('All');
  const [filterMargin, setFilterMargin] = useState<'All' | 'Low' | 'Medium' | 'High'>('All');
  const [filterBIS, setFilterBIS] = useState<'All' | 'Yes' | 'No'>('All');
  const [filterISO, setFilterISO] = useState<'All' | 'Yes' | 'No'>('All');

  // Sorting state
  const [sortKey, setSortKey] = useState<string>('alloyCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Dialogs
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AlloyMaster | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ alloy: AlloyMaster; newStatus: AlloyStatus } | null>(null);
  const [editAlloy, setEditAlloy] = useState<AlloyMaster | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail expand for composition
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAlloys((data) => {
      setAlloys(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtered list
  const filtered = useMemo(() => {
    const list = alloys.filter((a) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        a.alloyName.toLowerCase().includes(q) ||
        a.alloyCode.toLowerCase().includes(q) ||
        a.alloyCategory.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q);

      const matchCat = filterCategory === 'All' || a.alloyCategory === filterCategory;
      const matchStatus = filterStatus === 'All' || a.status === filterStatus;
      const matchMargin =
        filterMargin === 'All' ||
        (filterMargin === 'Low' && a.defaultSellingMarginPercentage < 5) ||
        (filterMargin === 'Medium' && a.defaultSellingMarginPercentage >= 5 && a.defaultSellingMarginPercentage <= 10) ||
        (filterMargin === 'High' && a.defaultSellingMarginPercentage > 10);
      const matchBIS = filterBIS === 'All' || (filterBIS === 'Yes' ? a.bisCompliant : !a.bisCompliant);
      const matchISO = filterISO === 'All' || (filterISO === 'Yes' ? a.isoCompliant : !a.isoCompliant);

      return matchSearch && matchCat && matchStatus && matchMargin && matchBIS && matchISO;
    });

    list.sort((a, b) => {
      let av: any = (a as any)[sortKey];
      let bv: any = (b as any)[sortKey];
      if (sortKey === 'createdAt') {
        av = a.createdAt instanceof Timestamp ? a.createdAt.seconds : 0;
        bv = b.createdAt instanceof Timestamp ? b.createdAt.seconds : 0;
      } else if (sortKey.startsWith('element_')) {
        const elName = sortKey.replace('element_', '');
        const compA = a.chemicalComposition?.find((c) => c.element === elName);
        const compB = b.chemicalComposition?.find((c) => c.element === elName);
        av = compA ? compA.min : -1;
        bv = compB ? compB.min : -1;
      }
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [alloys, search, filterCategory, filterStatus, filterMargin, filterBIS, filterISO, sortKey, sortDir]);

  // Stats
  const stats = useMemo(() => ({
    total: alloys.length,
    active: alloys.filter((a) => a.status === 'Active').length,
    bisCount: alloys.filter((a) => a.bisCompliant).length,
    isoCount: alloys.filter((a) => a.isoCompliant).length,
    avgMargin: alloys.length
      ? (alloys.reduce((s, a) => s + a.defaultSellingMarginPercentage, 0) / alloys.length).toFixed(1)
      : '0',
  }), [alloys]);

  const displayName = user?.displayName ?? user?.email ?? 'Admin';

  const handleOpenAdd = () => { setEditAlloy(null); setAddEditOpen(true); };
  const handleOpenEdit = (a: AlloyMaster) => { setEditAlloy(a); setAddEditOpen(true); };

  const handleSave = async (form: AlloyMasterFormData) => {
    if (editAlloy) {
      await updateAlloy(editAlloy.id, form, displayName);
    } else {
      await addAlloy(form, displayName);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.id + '_delete');
    try {
      await deleteAlloy(deleteConfirm.id);
      setDeleteConfirm(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async () => {
    if (!statusConfirm) return;
    setActionLoading(statusConfirm.alloy.id + '_status');
    try {
      await updateAlloyStatus(statusConfirm.alloy.id, statusConfirm.newStatus, displayName);
      setStatusConfirm(null);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return '…';
  };

  const resetFilters = () => {
    setSearch('');
    setFilterCategory('All');
    setFilterStatus('All');
    setFilterMargin('All');
    setFilterBIS('All');
    setFilterISO('All');
  };

  const hasActiveFilters = search || filterCategory !== 'All' || filterStatus !== 'All' || filterMargin !== 'All' || filterBIS !== 'All' || filterISO !== 'All';

  // All unique element names from all alloys
  const allElements = useMemo(() => {
    const set = new Set<string>();
    alloys.forEach((a) => a.chemicalComposition?.forEach((c) => set.add(c.element)));
    return ['Fe', 'Si', 'Mn', 'Ni', 'Ti', 'Cu', 'Mg', 'Zn', ...Array.from(set)].filter((v, i, arr) => arr.indexOf(v) === i);
  }, [alloys]);

  return (
    <Box>
      {/* ── Page Header ── */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'flex-start' }, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <FlaskConical size={20} color="#1565C0" />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Alloy Master</Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Template library for all alloy types — chemical composition, compliance & pricing.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={handleOpenAdd}
          sx={{ borderRadius: 2, fontWeight: 600, px: 2.5, width: { xs: '100%', sm: 'auto' } }}
        >
          Add Alloy
        </Button>
      </Box>

      {/* ── Stats Row ── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Alloys',    value: stats.total,         color: '#1565C0', bg: '#dbeafe', icon: <Beaker size={16} /> },
          { label: 'Active',          value: stats.active,        color: '#15803d', bg: '#dcfce7', icon: <CheckCircle size={16} /> },
          { label: 'BIS Certified',   value: stats.bisCount,      color: '#0891b2', bg: '#ecfeff', icon: <ShieldCheck size={16} /> },
          { label: 'ISO Certified',   value: stats.isoCount,      color: '#7c3aed', bg: '#f5f3ff', icon: <ShieldCheck size={16} /> },
          { label: 'Avg. Margin',     value: `${stats.avgMargin}%`, color: '#9333ea', bg: '#fdf4ff', icon: <Percent size={16} /> },
        ].map((s) => (
          <Card key={s.label} sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 120px' }, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderRadius: 2.5 }}>
            <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: s.color, lineHeight: 1.2 }}>
                    {s.value}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, bgcolor: s.bg, borderRadius: 1.5, color: s.color }}>{s.icon}</Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* ── Page Tabs ── */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={pageTab}
          onChange={(_, v) => setPageTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { fontSize: '0.8rem', fontWeight: 600, minHeight: 40 },
            '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          <Tab icon={<Beaker size={14} />} iconPosition="start" label="Alloy Library" />
          <Tab icon={<BarChart3 size={14} />} iconPosition="start" label="Compliance & Composition Table" />
        </Tabs>
        <Box sx={{ height: 2, bgcolor: '#f1f5f9' }} />
      </Box>

      {/* ══════════ TAB 0: ALLOY LIBRARY ══════════ */}
      {pageTab === 0 && (
        <>
          {/* ── Search & Filters ── */}
          <Card sx={{ mb: 2, borderRadius: 2.5, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ py: 1.5, px: 2.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search alloy name, code, category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search size={16} color="#94a3b8" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ flex: { xs: '1 1 100%', sm: 1 }, minWidth: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 }, flex: { xs: '1 1 100%', sm: 'auto' } }}>
                  <InputLabel sx={{ fontSize: '0.8rem' }}>Category</InputLabel>
                  <Select label="Category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} sx={{ borderRadius: 2, fontSize: '0.8rem' }}>
                    <MenuItem value="All">All Categories</MenuItem>
                    {ALLOY_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 110 }, flex: { xs: '1 1 100%', sm: 'auto' } }}>
                  <InputLabel sx={{ fontSize: '0.8rem' }}>Status</InputLabel>
                  <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} sx={{ borderRadius: 2, fontSize: '0.8rem' }}>
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 100 }, flex: { xs: '1 1 100%', sm: 'auto' } }}>
                  <InputLabel sx={{ fontSize: '0.8rem' }}>BIS</InputLabel>
                  <Select label="BIS" value={filterBIS} onChange={(e) => setFilterBIS(e.target.value as any)} sx={{ borderRadius: 2, fontSize: '0.8rem' }}>
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 100 }, flex: { xs: '1 1 100%', sm: 'auto' } }}>
                  <InputLabel sx={{ fontSize: '0.8rem' }}>ISO</InputLabel>
                  <Select label="ISO" value={filterISO} onChange={(e) => setFilterISO(e.target.value as any)} sx={{ borderRadius: 2, fontSize: '0.8rem' }}>
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </Select>
                </FormControl>
                {hasActiveFilters && (
                  <Tooltip title="Clear all filters">
                    <IconButton size="small" onClick={resetFilters} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' }, ml: { xs: 'auto', sm: 0 } }}>
                      <RefreshCw size={15} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {hasActiveFilters && (
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Filter size={11} color="#94a3b8" />
                  <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>Filters active —</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#1565C0', fontWeight: 600 }}>
                    {filtered.length} of {alloys.length} alloys shown
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* ── Main Table ── */}
          {tableMaximized && (
            <Box
              onClick={() => setTableMaximized(false)}
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                bgcolor: 'rgba(0, 0, 0, 0.6)',
                zIndex: 1290,
              }}
            />
          )}

          <Card 
            sx={{ 
              borderRadius: 2.5, 
              boxShadow: '0 1px 8px rgba(0,0,0,0.06)', 
              overflow: 'hidden',
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
                {tableMaximized ? 'Alloy Template Library (Expanded View)' : 'Alloy Template Library'}
              </Typography>
              <Tooltip title={tableMaximized ? "Close / Minimize" : "Maximize Table"}>
                <IconButton size="small" onClick={() => setTableMaximized(!tableMaximized)} sx={{ color: 'text.secondary' }}>
                  {tableMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </IconButton>
              </Tooltip>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress size={32} />
                <Typography sx={{ ml: 2, color: 'text.secondary' }}>Loading alloys...</Typography>
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <FlaskConical size={40} color="#cbd5e1" />
                <Typography sx={{ mt: 2, color: 'text.secondary', fontWeight: 500 }}>
                  {hasActiveFilters ? 'No alloys match your filters.' : 'No alloys found. Add your first alloy.'}
                </Typography>
                {!hasActiveFilters && (
                  <Button variant="outlined" sx={{ mt: 2, borderRadius: 2 }} onClick={handleOpenAdd} startIcon={<Plus size={14} />}>
                    Add Alloy
                  </Button>
                )}
              </Box>
            ) : (
              <TableContainer sx={{ overflowX: 'auto', width: '100%', maxHeight: tableMaximized ? 'calc(90vh - 120px)' : 'none' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {[
                        { label: 'Code & Color', key: 'alloyCode' },
                        { label: 'Alloy Name', key: 'alloyName' },
                        { label: 'Category', key: 'alloyCategory' },
                        { label: 'Composition', key: '' },
                        { label: 'Standards', key: '' },
                        { label: 'Margin %', key: 'defaultSellingMarginPercentage' },
                        { label: 'Status', key: 'status' },
                        { label: 'Created', key: 'createdAt' },
                        { label: 'Actions', key: '' }
                      ].map((col) => (
                        <TableCell
                          key={col.label}
                          onClick={() => col.key && handleSort(col.key)}
                          sx={{
                            fontSize: '0.6rem', fontWeight: 700, color: '#64748b',
                            textTransform: 'uppercase', letterSpacing: 0.6,
                            borderBottom: '1px solid #e2e8f0', py: 1.5, px: 1.5,
                            whiteSpace: 'nowrap',
                            cursor: col.key ? 'pointer' : 'default',
                            userSelect: 'none',
                            '&:hover': col.key ? { bgcolor: '#f1f5f9' } : {}
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {col.label}
                            {col.key && (
                              <ArrowUpDown size={10} style={{ color: sortKey === col.key ? '#1565C0' : '#94a3b8', opacity: sortKey === col.key ? 1 : 0.4 }} />
                            )}
                          </Box>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((a) => {
                      const primaryColor = a.displayColors?.primaryColor ?? a.displayColor ?? '#1565C0';
                      const secondaryColor = a.displayColors?.secondaryColor ?? a.secondaryColor ?? '';
                      const compSummary = a.chemicalComposition
                        ?.slice(0, 3)
                        .map((c) => `${c.element}: ${fmtRange(c.min, c.max)}`)
                        .join(', ') ?? '—';

                      return (
                        <>
                          <TableRow
                            key={a.id}
                            onClick={() => setExpandedRow(expandedRow === a.id ? null : a.id)}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#f8fafc' },
                              opacity: a.status === 'Inactive' ? 0.7 : 1,
                              transition: 'opacity 0.2s, background 0.1s',
                              borderBottom: expandedRow === a.id ? 'none' : '1px solid #f1f5f9',
                              bgcolor: expandedRow === a.id ? '#eff6ff' : 'transparent',
                            }}
                          >
                            {/* Code & Color */}
                            <TableCell sx={{ px: 1.5, py: 1.25 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <ColorSwatch primary={primaryColor} secondary={secondaryColor || undefined} />
                                <Box sx={{
                                  px: 1, py: 0.25,
                                  bgcolor: '#eff6ff', color: '#1d4ed8',
                                  borderRadius: 1, fontSize: '0.68rem', fontWeight: 700,
                                  border: '1px solid #bfdbfe', fontFamily: 'monospace',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {a.alloyCode}
                                </Box>
                              </Box>
                            </TableCell>

                            {/* Alloy Name */}
                            <TableCell sx={{ px: 1.5, py: 1.25, minWidth: 110 }}>
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                                {a.alloyName}
                              </Typography>
                              {a.keyProperties && (
                                <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8', mt: 0.15 }} noWrap>
                                  {a.keyProperties.length > 38 ? a.keyProperties.slice(0, 38) + '…' : a.keyProperties}
                                </Typography>
                              )}
                            </TableCell>

                            {/* Category */}
                            <TableCell sx={{ px: 1.5, py: 1.25 }}>
                              <Chip
                                label={a.alloyCategory}
                                size="small"
                                sx={{ fontSize: '0.6rem', fontWeight: 700, bgcolor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                              />
                            </TableCell>

                            {/* Composition Summary */}
                            <TableCell sx={{ px: 1.5, py: 1.25, minWidth: 160 }}>
                              <Typography sx={{ fontSize: '0.65rem', color: '#475569', fontFamily: 'monospace' }}>
                                {compSummary}
                                {(a.chemicalComposition?.length ?? 0) > 3 && (
                                  <span style={{ color: '#94a3b8' }}> +{(a.chemicalComposition?.length ?? 0) - 3} more</span>
                                )}
                              </Typography>
                            </TableCell>

                            {/* Standards */}
                            <TableCell sx={{ px: 1.5, py: 1.25 }}>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                <CompBadge yes={a.bisCompliant ?? false} label="BIS" />
                                <CompBadge yes={a.isoCompliant ?? false} label="ISO" />
                              </Box>
                            </TableCell>

                            {/* Margin */}
                            <TableCell sx={{ px: 1.5, py: 1.25 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#9333ea' }}>
                                  {a.defaultSellingMarginPercentage}
                                </Typography>
                                <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8' }}>%</Typography>
                              </Box>
                            </TableCell>

                            {/* Status */}
                            <TableCell sx={{ px: 1.5, py: 1.25 }}>
                              <StatusBadge status={a.status} />
                            </TableCell>

                            {/* Created */}
                            <TableCell sx={{ px: 1.5, py: 1.25 }}>
                              <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                {formatDate(a.createdAt)}
                              </Typography>
                            </TableCell>

                            {/* Actions */}
                            <TableCell sx={{ px: 1, py: 1.25 }} onClick={(e) => e.stopPropagation()}>
                              <Box sx={{ display: 'flex', gap: 0.25 }}>
                                <Tooltip title="Edit Alloy">
                                  <IconButton size="small" onClick={() => handleOpenEdit(a)} sx={{ color: '#0891b2', '&:hover': { bgcolor: '#ecfeff' } }}>
                                    <Edit2 size={13} />
                                  </IconButton>
                                </Tooltip>
                                {a.status === 'Active' ? (
                                  <Tooltip title="Mark as Inactive">
                                    <IconButton size="small" onClick={() => setStatusConfirm({ alloy: a, newStatus: 'Inactive' })} sx={{ color: '#b45309', '&:hover': { bgcolor: '#fef9c3' } }}>
                                      <Ban size={13} />
                                    </IconButton>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title="Activate Alloy">
                                    <IconButton size="small" onClick={() => setStatusConfirm({ alloy: a, newStatus: 'Active' })} sx={{ color: '#15803d', '&:hover': { bgcolor: '#dcfce7' } }}>
                                      <CheckCircle size={13} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Delete Alloy">
                                  <IconButton size="small" onClick={() => setDeleteConfirm(a)} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}>
                                    <Trash2 size={13} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Chemical Composition Row */}
                          {expandedRow === a.id && (
                            <TableRow key={`${a.id}-detail`} sx={{ bgcolor: '#eff6ff' }}>
                              <TableCell colSpan={9} sx={{ px: 3, py: 2, borderBottom: '2px solid #bfdbfe' }}>
                                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                  {/* Composition Table */}
                                  <Box sx={{ flex: 2, minWidth: 300 }}>
                                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                                      Chemical Composition
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                      {(a.chemicalComposition ?? []).map((c) => (
                                        <Box key={c.element} sx={{
                                          px: 1.5, py: 0.5, bgcolor: 'white', borderRadius: 1.5,
                                          border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(21,101,192,0.08)',
                                        }}>
                                          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#1565C0', fontFamily: 'monospace' }}>
                                            {c.element}
                                          </Typography>
                                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>
                                            {fmtRange(c.min, c.max)} %
                                          </Typography>
                                        </Box>
                                      ))}
                                    </Box>
                                  </Box>
                                  {/* Key Properties */}
                                  {a.keyProperties && (
                                    <Box sx={{ flex: 1, minWidth: 180 }}>
                                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                                        Key Properties
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.6 }}>
                                        {a.keyProperties}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Table Footer */}
            {!loading && filtered.length > 0 && (
              <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Showing <b style={{ color: '#1565C0' }}>{filtered.length}</b> of {alloys.length} alloys
                  {' '}· Click a row to expand composition
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip label={`Active: ${stats.active}`} size="small" sx={{ fontSize: '0.62rem', bgcolor: '#dcfce7', color: '#15803d' }} />
                  <Chip label={`BIS: ${stats.bisCount}`} size="small" sx={{ fontSize: '0.62rem', bgcolor: '#ecfeff', color: '#0891b2' }} />
                  <Chip label={`ISO: ${stats.isoCount}`} size="small" sx={{ fontSize: '0.62rem', bgcolor: '#f5f3ff', color: '#7c3aed' }} />
                </Box>
              </Box>
            )}
          </Card>
        </>
      )}

      {/* ══════════ TAB 1: COMPLIANCE & COMPOSITION TABLE ══════════ */}
      {pageTab === 1 && (
        <>
          {tableMaximized && (
            <Box
              onClick={() => setTableMaximized(false)}
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                bgcolor: 'rgba(0, 0, 0, 0.6)',
                zIndex: 1290,
              }}
            />
          )}

          <Card 
            sx={{ 
              borderRadius: 2.5, 
              boxShadow: '0 1px 8px rgba(0,0,0,0.06)', 
              overflow: 'hidden',
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
            <Box sx={{ px: 2.5, py: 2, borderBottom: isDark ? '1px solid #2d3748' : '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: isDark ? '#1a2130' : '#f8fafc' }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  {tableMaximized ? 'Master Alloy Monitoring & Compliance Table (Expanded View)' : 'Master Alloy Monitoring & Compliance Table'}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.25 }}>
                  Full chemical composition reference with quality standards — {alloys.length} alloys
                </Typography>
              </Box>
              <Tooltip title={tableMaximized ? "Close / Minimize" : "Maximize Table"}>
                <IconButton size="small" onClick={() => setTableMaximized(!tableMaximized)} sx={{ color: 'text.secondary' }}>
                  {tableMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </IconButton>
              </Tooltip>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: tableMaximized ? 'calc(90vh - 75px)' : 'calc(100vh - 380px)', overflowX: 'auto', width: '100%' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{ ...compHeaderStyle, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                      onClick={() => handleSort('alloyName')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Alloy Type
                        <ArrowUpDown size={10} style={{ color: sortKey === 'alloyName' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'alloyName' ? 1 : 0.4 }} />
                      </Box>
                    </TableCell>
                    {allElements.map((el) => {
                      const elKey = `element_${el}`;
                      return (
                        <TableCell
                          key={el}
                          sx={{ ...compHeaderStyle, fontFamily: 'monospace', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                          onClick={() => handleSort(elKey)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {el} (%)
                            <ArrowUpDown size={10} style={{ color: sortKey === elKey ? '#1565C0' : '#94a3b8', opacity: sortKey === elKey ? 1 : 0.4 }} />
                          </Box>
                        </TableCell>
                      );
                    })}
                    <TableCell
                      sx={{ ...compHeaderStyle, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                      onClick={() => handleSort('keyProperties')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Key Properties / Usage Notes
                        <ArrowUpDown size={10} style={{ color: sortKey === 'keyProperties' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'keyProperties' ? 1 : 0.4 }} />
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ ...compHeaderStyle, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                      onClick={() => handleSort('bisCompliant')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        BIS
                        <ArrowUpDown size={10} style={{ color: sortKey === 'bisCompliant' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'bisCompliant' ? 1 : 0.4 }} />
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ ...compHeaderStyle, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                      onClick={() => handleSort('isoCompliant')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        ISO
                        <ArrowUpDown size={10} style={{ color: sortKey === 'isoCompliant' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'isoCompliant' ? 1 : 0.4 }} />
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ ...compHeaderStyle, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                      onClick={() => handleSort('status')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Status
                        <ArrowUpDown size={10} style={{ color: sortKey === 'status' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'status' ? 1 : 0.4 }} />
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((a, rowIdx) => {
                    const primaryColor = a.displayColors?.primaryColor ?? a.displayColor ?? '#1565C0';
                    const secondaryColor = a.displayColors?.secondaryColor ?? a.secondaryColor ?? '';
                    const elemMap: Record<string, { min: number; max: number }> = {};
                    a.chemicalComposition?.forEach((c) => { elemMap[c.element] = { min: c.min, max: c.max }; });

                    return (
                      <TableRow
                        key={a.id}
                        sx={{
                          '&:hover': { bgcolor: `${primaryColor}0A` },
                          bgcolor: rowIdx % 2 === 0 ? 'white' : '#fafbfc',
                          borderLeft: `3px solid ${primaryColor}`,
                        }}
                      >
                        <TableCell sx={{ px: 1.5, py: 1, whiteSpace: 'nowrap', minWidth: 130 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{
                              width: 10, height: 22, borderRadius: 0.5, flexShrink: 0,
                              background: secondaryColor
                                ? `linear-gradient(180deg, ${primaryColor} 50%, ${secondaryColor} 50%)`
                                : primaryColor,
                            }} />
                            <Box>
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>
                                {a.alloyName}
                              </Typography>
                              <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                                {a.alloyCode}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        {allElements.map((el) => {
                          const comp = elemMap[el];
                          const range = comp ? fmtRange(comp.min, comp.max) : '—';
                          return (
                            <TableCell key={el} sx={{ px: 1, py: 1, textAlign: 'center' }}>
                              <Typography sx={{
                                fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 500,
                                color: comp ? '#1e293b' : '#cbd5e1',
                              }}>
                                {range}
                              </Typography>
                            </TableCell>
                          );
                        })}

                        <TableCell sx={{ px: 1.5, py: 1, maxWidth: 200 }}>
                          <Typography sx={{ fontSize: '0.68rem', color: '#475569', lineHeight: 1.5 }}>
                            {a.keyProperties || '—'}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ px: 1, py: 1, textAlign: 'center' }}>
                          <CompBadge yes={a.bisCompliant ?? false} label={a.bisCompliant ? 'Yes' : 'No'} />
                        </TableCell>

                        <TableCell sx={{ px: 1, py: 1, textAlign: 'center' }}>
                          <CompBadge yes={a.isoCompliant ?? false} label={a.isoCompliant ? 'Yes' : 'No'} />
                        </TableCell>

                        <TableCell sx={{ px: 1.5, py: 1 }}>
                          <StatusBadge status={a.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}

      {/* ── Dialogs ── */}
      <AlloyDialog
        open={addEditOpen}
        onClose={() => setAddEditOpen(false)}
        onSave={handleSave}
        editAlloy={editAlloy}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth fullScreen={isMobile} slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3 } } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ p: 1, bgcolor: '#fef2f2', borderRadius: 1.5, display: 'flex' }}>
            <AlertTriangle size={18} color="#dc2626" />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Delete Alloy?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.6 }}>
            You are about to permanently delete{' '}
            <b style={{ color: '#1e293b' }}>{deleteConfirm?.alloyName}</b> ({deleteConfirm?.alloyCode}).
          </Typography>
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fecaca' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
              ⚠ This action cannot be undone. If this alloy is referenced in transactions, the delete will fail. Consider marking it as Inactive instead.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error" disabled={!!actionLoading} sx={{ borderRadius: 2, fontWeight: 600 }}>
            {actionLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Confirmation */}
      <Dialog open={!!statusConfirm} onClose={() => setStatusConfirm(null)} maxWidth="xs" fullWidth fullScreen={isMobile} slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3 } } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ p: 1, bgcolor: '#fef9c3', borderRadius: 1.5, display: 'flex' }}>
            <AlertTriangle size={18} color="#b45309" />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Change Alloy Status</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.6 }}>
            Change status of <b style={{ color: '#1e293b' }}>{statusConfirm?.alloy.alloyName}</b> to{' '}
            <b style={{ color: statusConfirm?.newStatus === 'Active' ? '#15803d' : '#b45309' }}>
              {statusConfirm?.newStatus}
            </b>?
          </Typography>
          {statusConfirm?.newStatus === 'Inactive' && (
            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef9c3', borderRadius: 1.5, border: '1px solid #fde68a' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>
                Inactive alloys cannot be selected in Heat Entry, Production, Cost Ledger, or Dispatch. Historical records remain unchanged.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setStatusConfirm(null)} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button
            onClick={handleStatusChange}
            variant="contained"
            disabled={!!actionLoading}
            sx={{
              borderRadius: 2, fontWeight: 600,
              bgcolor: statusConfirm?.newStatus === 'Active' ? '#15803d' : '#b45309',
              '&:hover': { bgcolor: statusConfirm?.newStatus === 'Active' ? '#166534' : '#92400e' },
            }}
          >
            {actionLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : `Set ${statusConfirm?.newStatus}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Header Cell Style for Compliance Table ────────────────────────────────
const compHeaderStyle = {
  fontSize: '0.6rem',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  bgcolor: '#f8fafc',
  borderBottom: '2px solid #e2e8f0',
  py: 1.25,
  px: 1,
  whiteSpace: 'nowrap' as const,
};

export default AlloyMasterPage;
