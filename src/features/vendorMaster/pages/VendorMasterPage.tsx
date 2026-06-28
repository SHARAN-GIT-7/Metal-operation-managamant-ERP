import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Chip, Tooltip,
  CircularProgress, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Select, FormControl, InputLabel,
  useTheme, useMediaQuery,
} from '@mui/material';
import {
  Plus, Search, Edit2, Trash2, Eye, Building2,
  CheckCircle, XCircle, AlertTriangle, Users,
  ShoppingCart, Handshake, Filter, RefreshCw,
  MoreVertical, Ban, ArrowUpDown, Maximize2, Minimize2,
} from 'lucide-react';
import type { VendorMaster, VendorMasterFormData, VendorCategory, VendorStatus } from '../types/vendorMaster.types';
import {
  subscribeVendors,
  addVendor,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
} from '../services/vendorMaster.service';
import VendorDialog from '../components/VendorDialog';
import VendorViewDialog from '../components/VendorViewDialog';
import { useAuth } from '../../../context/AuthContext';
import { Timestamp } from 'firebase/firestore';

// ─── Category Badge ───────────────────────────────────────────
const CategoryBadge = ({ category }: { category: VendorCategory }) => {
  const cfg: Record<VendorCategory, { bg: string; color: string; border: string; icon: React.ReactNode }> = {
    Supplier: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: <ShoppingCart size={10} /> },
    Customer: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: <Users size={10} /> },
    Both:     { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff', icon: <Handshake size={10} /> },
  };
  const c = cfg[category];
  return (
    <Chip
      icon={<Box sx={{ color: c.color, display: 'flex', pl: 0.5 }}>{c.icon}</Box>}
      label={category}
      size="small"
      sx={{
        fontSize: '0.65rem', fontWeight: 700,
        bgcolor: c.bg, color: c.color, border: `1px solid ${c.border}`,
        '& .MuiChip-icon': { ml: 0.5 },
      }}
    />
  );
};

