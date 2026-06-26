import { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Card, CardContent, Button,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Paper, IconButton, Chip, Tooltip,
    CircularProgress, Dialog, DialogTitle, DialogContent,
    DialogActions, Skeleton, TextField, FormControl,
    InputLabel, Select, MenuItem, useTheme, useMediaQuery,
} from '@mui/material';
import {
    Search, Plus, Edit, Trash2, RefreshCw, Download, ArrowUpDown,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import {
    fetchProductionLedger,
    addProductionEntry,
    updateProductionEntry,
    deleteProductionEntry,
} from '../services/productionLedger.service';
import type {
    ProductionLedgerEntry,
    ProductionLedgerFormData,
} from '../types/productionLedger.types';
import { useMaterials } from '../../../context/MaterialContext';
import ProductionEntryDialog from '../components/ProductionEntryDialog';
import { fetchFinishedGoods } from '../../finishedGoods/services/finishedGoods.service';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (ts: Timestamp | undefined) => {
    if (!ts) return '—';
    return ts.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const effColor = (eff: number, efficiencyStatus?: string) => {
    if (efficiencyStatus === 'Good' || efficiencyStatus?.toLowerCase() === 'good') {
        return { bg: '#e8f5e9', text: '#2e7d32' };
    }
    if (eff >= 90) return { bg: '#e8f5e9', text: '#2e7d32' };
    if (eff >= 75) return { bg: '#fff8e1', text: '#e65100' };
    return { bg: '#ffebee', text: '#c62828' };
};

// Sticky header cell style
const stickyHead = {
    fontWeight: 700,
    fontSize: '0.72rem',
    whiteSpace: 'nowrap' as const,
    background: '#f9fafb',
    py: 1.2,
    px: 1,
    borderBottom: '2px solid #e0e0e0',
};

const bodyCell = {
    fontSize: '0.78rem',
    py: 0.9,
    px: 1,
    whiteSpace: 'nowrap' as const,
};

// ─── component ─────────────────────────────────────────────────────────────────
const ProductionLedgerPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { getByModule, loading: materialsLoading } = useMaterials();
    const productionMaterials = getByModule('production');

    const [entries, setEntries] = useState<ProductionLedgerEntry[]>([]);
    const [approvedHeats, setApprovedHeats] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editEntry, setEditEntry] = useState<ProductionLedgerEntry | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProductionLedgerEntry | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Filter states
    const [filterHeatNo, setFilterHeatNo] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterAlloyType, setFilterAlloyType] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterRole, setFilterRole] = useState('');

    // Sorting states
    const [sortKey, setSortKey] = useState<string>('serialNo');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    // Combine loading states
    const isTableLoading = loading || materialsLoading;

    // Unique options for dropdown filters
    const alloyTypes = useMemo(() => {
        const set = new Set(entries.map((e) => e.alloyType).filter(Boolean));
        return Array.from(set).sort();
    }, [entries]);

    const employees = useMemo(() => {
        const set = new Set(entries.map((e) => e.employeeName || e.supervisorName).filter(Boolean));
        return Array.from(set).sort();
    }, [entries]);

    const roles = useMemo(() => {
        const set = new Set(entries.map((e) => e.role).filter(Boolean));
        return Array.from(set).sort();
    }, [entries]);

    // ── fetch ──
    const load = async () => {
        setLoading(true);
        try {
            const data = await fetchProductionLedger();
            setEntries(data);
            const fgData = await fetchFinishedGoods();
            const approved = new Set(
              fgData
                .filter((fg) => fg.manuallyApproved === true)
                .map((fg) => fg.heatNo)
            );
            setApprovedHeats(approved);
        } catch (err) {
            console.error("Failed to load production data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // ── filtered rows ──
    const filtered = useMemo(() => {
        const list = entries.filter((e) => {
            // 1. Heat No Filter
            if (filterHeatNo) {
                const hn = e.heatNo.toLowerCase();
                const q = filterHeatNo.toLowerCase();
                if (!hn.includes(q)) return false;
            }

            // 2. Date Filters
            if (e.date) {
                const itemDate = e.date.toDate();
                itemDate.setHours(0, 0, 0, 0);

                if (filterStartDate) {
                    const start = new Date(filterStartDate);
                    start.setHours(0, 0, 0, 0);
                    if (itemDate < start) return false;
                }

                if (filterEndDate) {
                    const end = new Date(filterEndDate);
                    end.setHours(0, 0, 0, 0);
                    if (itemDate > end) return false;
                }
            } else if (filterStartDate || filterEndDate) {
                return false;
            }

            // 3. Alloy Type Filter
            if (filterAlloyType) {
                if (e.alloyType !== filterAlloyType) return false;
            }

            // 4. Employee Filter
            if (filterEmployee) {
                const empName = e.employeeName || e.supervisorName || '';
                if (empName !== filterEmployee) return false;
            }

            // 5. Role Filter
            if (filterRole) {
                const r = e.role || '';
                if (r !== filterRole) return false;
            }

            return true;
        });

        list.sort((a, b) => {
            let av: any;
            let bv: any;

            if (sortKey.startsWith('material_')) {
                const code = sortKey.replace('material_', '');
                const matA = a.materials?.find((m) => m.materialCode === code || m.materialId === code);
                const matB = b.materials?.find((m) => m.materialCode === code || m.materialId === code);
                av = matA ? matA.weightKg : 0;
                bv = matB ? matB.weightKg : 0;
            } else if (sortKey === 'date') {
                av = a.date instanceof Timestamp ? a.date.seconds : 0;
                bv = b.date instanceof Timestamp ? b.date.seconds : 0;
            } else if (sortKey === 'efficiency') {
                av = a.actualEfficiencyPercentage ?? a.efficiencyPercentage ?? 0;
                bv = b.actualEfficiencyPercentage ?? b.efficiencyPercentage ?? 0;
            } else if (sortKey === 'pieces') {
                av = a.noOfPieces ?? a.totalPieces ?? 0;
                bv = b.noOfPieces ?? b.totalPieces ?? 0;
            } else {
                av = (a as any)[sortKey];
                bv = (b as any)[sortKey];
            }

            if (av === undefined || av === null) return 1;
            if (bv === undefined || bv === null) return -1;
            if (typeof av === 'string' && typeof bv === 'string') {
                return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }, [entries, filterHeatNo, filterStartDate, filterEndDate, filterAlloyType, filterEmployee, filterRole, sortKey, sortDir]);

    const hasActiveFilters = !!(
        filterHeatNo ||
        filterStartDate ||
        filterEndDate ||
        filterAlloyType ||
        filterEmployee ||
        filterRole
    );

    // ── save (add / edit) ──
    const handleSave = async (form: ProductionLedgerFormData) => {
        if (approvedHeats.has(form.heatNo.trim())) {
            alert(`Heat ${form.heatNo} is already approved to Finished Goods and cannot be modified.`);
            return;
        }
        if (editEntry) {
            await updateProductionEntry(editEntry.id, form);
        } else {
            const nextSerial = entries.length > 0
                ? Math.max(...entries.map((e) => e.serialNo)) + 1
                : 1;
            await addProductionEntry(form, nextSerial);
        }
        await load();
    };

    // ── delete ──
    const handleDelete = async () => {
        if (!deleteTarget) return;
        if (approvedHeats.has(deleteTarget.heatNo)) {
            alert(`Heat ${deleteTarget.heatNo} is already approved to Finished Goods and cannot be deleted.`);
            return;
        }
        setDeleting(true);
        try {
            await deleteProductionEntry(deleteTarget.id);
            setDeleteTarget(null);
            await load();
        } finally {
            setDeleting(false);
        }
    };

    const openAdd = () => { setEditEntry(null); setDialogOpen(true); };
    const openEdit = (e: ProductionLedgerEntry) => { setEditEntry(e); setDialogOpen(true); };

    // ── summary cards ──
    const totalEntries = entries.length;
    const avgEff = entries.length
        ? (entries.reduce((s, e) => s + e.efficiencyPercentage, 0) / entries.length).toFixed(2)
        : '0.00';
    const totalGood = entries.reduce((s, e) => s + e.goodIngots, 0).toLocaleString();

    return (
        <Box>
            {/* ── Page header ── */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>Production Ledger</Typography>
                    <Typography variant="body1" color="text.secondary">
                        Digital register for all production heats and material inputs.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' }, flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'stretch' }}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
                        <Tooltip title="Refresh">
                            <IconButton onClick={load} disabled={loading}>
                                <RefreshCw size={18} className={loading ? 'spin' : ''} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Button variant="outlined" startIcon={<Download size={16} />} sx={{ width: { xs: '100%', sm: 'auto' } }}>Export</Button>
                    <Button
                        variant="contained"
                        startIcon={<Plus size={16} />}
                        onClick={openAdd}
                        sx={{ background: 'linear-gradient(135deg, #1565C0, #1976d2)', fontWeight: 600, width: { xs: '100%', sm: 'auto' } }}
                    >
                        Add Entry
                    </Button>
                </Box>
            </Box>

            {/* ── Summary KPIs ── */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total Heats', value: totalEntries, color: '#1565C0', bg: '#e3f2fd' },
                    { label: 'Avg Efficiency', value: `${avgEff}%`, color: '#2e7d32', bg: '#e8f5e9' },
                    { label: 'Total Good Ingots', value: `${totalGood} Kg`, color: '#e65100', bg: '#fff3e0' },
                ].map((k) => (
                    <Card key={k.label} sx={{ flex: { xs: '1 1 100%', sm: '1 1 160px' }, borderRadius: 2, border: `1px solid ${k.bg}` }}>
                        <CardContent sx={{ py: '12px !important', px: 2 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
                                {k.label.toUpperCase()}
                            </Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: k.color, lineHeight: 1.2 }}>
                                {k.value}
                            </Typography>
                        </CardContent>
                    </Card>
                ))}
            </Box>

            {/* ── Filter & Search Registry ── */}
            <Card sx={{ mb: 3, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Search size={16} style={{ color: '#1565C0' }} />
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                Filter & Search Registry
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {hasActiveFilters && (
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setFilterHeatNo('');
                                        setFilterStartDate('');
                                        setFilterEndDate('');
                                        setFilterAlloyType('');
                                        setFilterEmployee('');
                                        setFilterRole('');
                                    }}
                                    sx={{ fontSize: '0.7rem', textTransform: 'none', fontWeight: 700 }}
                                    color="error"
                                >
                                    Clear Filters
                                </Button>
                            )}
                            <Chip
                                label={`${filtered.length} records`}
                                size="small"
                                sx={{ background: '#e3f2fd', color: '#1565C0', fontWeight: 700, fontSize: '0.7rem' }}
                            />
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                        {/* Heat No Search */}
                        <TextField
                            size="small"
                            placeholder="Search Heat Number"
                            value={filterHeatNo}
                            onChange={(e) => setFilterHeatNo(e.target.value)}
                            sx={{
                                flex: { xs: '1 1 100%', sm: '1 1 180px' },
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                    backgroundColor: '#fff',
                                    fontSize: '0.8rem',
                                }
                            }}
                        />

                        {/* Start Date */}
                        <TextField
                            size="small"
                            label="Start Date"
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            slotProps={{
                                inputLabel: { shrink: true },
                                input: {
                                    style: { background: 'white' },
                                    onClick: (e) => {
                                        try {
                                            (e.target as any).showPicker?.();
                                        } catch (err) {}
                                    }
                                }
                            }}
                            sx={{
                                flex: { xs: '1 1 100%', sm: '1 1 140px' },
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                    backgroundColor: '#fff',
                                    fontSize: '0.8rem',
                                }
                            }}
                        />

                        {/* End Date */}
                        <TextField
                            size="small"
                            label="End Date"
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            slotProps={{
                                inputLabel: { shrink: true },
                                input: {
                                    style: { background: 'white' },
                                    onClick: (e) => {
                                        try {
                                            (e.target as any).showPicker?.();
                                        } catch (err) {}
                                    }
                                }
                            }}
                            sx={{
                                flex: { xs: '1 1 100%', sm: '1 1 140px' },
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                    backgroundColor: '#fff',
                                    fontSize: '0.8rem',
                                }
                            }}
                        />

                        {/* Alloy Type */}
                        <FormControl size="small" sx={{ flex: { xs: '1 1 100%', sm: '1 1 140px' } }}>
                            <InputLabel id="alloy-type-label" sx={{ fontSize: '0.8rem' }}>Alloy Type</InputLabel>
                            <Select
                                labelId="alloy-type-label"
                                value={filterAlloyType}
                                label="Alloy Type"
                                onChange={(e) => setFilterAlloyType(e.target.value)}
                                sx={{
                                    borderRadius: 2,
                                    backgroundColor: '#fff',
                                    fontSize: '0.8rem',
                                }}
                            >
                                <MenuItem value="" sx={{ fontSize: '0.8rem' }}><em>All Alloy Types</em></MenuItem>
                                {alloyTypes.map((t) => (
                                    <MenuItem key={t} value={t} sx={{ fontSize: '0.8rem' }}>{t}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Employee */}
                        <FormControl size="small" sx={{ flex: { xs: '1 1 100%', sm: '1 1 140px' } }}>
                            <InputLabel id="employee-label" sx={{ fontSize: '0.8rem' }}>Employee</InputLabel>
                            <Select
                                labelId="employee-label"
                                value={filterEmployee}
                                label="Employee"
                                onChange={(e) => setFilterEmployee(e.target.value)}
                                sx={{
                                    borderRadius: 2,
                                    backgroundColor: '#fff',
                                    fontSize: '0.8rem',
                                }}
                            >
                                <MenuItem value="" sx={{ fontSize: '0.8rem' }}><em>All Employees</em></MenuItem>
                                {employees.map((emp) => (
                                    <MenuItem key={emp} value={emp} sx={{ fontSize: '0.8rem' }}>{emp}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Role */}
                        <FormControl size="small" sx={{ flex: { xs: '1 1 100%', sm: '1 1 140px' } }}>
                            <InputLabel id="role-label" sx={{ fontSize: '0.8rem' }}>Role</InputLabel>
                            <Select
                                labelId="role-label"
                                value={filterRole}
                                label="Role"
                                onChange={(e) => setFilterRole(e.target.value)}
                                sx={{
                                    borderRadius: 2,
                                    backgroundColor: '#fff',
                                    fontSize: '0.8rem',
                                }}
                            >
                                <MenuItem value="" sx={{ fontSize: '0.8rem' }}><em>All Roles</em></MenuItem>
                                {roles.map((r) => (
                                    <MenuItem key={r} value={r} sx={{ fontSize: '0.8rem' }}>{r}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </CardContent>
            </Card>

            {/* ── Table ── */}
            <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 'calc(100vh - 380px)', overflowX: 'auto' }}>
                    <Table stickyHeader size="small" aria-label="production ledger table">
                        <TableHead>
                            <TableRow>
                                {/* Fixed columns */}
                                <TableCell
                                    sx={{ ...stickyHead, minWidth: 55, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('serialNo')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        SI No
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'serialNo' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'serialNo' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    sx={{ ...stickyHead, minWidth: 110, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('heatNo')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        Heat No
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'heatNo' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'heatNo' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    sx={{ ...stickyHead, minWidth: 100, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('date')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        Date
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'date' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'date' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    sx={{ ...stickyHead, minWidth: 90, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('alloyType')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        Alloy Type
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'alloyType' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'alloyType' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    sx={{ ...stickyHead, minWidth: 85, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('furnaceNo')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        Furnace No
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'furnaceNo' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'furnaceNo' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    sx={{ ...stickyHead, minWidth: 120, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('operatorName')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        Operator
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'operatorName' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'operatorName' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    sx={{ ...stickyHead, minWidth: 130, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('shiftStartTime')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        Shift
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'shiftStartTime' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'shiftStartTime' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                {/* Material columns */}
                                {productionMaterials.map((f) => {
                                    const mKey = `material_${f.materialCode}`;
                                    return (
                                        <TableCell
                                            key={f.id}
                                            align="right"
                                            sx={{ ...stickyHead, minWidth: 68, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                            onClick={() => handleSort(mKey)}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                                <Tooltip title={f.materialName} arrow>
                                                    <span>{f.materialCode}</span>
                                                </Tooltip>
                                                <ArrowUpDown size={10} style={{ color: sortKey === mKey ? '#1565C0' : '#94a3b8', opacity: sortKey === mKey ? 1 : 0.4 }} />
                                            </Box>
                                        </TableCell>
                                    );
                                })}
                                {/* Calculated columns */}
                                <TableCell
                                    align="right"
                                    sx={{ ...stickyHead, minWidth: 80, color: '#1565C0', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('totalInput')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                        Input
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'totalInput' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'totalInput' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{ ...stickyHead, minWidth: 90, color: '#2e7d32', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('goodIngots')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                        Good Ingots
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'goodIngots' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'goodIngots' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{ ...stickyHead, minWidth: 80, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('pieces')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                        Pieces
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'pieces' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'pieces' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{ ...stickyHead, minWidth: 85, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    onClick={() => handleSort('efficiency')}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                        Actual Eff. %
                                        <ArrowUpDown size={10} style={{ color: sortKey === 'efficiency' ? '#1565C0' : '#94a3b8', opacity: sortKey === 'efficiency' ? 1 : 0.4 }} />
                                    </Box>
                                </TableCell>
                                <TableCell align="center" sx={{ ...stickyHead, minWidth: 80 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {isTableLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 + productionMaterials.length + 5 }).map((__, j) => (
                                            <TableCell key={j} sx={bodyCell}>
                                                <Skeleton variant="text" width={50} height={16} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7 + productionMaterials.length + 5} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                            {hasActiveFilters ? 'No entries match your search.' : 'No production entries yet. Click "Add Entry" to begin.'}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((row, idx) => {
                                    const effVal = row.actualEfficiencyPercentage ?? row.efficiencyPercentage ?? 0;
                                    const eff = effColor(effVal, row.efficiencyStatus);
                                    return (
                                        <TableRow
                                            key={row.id}
                                            sx={{
                                                '&:last-child td': { border: 0 },
                                                '&:hover': { background: '#f5f7ff' },
                                                background: idx % 2 === 0 ? '#fff' : '#fafafa',
                                            }}
                                        >
                                            <TableCell sx={{ ...bodyCell, fontWeight: 600, color: 'text.secondary' }}>
                                                {idx + 1}
                                            </TableCell>
                                            <TableCell sx={{ ...bodyCell, fontWeight: 700, color: 'primary.main' }}>
                                                {row.heatNo}
                                            </TableCell>
                                            <TableCell sx={bodyCell}>{fmtDate(row.date)}</TableCell>
                                            <TableCell sx={bodyCell}>
                                                <Chip
                                                    label={row.alloyType}
                                                    size="small"
                                                    sx={{ background: '#e3f2fd', color: '#1565C0', fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ ...bodyCell, fontWeight: 650, color: 'text.primary' }}>
                                                {row.furnaceNo || '—'}
                                            </TableCell>
                                            <TableCell sx={bodyCell}>{row.operatorName || '—'}</TableCell>
                                            <TableCell sx={{ ...bodyCell, fontStyle: 'italic', color: 'text.secondary' }}>
                                                {row.shiftStartTime ? `${row.shiftStartTime} ${row.shiftStartPeriod} - ${row.shiftEndTime} ${row.shiftEndPeriod}` : '—'}
                                            </TableCell>

                                            {/* Material values */}
                                            {productionMaterials.map((f) => {
                                                const matEntry = row.materials?.find(
                                                    (m) =>
                                                        m.materialId === f.materialId ||
                                                        m.materialId === f.id ||
                                                        m.materialCode === f.materialCode
                                                );
                                                const val = matEntry ? matEntry.weightKg : 0;
                                                return (
                                                    <TableCell key={f.id} align="right" sx={bodyCell}>
                                                        {val > 0 ? val.toLocaleString() : (
                                                            <span style={{ color: '#ccc' }}>—</span>
                                                        )}
                                                    </TableCell>
                                                );
                                            })}

                                            {/* Calculated */}
                                            <TableCell align="right" sx={{ ...bodyCell, fontWeight: 700, color: '#1565C0' }}>
                                                {row.totalInput.toLocaleString()}
                                            </TableCell>
                                            <TableCell align="right" sx={{ ...bodyCell, fontWeight: 700, color: '#2e7d32' }}>
                                                {row.goodIngots.toLocaleString()}
                                            </TableCell>
                                            <TableCell align="right" sx={{ ...bodyCell, fontWeight: 600 }}>
                                                {row.noOfPieces !== undefined ? row.noOfPieces.toLocaleString() : (row.totalPieces !== undefined ? row.totalPieces.toLocaleString() : '—')}
                                            </TableCell>
                                            <TableCell align="right" sx={bodyCell}>
                                                <Chip
                                                    label={`${effVal.toFixed(2)}%`}
                                                    size="small"
                                                    sx={{ background: eff.bg, color: eff.text, fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                                                />
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell align="center" sx={bodyCell}>
                                                {approvedHeats.has(row.heatNo) ? (
                                                    <Chip
                                                        label="Approved & Locked"
                                                        size="small"
                                                        variant="outlined"
                                                        color="success"
                                                        sx={{ 
                                                            fontWeight: 600, 
                                                            fontSize: '0.65rem', 
                                                            height: 20,
                                                            borderColor: 'success.light',
                                                            color: 'success.dark',
                                                            bgcolor: '#e8f5e9'
                                                        }}
                                                    />
                                                ) : (
                                                    <>
                                                        <Tooltip title="Edit">
                                                            <IconButton size="small" color="primary" onClick={() => openEdit(row)}>
                                                                <Edit size={15} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Delete">
                                                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(row)}>
                                                                <Trash2 size={15} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* ── Add / Edit Dialog ── */}
            <ProductionEntryDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSave={handleSave}
                editEntry={editEntry}
            />

            {/* ── Delete Confirm Dialog ── */}
            <Dialog 
                open={!!deleteTarget} 
                onClose={() => setDeleteTarget(null)} 
                maxWidth="xs" 
                fullWidth
                fullScreen={isMobile}
                slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3 } } }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>Delete Entry</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete heat{' '}
                        <strong>{deleteTarget?.heatNo}</strong>? This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <Button onClick={() => setDeleteTarget(null)} variant="outlined" disabled={deleting}>
                        Cancel
                    </Button>
                    <Button onClick={handleDelete} variant="contained" color="error" disabled={deleting}>
                        {deleting ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ProductionLedgerPage;
