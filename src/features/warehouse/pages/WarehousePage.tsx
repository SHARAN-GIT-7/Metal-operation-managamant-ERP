import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, IconButton,
  Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Skeleton, Chip,
  LinearProgress, useTheme, useMediaQuery,
} from '@mui/material';
import {
  Warehouse, Package, AlertTriangle, TrendingDown, RefreshCw,
  Search, Trash2, X, CheckCircle2, ArrowUpDown, ChevronLeft,
  ChevronRight, Eye, IndianRupee, Maximize2, Minimize2,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import {
  fetchInventory,
  fetchMaterialReceipts,
  deleteMaterialReceipt,
} from '../services/warehouse.service';
import type { InventoryItem, MaterialReceipt, StockStatus } from '../types/warehouse.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (ts: Timestamp | null | undefined) => {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const fmtNum = (v: number | undefined | null, decimals = 1) => {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtMoney = (v: number | undefined | null) => {
  if (v === undefined || v === null || v === 0) return '—';
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getStatusConfig = (status: StockStatus) => {
  switch (status) {
    case 'Healthy':
      return { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', barColor: '#22c55e', label: 'Healthy' };
    case 'Low Stock':
      return { color: '#d97706', bg: '#fffbeb', border: '#fde68a', barColor: '#f59e0b', label: 'Low Stock' };
    case 'Critical Stock':
      return { color: '#dc2626', bg: '#fff5f5', border: '#fecaca', barColor: '#ef4444', label: 'Critical' };
    case 'Out Of Stock':
      return { color: '#991b1b', bg: '#fff1f2', border: '#fecdd3', barColor: '#f43f5e', label: 'Out Of Stock' };
    default:
      return { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', barColor: '#9ca3af', label: status };
  }
};

const computeStatus = (current: number, minimum: number): StockStatus => {
  if (current <= 0) return 'Out Of Stock';
  if (current < minimum * 0.5) return 'Critical Stock';
  if (current < minimum) return 'Low Stock';
  return 'Healthy';
};

const getStockBarPercent = (current: number, minimum: number) => {
  if (minimum <= 0) return 100;
  const ratio = current / (minimum * 2); // 200% of min = full bar
  return Math.min(Math.max(ratio * 100, 0), 100);
};

// ─── Inventory Overview Cards ─────────────────────────────────────────────────
interface OverviewProps {
  inventory: InventoryItem[];
  receipts: MaterialReceipt[];
}

const InventoryOverview = ({ inventory, receipts }: OverviewProps) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalStock = inventory.reduce((s, i) => s + (i.currentStockKg || 0), 0);
  const lowStockCount = inventory.filter(i => {
    const s = computeStatus(i.currentStockKg, i.minimumStockKg);
    return s === 'Low Stock' || s === 'Critical Stock' || s === 'Out Of Stock';
  }).length;
  const receivedToday = receipts.filter(r => {
    if (!r.dateReceived) return false;
    const d = r.dateReceived.toDate();
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;
  const totalValue = inventory.reduce((s, i) => s + ((i.currentStockKg || 0) * (i.averageCost || 0)), 0);
  const healthyCount = inventory.filter(i => computeStatus(i.currentStockKg, i.minimumStockKg) === 'Healthy').length;

  const kpis = [
    {
      icon: <Warehouse size={22} />,
      label: 'Total Stock',
      sublabel: 'Inventory',
      value: `${fmtNum(totalStock, 1)} kg`,
      color: '#2563eb',
      iconBg: '#eff6ff',
      tagBg: '#dbeafe',
      tagColor: '#1d4ed8',
    },
    {
      icon: <AlertTriangle size={22} />,
      label: 'Low Stock',
      sublabel: 'Materials',
      value: String(lowStockCount),
      color: '#dc2626',
      iconBg: '#fff1f2',
      tagBg: '#fee2e2',
      tagColor: '#991b1b',
    },
    {
      icon: <CheckCircle2 size={22} />,
      label: 'Healthy Stock',
      sublabel: 'Materials',
      value: String(healthyCount),
      color: '#16a34a',
      iconBg: '#f0fdf4',
      tagBg: '#dcfce7',
      tagColor: '#15803d',
    },
    {
      icon: <TrendingDown size={22} />,
      label: 'Received Today',
      sublabel: 'Materials',
      value: String(receivedToday),
      color: '#7c3aed',
      iconBg: '#faf5ff',
      tagBg: '#ede9fe',
      tagColor: '#6d28d9',
    },
    {
      icon: <IndianRupee size={22} />,
      label: 'Inventory Value',
      sublabel: 'Inventory',
      value: totalValue > 0 ? '₹' + (totalValue / 100000).toFixed(2) + 'L' : '₹0',
      color: '#0891b2',
      iconBg: '#ecfeff',
      tagBg: '#cffafe',
      tagColor: '#0e7490',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {kpis.map((k, idx) => (
        <Card key={idx} sx={{
          border: '1px solid #f1f5f9',
          borderRadius: 3,
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          transition: 'box-shadow 0.2s',
          '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
        }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: 2.5,
                backgroundColor: k.iconBg, display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: k.color, flexShrink: 0,
              }}>
                {k.icon}
              </Box>
              <Box sx={{
                px: 1.5, py: 0.4, borderRadius: 20, fontSize: '0.6rem',
                fontWeight: 700, backgroundColor: k.tagBg, color: k.tagColor,
                letterSpacing: 0.3,
              }}>
                {k.sublabel}
              </Box>
            </Box>
            <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: k.color, mt: 1.5, lineHeight: 1 }}>
              {k.value}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, mt: 0.5 }}>
              {k.label}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ─── Material Stock Cards ─────────────────────────────────────────────────────
interface StockCardsProps {
  inventory: InventoryItem[];
  loading: boolean;
  searchTerm: string;
}

const MaterialStockCards = ({ inventory, loading, searchTerm }: StockCardsProps) => {
  const filtered = useMemo(() =>
    inventory.filter(i =>
      !searchTerm ||
      i.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.materialCode.toLowerCase().includes(searchTerm.toLowerCase())
    ), [inventory, searchTerm]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} sx={{ border: '1px solid #f1f5f9', borderRadius: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Skeleton width="60%" height={24} />
              <Skeleton width="40%" height={18} sx={{ mt: 1 }} />
              <Skeleton width="100%" height={8} sx={{ mt: 2, borderRadius: 4 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Skeleton width="30%" height={16} />
                <Skeleton width="30%" height={16} />
                <Skeleton width="30%" height={16} />
              </Box>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {filtered.map(item => {
        const status = computeStatus(item.currentStockKg, item.minimumStockKg);
        const cfg = getStatusConfig(status);
        const barPct = getStockBarPercent(item.currentStockKg, item.minimumStockKg);

        return (
          <Card key={item.id} sx={{
            border: `1px solid ${cfg.border}`,
            borderRadius: 1.5,
            backgroundColor: cfg.bg,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'all 0.2s',
            '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.09)', transform: 'translateY(-1px)' },
          }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    px: 1.2, py: 0.3, borderRadius: 1.5, fontSize: '0.65rem',
                    fontWeight: 800, backgroundColor: '#e0e7ff', color: '#3730a3',
                    letterSpacing: 0.5, whiteSpace: 'nowrap',
                  }}>
                    {item.materialCode}
                  </Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                    {item.materialName}
                  </Typography>
                </Box>
                <Box sx={{
                  px: 1.5, py: 0.4, borderRadius: 20, fontSize: '0.6rem',
                  fontWeight: 700, backgroundColor: cfg.color + '18', color: cfg.color,
                  whiteSpace: 'nowrap',
                }}>
                  {cfg.label}
                </Box>
              </Box>

              {/* Stock progress bar */}
              <Box sx={{ mb: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={barPct}
                  sx={{
                    height: 6, borderRadius: 3,
                    backgroundColor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: cfg.barColor,
                      borderRadius: 3,
                    },
                  }}
                />
              </Box>

              {/* Stats row */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Current Stock
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: cfg.color, mt: 0.2 }}>
                    {fmtNum(item.currentStockKg, 1)} kg
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Min. Stock
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', mt: 0.2 }}>
                    {fmtNum(item.minimumStockKg, 0)} kg
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Avg. Cost
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', mt: 0.2 }}>
                    {item.averageCost > 0 ? fmtMoney(item.averageCost) : '—'}
                  </Typography>
                </Box>
              </Box>

              {/* Last received */}
              <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', mt: 1.5 }}>
                Last received: <span style={{ color: '#64748b', fontWeight: 600 }}>{fmtDate(item.lastReceiptDate)}</span>
              </Typography>
            </CardContent>
          </Card>
        );
      })}
      {filtered.length === 0 && (
        <Box sx={{ gridColumn: '1/-1', py: 6, textAlign: 'center', color: '#94a3b8' }}>
          <Package size={40} style={{ marginBottom: 8, opacity: 0.4 }} />
          <Typography sx={{ fontWeight: 600 }}>No materials match your search</Typography>
        </Box>
      )}
    </div>
  );
};

// ─── Receipt Detail Dialog ────────────────────────────────────────────────────
interface ReceiptDetailDialogProps {
  receipt: MaterialReceipt | null;
  onClose: () => void;
}

const ReceiptDetailDialog = ({ receipt, onClose }: ReceiptDetailDialogProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!receipt) return null;
  return (
    <Dialog open={!!receipt} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}
      slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3 } } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Eye size={20} style={{ color: '#2563eb' }} />
        Receipt Detail — {receipt.receiptNumber}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
          {[
            { label: 'Receipt No', value: receipt.receiptNumber },
            { label: 'Vendor', value: receipt.vendorName },
            { label: 'Date Received', value: fmtDate(receipt.dateReceived) },
            { label: 'Created By', value: receipt.createdBy },
          ].map(f => (
            <Box key={f.label} sx={{ p: 1.5, backgroundColor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {f.label}
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', mt: 0.3 }}>
                {f.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1.5 }}>
          Materials Received
        </Typography>

        <Box sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                {['Material', 'Code', 'Received (kg)', 'Returned (kg)', 'Net Intake (kg)', 'Cost/Kg (₹)', 'Efficiency %', 'Remarks'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.7rem', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #e2e8f0' }}>
                    {h === 'Material' || h === 'Code' || h === 'Remarks' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receipt.materials.map((m, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{m.materialName}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.68rem' }}>
                      {m.materialCode}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtNum(m.receivedWeightKg)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{fmtNum(m.returnedWeightKg)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{fmtNum(m.netIntakeWeightKg)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(m.costPerKg)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{m.efficiencyPercentage}%</td>
                  <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: '0.75rem' }}>{m.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#1e293b' }}>
                <td colSpan={2} style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  TOTALS
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#93c5fd', fontWeight: 800 }}>{fmtNum(receipt.totalReceivedWeightKg)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fca5a5', fontWeight: 800 }}>{fmtNum(receipt.totalReturnedWeightKg)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#86efac', fontWeight: 800 }}>{fmtNum(receipt.totalNetIntakeWeightKg)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const WarehousePage = ({ readOnly = false }: { readOnly?: boolean }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const gridBorder = isDark ? '1px solid #4a5568' : '1px solid #cbd5e1';
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tableMaximized, setTableMaximized] = useState(false);
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockSearch, setStockSearch] = useState('');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [viewReceipt, setViewReceipt] = useState<MaterialReceipt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialReceipt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'receipts'>('overview');

  // Pagination for receipts
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'dateReceived', direction: 'desc' });
  const [hoveredReceiptId, setHoveredReceiptId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inv, rec] = await Promise.all([fetchInventory(), fetchMaterialReceipts()]);
      setInventory(inv);
      setReceipts(rec);
    } catch (err) {
      console.error('Warehouse load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Filtered & sorted receipts
  const filteredReceipts = useMemo(() => {
    let data = receipts.filter(r => {
      if (!receiptSearch) return true;
      const s = receiptSearch.toLowerCase();
      return (
        r.receiptNumber?.toLowerCase().includes(s) ||
        r.vendorName?.toLowerCase().includes(s) ||
        r.createdBy?.toLowerCase().includes(s) ||
        r.materials?.some(m => m.materialName.toLowerCase().includes(s) || m.materialCode.toLowerCase().includes(s))
      );
    });

    data = [...data].sort((a, b) => {
      let aVal: any = (a as any)[sortConfig.key];
      let bVal: any = (b as any)[sortConfig.key];
      if (sortConfig.key === 'dateReceived') {
        aVal = a.dateReceived?.seconds ?? 0;
        bVal = b.dateReceived?.seconds ?? 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [receipts, receiptSearch, sortConfig]);

  const paginatedReceipts = useMemo(() => {
    const offset = (currentPage - 1) * pageSize;
    return filteredReceipts.slice(offset, offset + pageSize);
  }, [filteredReceipts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredReceipts.length / pageSize) || 1;

  const requestSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMaterialReceipt(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // Compute status-enriched inventory
  const enrichedInventory = useMemo(() => inventory.map(item => ({
    ...item,
    status: computeStatus(item.currentStockKg, item.minimumStockKg),
  })), [inventory]);

  return (
    <Box className="space-y-6 text-slate-800 antialiased">
      <style>{`
        .wh-grid-table th,
        .wh-grid-table td {
          border-bottom: 1px solid ${isDark ? '#4a5568' : '#cbd5e1'} !important;
          border-right: 1px solid ${isDark ? '#4a5568' : '#cbd5e1'} !important;
        }
        .wh-grid-table th:last-child,
        .wh-grid-table td:last-child {
          border-right: none !important;
        }
      `}</style>

      {/* ── Page Header ── */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ p: 1, backgroundColor: '#eff6ff', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Warehouse size={22} style={{ color: '#2563eb' }} />
            </Box>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', letterSpacing: -0.5 }}>
              Warehouse Management
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, ml: 0.5 }}>
            Raw material inventory · Inward receipts · Stock monitoring
          </Typography>
        </Box>
        <Tooltip title="Refresh Data">
          <IconButton onClick={loadData} disabled={loading} sx={{
            border: '1px solid #e2e8f0', backgroundColor: '#fff', borderRadius: 2,
            '&:hover': { backgroundColor: '#f8fafc' },
            alignSelf: { xs: 'flex-start', sm: 'auto' }
          }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} style={{ color: '#64748b' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Inventory Overview KPIs ── */}
      <InventoryOverview inventory={enrichedInventory} receipts={receipts} />

      {/* ── Tab Toggle ── */}
      <Box sx={{ display: 'flex', gap: 1.5, borderBottom: '1px solid #e2e8f0', pb: 0, flexWrap: 'wrap' }}>
        {([
          { key: 'overview', label: 'Stock Overview', icon: <Package size={15} /> },
          { key: 'receipts', label: 'Inward Receipts', icon: <TrendingDown size={15} /> },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: '0.82rem',
              color: activeTab === tab.key ? '#2563eb' : '#64748b',
              borderBottom: activeTab === tab.key ? '2.5px solid #2563eb' : '2.5px solid transparent',
              background: 'none', border: 'none',
              cursor: 'pointer', transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </Box>

      {/* ── STOCK OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Search */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, gap: 1.5 }}>
            <Box sx={{ position: 'relative', flex: 1, maxWidth: { xs: '100%', sm: 320 }, width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                placeholder="Search materials..."
                style={{
                  width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.82rem', outline: 'none',
                  color: '#1e293b', background: '#fff',
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(['Healthy', 'Low Stock', 'Critical Stock', 'Out Of Stock'] as StockStatus[]).map(s => {
                const cfg = getStatusConfig(s);
                const count = enrichedInventory.filter(i => i.status === s).length;
                return (
                  <Chip
                    key={s}
                    label={`${s}: ${count}`}
                    size="small"
                    sx={{
                      fontSize: '0.68rem', fontWeight: 700,
                      backgroundColor: cfg.bg, color: cfg.color,
                      border: `1px solid ${cfg.border}`,
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          <MaterialStockCards inventory={enrichedInventory} loading={loading} searchTerm={stockSearch} />
        </Box>
      )}

      {/* ── INWARD RECEIPTS TAB ── */}
      {activeTab === 'receipts' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Search */}
          <Box sx={{ position: 'relative', maxWidth: { xs: '100%', sm: 360 }, width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={receiptSearch}
              onChange={e => { setReceiptSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by receipt no, vendor, material..."
              style={{
                width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
                border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.82rem', outline: 'none',
                color: '#1e293b', background: '#fff',
              }}
            />
          </Box>

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

          <Box sx={{
            border: '1px solid',
            borderColor: isDark ? '#2d3748' : '#e2e8f0',
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: isDark ? 'background.paper' : '#fff',
            boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.04)',
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
            })
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderBottom: isDark ? '1px solid #2d3748' : '1px solid #e2e8f0', bgcolor: isDark ? '#1a2130' : '#f8fafc' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {tableMaximized ? 'Inward Receipts (Expanded View)' : 'Inward Receipts'}
              </Typography>
              <Tooltip title={tableMaximized ? "Close / Minimize" : "Maximize Table"}>
                <IconButton size="small" onClick={() => setTableMaximized(!tableMaximized)} sx={{ color: 'text.secondary' }}>
                  {tableMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ overflowX: 'auto', maxHeight: tableMaximized ? 'calc(90vh - 120px)' : 580 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }} className="wh-grid-table">
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th rowSpan={2} onClick={() => requestSort('siNo')} style={{
                      padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                      borderRight: '1px solid #e2e8f0'
                    }}>
                      SI No
                    </th>
                    <th rowSpan={2} onClick={() => requestSort('receiptNumber')} style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #e2e8f0'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Receipt No
                        <ArrowUpDown size={10} style={{ opacity: 0.5 }} />
                      </span>
                    </th>
                    <th rowSpan={2} onClick={() => requestSort('vendorName')} style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #e2e8f0'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Vendor
                        <ArrowUpDown size={10} style={{ opacity: 0.5 }} />
                      </span>
                    </th>
                    <th rowSpan={2} onClick={() => requestSort('dateReceived')} style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #e2e8f0'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Date Received
                        <ArrowUpDown size={10} style={{ opacity: 0.5 }} />
                      </span>
                    </th>
                    <th colSpan={5} style={{
                      padding: '6px 14px', textAlign: 'center', fontWeight: 800, color: '#1e40af', backgroundColor: '#eff6ff', fontSize: '0.7rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid #bfdbfe',
                      borderRight: '1px solid #e2e8f0'
                    }}>
                      Materials
                    </th>
                    <th rowSpan={2} onClick={() => requestSort('totalReceivedWeightKg')} style={{
                      padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #e2e8f0'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        Total Received (kg)
                        <ArrowUpDown size={10} style={{ opacity: 0.5 }} />
                      </span>
                    </th>
                    <th rowSpan={2} onClick={() => requestSort('totalReturnedWeightKg')} style={{
                      padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #e2e8f0'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        Total Returned (kg)
                        <ArrowUpDown size={10} style={{ opacity: 0.5 }} />
                      </span>
                    </th>
                    <th rowSpan={2} onClick={() => requestSort('totalNetIntakeWeightKg')} style={{
                      padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #e2e8f0'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        Net Intake (kg)
                        <ArrowUpDown size={10} style={{ opacity: 0.5 }} />
                      </span>
                    </th>
                    <th rowSpan={2} onClick={() => requestSort('createdBy')} style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer', userSelect: 'none', borderRight: '1px solid #e2e8f0'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Created By
                        <ArrowUpDown size={10} style={{ opacity: 0.5 }} />
                      </span>
                    </th>
                    <th rowSpan={2} style={{
                      padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '0.68rem',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0'
                    }}>
                      Actions
                    </th>
                  </tr>
                  <tr style={{ backgroundColor: '#f8fafc', position: 'sticky', top: '34px', zIndex: 10 }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Material Code</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>QTY(kg)</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Rate</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Amount</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.62rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textTransform: 'uppercase' }}>Efficiency %</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 14 }).map((__, j) => (
                          <td key={j} style={{ padding: '10px 14px' }}><Skeleton height={16} /></td>
                        ))}
                      </tr>
                    ))
                  ) : paginatedReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={14} style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8' }}>
                        <Package size={36} style={{ marginBottom: 8, opacity: 0.4, margin: '0 auto 8px' }} />
                        <div style={{ fontWeight: 600 }}>
                          {receiptSearch ? 'No receipts match your search.' : 'No inward receipts found. Receipts are created from the mobile app.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedReceipts.flatMap((r, idx) => {
                      const isEven = idx % 2 === 0;
                      const activeMs = r.materials?.filter(m => (m.netIntakeWeightKg ?? 0) > 0 || (m.costPerKg ?? 0) > 0) || [];
                      const isHovered = hoveredReceiptId === r.id;

                      if (activeMs.length === 0) {
                        return (
                          <tr key={r.id}
                            style={{
                              backgroundColor: isHovered ? '#eff6ff' : (isEven ? '#fff' : '#f8fafc'),
                              transition: 'background 0.1s'
                            }}
                            onMouseEnter={() => setHoveredReceiptId(r.id)}
                            onMouseLeave={() => setHoveredReceiptId(null)}
                          >
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                              {(currentPage - 1) * pageSize + idx + 1}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#2563eb', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                              {r.receiptNumber}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                              {r.vendorName}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                              {fmtDate(r.dateReceived)}
                            </td>
                            {/* Materials Split Columns (Empty) */}
                            <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'center', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>—</td>
                            <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>—</td>
                            <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>—</td>
                            <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>—</td>
                            <td style={{ padding: '10px 14px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>—</td>

                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                              {fmtNum(r.totalReceivedWeightKg)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#dc2626', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                              {fmtNum(r.totalReturnedWeightKg)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16a34a', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                              {fmtNum(r.totalNetIntakeWeightKg)}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: 500, borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                              {r.createdBy}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                <Tooltip title="View Receipt Detail">
                                  <IconButton size="small" onClick={() => setViewReceipt(r)} sx={{ color: '#2563eb', '&:hover': { backgroundColor: '#eff6ff' } }}>
                                    <Eye size={14} />
                                  </IconButton>
                                </Tooltip>
                                {!readOnly && (
                                  <Tooltip title="Delete Receipt">
                                    <IconButton size="small" onClick={() => setDeleteTarget(r)} sx={{ color: '#dc2626', '&:hover': { backgroundColor: '#fff1f2' } }}>
                                      <Trash2 size={14} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </td>
                          </tr>
                        );
                      }

                      return activeMs.map((m, mi) => {
                        const isFirst = mi === 0;
                        return (
                          <tr key={`${r.id}-${mi}`}
                            style={{
                              backgroundColor: isHovered ? '#eff6ff' : (isEven ? '#fff' : '#f8fafc'),
                              transition: 'background 0.1s'
                            }}
                            onMouseEnter={() => setHoveredReceiptId(r.id)}
                            onMouseLeave={() => setHoveredReceiptId(null)}
                          >
                            {isFirst && (
                              <>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  {(currentPage - 1) * pageSize + idx + 1}
                                </td>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', fontWeight: 700, color: '#2563eb', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  {r.receiptNumber}
                                </td>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  {r.vendorName}
                                </td>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  {fmtDate(r.dateReceived)}
                                </td>
                              </>
                            )}

                            {/* Materials Split Columns */}
                            <td style={{
                              padding: '10px 14px',
                              borderBottom: mi === activeMs.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                              borderRight: '1px solid #e2e8f0',
                              verticalAlign: 'middle'
                            }}>
                              <span style={{
                                backgroundColor: '#e0e7ff', color: '#3730a3',
                                padding: '2px 7px', borderRadius: 4, fontWeight: 800, fontSize: '0.62rem',
                              }}>
                                {m.materialCode}
                              </span>
                            </td>
                            <td style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#475569',
                              fontWeight: 600,
                              borderBottom: mi === activeMs.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                              borderRight: '1px solid #e2e8f0',
                              verticalAlign: 'middle'
                            }}>
                              {m.netIntakeWeightKg ? fmtNum(m.netIntakeWeightKg) : '—'}
                            </td>
                            <td style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#475569',
                              fontWeight: 600,
                              borderBottom: mi === activeMs.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                              borderRight: '1px solid #e2e8f0',
                              verticalAlign: 'middle'
                            }}>
                              {m.costPerKg ? fmtNum(m.costPerKg, 0) : '—'}
                            </td>
                            <td style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#0f172a',
                              fontWeight: 700,
                              borderBottom: mi === activeMs.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                              borderRight: '1px solid #e2e8f0',
                              verticalAlign: 'middle'
                            }}>
                              {m.netIntakeWeightKg && m.costPerKg ? fmtNum(m.netIntakeWeightKg * m.costPerKg, 0) : '—'}
                            </td>
                            <td style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#7c3aed',
                              fontWeight: 700,
                              borderBottom: mi === activeMs.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                              borderRight: '1px solid #e2e8f0',
                              verticalAlign: 'middle'
                            }}>
                              {m.efficiencyPercentage ? `${m.efficiencyPercentage}%` : '—'}
                            </td>

                            {isFirst && (
                              <>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  {fmtNum(r.totalReceivedWeightKg)}
                                </td>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#dc2626', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  {fmtNum(r.totalReturnedWeightKg)}
                                </td>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16a34a', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  {fmtNum(r.totalNetIntakeWeightKg)}
                                </td>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', color: '#64748b', fontWeight: 500, borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  {r.createdBy}
                                </td>
                                <td rowSpan={activeMs.length} style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                    <Tooltip title="View Receipt Detail">
                                      <IconButton size="small" onClick={() => setViewReceipt(r)} sx={{ color: '#2563eb', '&:hover': { backgroundColor: '#eff6ff' } }}>
                                        <Eye size={14} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Receipt">
                                      <IconButton size="small" onClick={() => setDeleteTarget(r)} sx={{ color: '#dc2626', '&:hover': { backgroundColor: '#fff1f2' } }}>
                                        <Trash2 size={14} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </Box>

            {/* Pagination */}
            <Box sx={{
              borderTop: '1px solid #e2e8f0', px: 3, py: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#f8fafc', flexWrap: 'wrap', gap: 1,
            }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                Showing {filteredReceipts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredReceipts.length)} of {filteredReceipts.length} receipts
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <IconButton size="small" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, backgroundColor: '#fff' }}>
                  <ChevronLeft size={15} />
                </IconButton>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)} style={{
                    padding: '4px 10px', borderRadius: 6, fontWeight: 700, fontSize: '0.75rem',
                    border: '1px solid',
                    borderColor: currentPage === i + 1 ? '#2563eb' : '#e2e8f0',
                    backgroundColor: currentPage === i + 1 ? '#2563eb' : '#fff',
                    color: currentPage === i + 1 ? '#fff' : '#64748b',
                    cursor: 'pointer',
                  }}>{i + 1}</button>
                ))}
                <IconButton size="small" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, backgroundColor: '#fff' }}>
                  <ChevronRight size={15} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Receipt Detail Dialog ── */}
      <ReceiptDetailDialog receipt={viewReceipt} onClose={() => setViewReceipt(null)} />

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth fullScreen={isMobile}
        slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3 } } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <X style={{ color: '#dc2626' }} size={20} /> Delete Receipt
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#475569' }}>
            Are you sure you want to delete receipt{' '}
            <strong style={{ color: '#1e293b' }}>{deleteTarget?.receiptNumber}</strong> from{' '}
            <strong style={{ color: '#1e293b' }}>{deleteTarget?.vendorName}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" disabled={deleting}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="contained" disabled={deleting}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, backgroundColor: '#dc2626', '&:hover': { backgroundColor: '#b91c1c' } }}>
            {deleting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WarehousePage;