// ─── Status Badge ─────────────────────────────────────────────
const StatusBadge = ({ status }: { status: VendorStatus }) => {
  const cfg: Record<VendorStatus, { bg: string; color: string; border: string }> = {
    Active:   { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
    Inactive: { bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
    Blocked:  { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
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

// ─── Main Page ───────────────────────────────────────────────────────────
const VendorMasterPage = ({ noDelete = false }: { noDelete?: boolean }) => {
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tableMaximized, setTableMaximized] = useState(false);
  const [vendors, setVendors] = useState<VendorMaster[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & search
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<VendorCategory | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<VendorStatus | 'All'>('All');
  const [filterGST, setFilterGST] = useState<'All' | 'Registered' | 'Unregistered'>('All');

  // Sorting states
  const [sortKey, setSortKey] = useState<string>('vendorCode');
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
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<VendorMaster | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ vendor: VendorMaster; newStatus: VendorStatus } | null>(null);
  const [editVendor, setEditVendor] = useState<VendorMaster | null>(null);
  const [viewVendor, setViewVendor] = useState<VendorMaster | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeVendors((data) => {
      setVendors(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtered list
  const filtered = useMemo(() => {
    const list = vendors.filter((v) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        v.vendorName.toLowerCase().includes(q) ||
        v.vendorCode.toLowerCase().includes(q) ||
        (v.gstNumber ?? '').toLowerCase().includes(q) ||
        (v.panNumber ?? '').toLowerCase().includes(q) ||
        (v.contactNumber ?? '').includes(q) ||
        (v.email ?? '').toLowerCase().includes(q) ||
        (v.companyAddress?.state ?? '').toLowerCase().includes(q);

      const matchCat = filterCategory === 'All' || v.vendorCategory === filterCategory;
      const matchStatus = filterStatus === 'All' || v.status === filterStatus;
      const matchGST =
        filterGST === 'All' ||
        (filterGST === 'Registered' && v.gstRegistered) ||
        (filterGST === 'Unregistered' && !v.gstRegistered);

      return matchSearch && matchCat && matchStatus && matchGST;
    });

    list.sort((a, b) => {
      let av: any;
      let bv: any;
      if (sortKey === 'createdAt') {
        av = a.createdAt instanceof Timestamp ? a.createdAt.seconds : 0;
        bv = b.createdAt instanceof Timestamp ? b.createdAt.seconds : 0;
      } else if (sortKey === 'state') {
        av = a.companyAddress?.state || '';
        bv = b.companyAddress?.state || '';
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
  }, [vendors, search, filterCategory, filterStatus, filterGST, sortKey, sortDir]);

  // Stats
  const stats = useMemo(() => ({
    total: vendors.length,
    suppliers: vendors.filter((v) => v.vendorCategory === 'Supplier' || v.vendorCategory === 'Both').length,
    customers: vendors.filter((v) => v.vendorCategory === 'Customer' || v.vendorCategory === 'Both').length,
    active: vendors.filter((v) => v.status === 'Active').length,
    inactive: vendors.filter((v) => v.status === 'Inactive').length,
    blocked: vendors.filter((v) => v.status === 'Blocked').length,
  }), [vendors]);

  const displayName = user?.displayName ?? user?.email ?? 'Admin';

  // Handlers
  const handleOpenAdd = () => { setEditVendor(null); setAddEditOpen(true); };
  const handleOpenEdit = (v: VendorMaster) => { setEditVendor(v); setAddEditOpen(true); };
  const handleOpenView = (v: VendorMaster) => { setViewVendor(v); setViewOpen(true); };

  const handleSave = async (form: VendorMasterFormData) => {
    if (editVendor) {
      await updateVendor(editVendor.id, form, displayName);
    } else {
      await addVendor(form, vendors, displayName);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.id + '_delete');
    try {
      await deleteVendor(deleteConfirm.id);
      setDeleteConfirm(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async () => {
    if (!statusConfirm) return;
    setActionLoading(statusConfirm.vendor.id + '_status');
    try {
      await updateVendorStatus(statusConfirm.vendor.id, statusConfirm.newStatus, displayName);
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
    // serverTimestamp sentinel not yet resolved — show pending
    return '…';
  };

  const resetFilters = () => {
    setSearch('');
    setFilterCategory('All');
    setFilterStatus('All');
    setFilterGST('All');
  };

  const hasActiveFilters = search || filterCategory !== 'All' || filterStatus !== 'All' || filterGST !== 'All';

  return (
    <Box>
      {/* ── Page Header ── */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Building2 size={20} color="#1565C0" />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Vendor Master</Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Single source of truth for all Suppliers, Customers, and Business Partners.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={handleOpenAdd}
          sx={{ borderRadius: 2, fontWeight: 600, px: 2.5, width: { xs: '100%', sm: 'auto' } }}
        >
          Add Vendor / Customer
        </Button>
      </Box>

      {/* ── Stats Row ── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Entities', value: stats.total, color: '#1565C0', bg: '#dbeafe', icon: <Building2 size={16} /> },
          { label: 'Suppliers', value: stats.suppliers, color: '#0891b2', bg: '#cffafe', icon: <ShoppingCart size={16} /> },
          { label: 'Customers', value: stats.customers, color: '#15803d', bg: '#dcfce7', icon: <Users size={16} /> },
          { label: 'Active', value: stats.active, color: '#15803d', bg: '#dcfce7', icon: <CheckCircle size={16} /> },
          { label: 'Inactive', value: stats.inactive, color: '#b45309', bg: '#fef9c3', icon: <XCircle size={16} /> },
          { label: 'Blocked', value: stats.blocked, color: '#dc2626', bg: '#fee2e2', icon: <Ban size={16} /> },
        ].map((s) => (
          <Card key={s.label} sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 130px' }, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderRadius: 2.5 }}>
            <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: '1.7rem', fontWeight: 700, color: s.color, lineHeight: 1.2 }}>
                    {s.value}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, bgcolor: s.bg, borderRadius: 1.5, color: s.color }}>{s.icon}</Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* ── Search & Filters ── */}
      <Card sx={{ mb: 2, borderRadius: 2.5, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ py: 1.5, px: 2.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by name, code, GST, PAN, phone, email, state..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} color="#94a3b8" />
                    </InputAdornment>
                  ),
                }
              }}
              sx={{ flex: { xs: '1 1 100%', sm: 1 }, minWidth: { xs: '100%', sm: 250 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 130 } }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Category</InputLabel>
              <Select
                label="Category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
                sx={{ borderRadius: 2, fontSize: '0.8rem' }}
              >
                <MenuItem value="All">All Categories</MenuItem>
                <MenuItem value="Supplier">Supplier</MenuItem>
                <MenuItem value="Customer">Customer</MenuItem>
                <MenuItem value="Both">Both</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Status</InputLabel>
              <Select
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                sx={{ borderRadius: 2, fontSize: '0.8rem' }}
              >
                <MenuItem value="All">All Status</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
                <MenuItem value="Blocked">Blocked</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 } }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>GST</InputLabel>
              <Select
                label="GST"
                value={filterGST}
                onChange={(e) => setFilterGST(e.target.value as any)}
                sx={{ borderRadius: 2, fontSize: '0.8rem' }}
              >
                <MenuItem value="All">All GST</MenuItem>
                <MenuItem value="Registered">Registered</MenuItem>
                <MenuItem value="Unregistered">Unregistered</MenuItem>
              </Select>
            </FormControl>

            {hasActiveFilters && (
              <Tooltip title="Clear all filters">
                <IconButton size="small" onClick={resetFilters} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}>
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
                {filtered.length} of {vendors.length} vendors shown
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
            {tableMaximized ? 'Vendor Directory (Expanded View)' : 'Vendor Directory'}
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
            <Typography sx={{ ml: 2, color: 'text.secondary' }}>Loading vendors...</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Building2 size={40} color="#cbd5e1" />
            <Typography sx={{ mt: 2, color: 'text.secondary', fontWeight: 500 }}>
              {hasActiveFilters ? 'No vendors match your filters.' : 'No vendors found. Add your first vendor or customer.'}
            </Typography>
            {!hasActiveFilters && (
              <Button variant="outlined" sx={{ mt: 2, borderRadius: 2 }} onClick={handleOpenAdd} startIcon={<Plus size={14} />}>
                Add Vendor / Customer
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto', width: '100%', maxHeight: tableMaximized ? 'calc(90vh - 120px)' : 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {[
                    { label: 'Code', key: 'vendorCode' },
                    { label: 'Vendor Name', key: 'vendorName' },
                    { label: 'Category', key: 'vendorCategory' },
                    { label: 'Type', key: 'vendorType' },
                    { label: 'GST No.', key: 'gstNumber' },
                    { label: 'PAN No.', key: 'panNumber' },
                    { label: 'Contact', key: 'contactNumber' },
                    { label: 'Email', key: 'email' },
                    { label: 'State', key: 'state' },
                    { label: 'Status', key: 'status' },
                    { label: 'Created', key: 'createdAt' },
                    { label: 'Actions', key: '' }
                  ].map((col) => (
                    <TableCell
                      key={col.label}
                      onClick={() => col.key && handleSort(col.key)}
                      sx={{
                        fontSize: '0.62rem', fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: 0.6,
                        borderBottom: '1px solid #e2e8f0', py: 1.5, px: 1.5,
                        whiteSpace: 'nowrap',
                        cursor: col.key ? 'pointer' : 'default',
                        userSelect: 'none',
                        '&:hover': col.key ? { bgcolor: '#f1f5f9' } : {},
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
                {filtered.map((v) => (
                  <TableRow
                    key={v.id}
                    sx={{
                      '&:hover': { bgcolor: '#f8fafc' },
                      opacity: v.status === 'Blocked' ? 0.6 : v.status === 'Inactive' ? 0.8 : 1,
                      transition: 'opacity 0.2s',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {/* Code */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <Box sx={{
                        display: 'inline-block', px: 1, py: 0.25,
                        bgcolor: '#eff6ff', color: '#1d4ed8',
                        borderRadius: 1, fontSize: '0.7rem', fontWeight: 700,
                        border: '1px solid #bfdbfe', fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}>
                        {v.vendorCode}
                      </Box>
                    </TableCell>

                    {/* Name */}
                    <TableCell sx={{ px: 1.5, py: 1.5, minWidth: 160 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{v.vendorName}</Typography>
                    </TableCell>

                    {/* Category */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <CategoryBadge category={v.vendorCategory} />
                    </TableCell>

                    {/* Type */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#475569', whiteSpace: 'nowrap' }}>{v.vendorType}</Typography>
                    </TableCell>

                    {/* GST */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      {v.gstNumber ? (
                        <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#1e293b', fontWeight: 600 }}>{v.gstNumber}</Typography>
                      ) : (
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          {v.gstRegistered ? '—' : 'Unregistered'}
                        </Typography>
                      )}
                    </TableCell>

                    {/* PAN */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#475569' }}>
                        {v.panNumber || '—'}
                      </Typography>
                    </TableCell>

                    {/* Contact */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#374151', whiteSpace: 'nowrap' }}>
                        {v.contactNumber || '—'}
                      </Typography>
                    </TableCell>

                    {/* Email */}
                    <TableCell sx={{ px: 1.5, py: 1.5, maxWidth: 160 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.email || '—'}
                      </Typography>
                    </TableCell>

                    {/* State */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {v.companyAddress?.state || '—'}
                      </Typography>
                    </TableCell>

                    {/* Status */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <StatusBadge status={v.status} />
                    </TableCell>

                    {/* Created */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {formatDate(v.createdAt)}
                      </Typography>
                    </TableCell>

                    {/* Actions */}
                    <TableCell sx={{ px: 1.5, py: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 0.25 }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleOpenView(v)} sx={{ color: '#1565C0', '&:hover': { bgcolor: '#eff6ff' } }}>
                            <Eye size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Vendor">
                          <IconButton size="small" onClick={() => handleOpenEdit(v)} sx={{ color: '#0891b2', '&:hover': { bgcolor: '#ecfeff' } }}>
                            <Edit2 size={14} />
                          </IconButton>
                        </Tooltip>
                        {/* Status change */}
                        {v.status !== 'Inactive' && (
                          <Tooltip title="Mark as Inactive">
                            <IconButton
                              size="small"
                              onClick={() => setStatusConfirm({ vendor: v, newStatus: 'Inactive' })}
                              sx={{ color: '#b45309', '&:hover': { bgcolor: '#fef9c3' } }}
                            >
                              <MoreVertical size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {v.status !== 'Blocked' && (
                          <Tooltip title="Block Vendor">
                            <IconButton
                              size="small"
                              onClick={() => setStatusConfirm({ vendor: v, newStatus: 'Blocked' })}
                              sx={{ color: '#dc2626', '&:hover': { bgcolor: '#fef2f2' } }}
                            >
                              <Ban size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {v.status !== 'Active' && (
                          <Tooltip title="Activate Vendor">
                            <IconButton
                              size="small"
                              onClick={() => setStatusConfirm({ vendor: v, newStatus: 'Active' })}
                              sx={{ color: '#15803d', '&:hover': { bgcolor: '#dcfce7' } }}
                            >
                              <CheckCircle size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!noDelete && (
                          <Tooltip title="Delete Vendor">
                            <IconButton size="small" onClick={() => setDeleteConfirm(v)} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}>
                              <Trash2 size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Table Footer */}
        {!loading && filtered.length > 0 && (
          <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Showing <b style={{ color: '#1565C0' }}>{filtered.length}</b> of {vendors.length} vendors
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label={`Suppliers: ${stats.suppliers}`} size="small" sx={{ fontSize: '0.65rem', bgcolor: '#eff6ff', color: '#1d4ed8' }} />
              <Chip label={`Customers: ${stats.customers}`} size="small" sx={{ fontSize: '0.65rem', bgcolor: '#f0fdf4', color: '#15803d' }} />
            </Box>
          </Box>
        )}
      </Card>


      {/* ── Dialogs ── */}
      <VendorDialog
        open={addEditOpen}
        onClose={() => setAddEditOpen(false)}
        onSave={handleSave}
        editVendor={editVendor}
      />

      <VendorViewDialog
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        vendor={viewVendor}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth fullScreen={isMobile} slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ p: 1, bgcolor: '#fef2f2', borderRadius: 1.5, display: 'flex' }}>
            <AlertTriangle size={18} color="#dc2626" />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Delete Vendor?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.6 }}>
            You are about to permanently delete{' '}
            <b style={{ color: '#1e293b' }}>{deleteConfirm?.vendorName}</b> ({deleteConfirm?.vendorCode}).
          </Typography>
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fecaca' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
              ⚠ This action cannot be undone. Consider marking the vendor as Inactive or Blocked instead to preserve records.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteConfirm(null)} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={!!actionLoading}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {actionLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Confirmation */}
      <Dialog open={!!statusConfirm} onClose={() => setStatusConfirm(null)} maxWidth="xs" fullWidth fullScreen={isMobile} slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ p: 1, bgcolor: '#fef9c3', borderRadius: 1.5, display: 'flex' }}>
            <AlertTriangle size={18} color="#b45309" />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Change Vendor Status</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.6 }}>
            Change status of <b style={{ color: '#1e293b' }}>{statusConfirm?.vendor.vendorName}</b> to{' '}
            <b style={{ color: statusConfirm?.newStatus === 'Active' ? '#15803d' : statusConfirm?.newStatus === 'Blocked' ? '#dc2626' : '#b45309' }}>
              {statusConfirm?.newStatus}
            </b>?
          </Typography>
          {statusConfirm?.newStatus === 'Blocked' && (
            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fecaca' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                Blocked vendors cannot be selected in any new transactions.
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
              bgcolor: statusConfirm?.newStatus === 'Active' ? '#15803d' : statusConfirm?.newStatus === 'Blocked' ? '#dc2626' : '#b45309',
              '&:hover': {
                bgcolor: statusConfirm?.newStatus === 'Active' ? '#166534' : statusConfirm?.newStatus === 'Blocked' ? '#b91c1c' : '#92400e',
              }
            }}
          >
            {actionLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : `Set ${statusConfirm?.newStatus}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorMasterPage;
