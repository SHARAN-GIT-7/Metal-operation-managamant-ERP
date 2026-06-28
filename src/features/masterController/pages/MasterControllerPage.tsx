import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Chip, Tooltip,
  CircularProgress, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions,
  useTheme, useMediaQuery,
} from '@mui/material';
import {
  Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  Package, Database, AlertTriangle,
  CheckCircle, XCircle, Settings, ArrowUpDown, Maximize2, Minimize2,
} from 'lucide-react';
import type { MaterialMaster, MaterialMasterFormData } from '../types/materialMaster.types';
import {
  subscribeMaterials,
  addMaterial,
  updateMaterial,
  toggleMaterialStatus,
  deleteMaterial,
  seedDefaultMaterials,
} from '../services/materialMaster.service';
import MaterialDialog from '../components/MaterialDialog';
import { Timestamp } from 'firebase/firestore';

// Visibility indicator pills
const VisPill = ({ active, label }: { active: boolean; label: string }) => (
  <Chip
    label={label}
    size="small"
    sx={{
      fontSize: '0.6rem',
      height: 18,
      fontWeight: 600,
      bgcolor: active ? '#dbeafe' : '#f1f5f9',
      color: active ? '#1d4ed8' : '#94a3b8',
      border: `1px solid ${active ? '#bfdbfe' : '#e2e8f0'}`,
      '& .MuiChip-label': { px: 0.75 },
    }}
  />
);

const MasterControllerPage = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tableMaximized, setTableMaximized] = useState(false);
  const [materials, setMaterials] = useState<MaterialMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Disabled'>('All');

  // Sorting states
  const [sortKey, setSortKey] = useState<string>('materialId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMaterial, setEditMaterial] = useState<MaterialMaster | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MaterialMaster | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeMaterials((data) => {
      setMaterials(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const list = materials.filter((m) => {
      const matchSearch =
        m.materialName.toLowerCase().includes(search.toLowerCase()) ||
        m.materialCode.toLowerCase().includes(search.toLowerCase()) ||
        m.materialId.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' || m.status === filter;
      return matchSearch && matchFilter;
    });

    list.sort((a, b) => {
      let av: any;
      let bv: any;
      if (sortKey === 'updatedAt') {
        av = a.updatedAt instanceof Timestamp ? a.updatedAt.seconds : 0;
        bv = b.updatedAt instanceof Timestamp ? b.updatedAt.seconds : 0;
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
  }, [materials, search, filter, sortKey, sortDir]);

  const stats = {
    total: materials.length,
    active: materials.filter((m) => m.status === 'Active').length,
    disabled: materials.filter((m) => m.status === 'Disabled').length,
  };

  // Handlers
  const handleOpenAdd = () => { setEditMaterial(null); setDialogOpen(true); };
  const handleOpenEdit = (m: MaterialMaster) => { setEditMaterial(m); setDialogOpen(true); };

  const handleSave = async (form: MaterialMasterFormData) => {
    if (editMaterial) {
      await updateMaterial(editMaterial.id, form);
    } else {
      await addMaterial(form, materials);
    }
  };

  const handleToggleStatus = async (m: MaterialMaster) => {
    setActionLoading(m.id + '_toggle');
    try { await toggleMaterialStatus(m.id, m.status); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.id + '_delete');
    try {
      await deleteMaterial(deleteConfirm.id);
      setDeleteConfirm(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try { await seedDefaultMaterials(); }
    finally { setSeeding(false); }
  };

  const formatDate = (ts: Timestamp | undefined) => {
    if (!ts) return '—';
    return ts.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'flex-start' }, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Settings size={20} color="#1565C0" />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Master Controller</Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Central configuration for all ERP materials. Changes reflect across all modules instantly.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { xs: 'stretch', sm: 'center' }, width: { xs: '100%', sm: 'auto' } }}>
          {materials.length === 0 && !loading && (
            <Button
              variant="outlined"
              startIcon={seeding ? <CircularProgress size={14} /> : <Database size={16} />}
              onClick={handleSeedDefaults}
              disabled={seeding}
              sx={{ borderRadius: 2, fontWeight: 600, fontSize: '0.8rem', width: { xs: '100%', sm: 'auto' } }}
            >
              {seeding ? 'Seeding...' : 'Load Defaults'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={handleOpenAdd}
            sx={{ borderRadius: 2, fontWeight: 600, px: 2.5, width: { xs: '100%', sm: 'auto' } }}
          >
            Add Material
          </Button>
        </Box>
      </Box>

      {/* Stats Row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Materials', value: stats.total, color: '#1565C0', bg: '#dbeafe', icon: <Package size={16} /> },
          { label: 'Active', value: stats.active, color: '#15803d', bg: '#dcfce7', icon: <CheckCircle size={16} /> },
          { label: 'Disabled', value: stats.disabled, color: '#64748b', bg: '#f1f5f9', icon: <XCircle size={16} /> },
        ].map((s) => (
          <Card key={s.label} sx={{ flex: { xs: '1 1 100%', sm: '1 1 160px' }, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderRadius: 2.5 }}>
            <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Typography>
                  <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</Typography>
                </Box>
                <Box sx={{ p: 1, bgcolor: s.bg, borderRadius: 1.5, color: s.color }}>{s.icon}</Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Search + Filter */}
      <Card sx={{ mb: 2, borderRadius: 2.5, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ py: 1.5, px: 2.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by name, code or ID..."
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
              sx={{ flex: { xs: '1 1 100%', sm: 1 }, minWidth: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'space-between', sm: 'flex-start' } }}>
              {(['All', 'Active', 'Disabled'] as const).map((f) => (
                <Button
                  key={f}
                  size="small"
                  variant={filter === f ? 'contained' : 'outlined'}
                  onClick={() => setFilter(f)}
                  sx={{ borderRadius: 2, px: 2, fontWeight: 600, fontSize: '0.78rem', flex: { xs: 1, sm: 'initial' } }}
                >
                  {f}
                </Button>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Material Table */}
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
            {tableMaximized ? 'Material Master Registry (Expanded View)' : 'Material Master Registry'}
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
            <Typography sx={{ ml: 2, color: 'text.secondary' }}>Loading materials...</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Package size={40} color="#cbd5e1" />
            <Typography sx={{ mt: 2, color: 'text.secondary', fontWeight: 500 }}>
              {search ? 'No materials match your search.' : 'No materials found. Add a material or load defaults.'}
            </Typography>
            {!search && materials.length === 0 && (
              <Button variant="outlined" sx={{ mt: 2, borderRadius: 2 }} onClick={handleSeedDefaults} startIcon={<Database size={14} />}>
                Load Default Materials
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto', width: '100%', maxHeight: tableMaximized ? 'calc(90vh - 120px)' : 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {[
                    { label: 'ID', key: 'materialId' },
                    { label: 'Code', key: 'materialCode' },
                    { label: 'Material Name', key: 'materialName' },
                    { label: 'Efficiency', key: 'efficiencyPercentage' },
                    { label: 'Min. Stock', key: 'minimumStockKg' },
                    { label: 'Unit', key: 'unit' },
                    { label: 'Visibility', key: 'showInWarehouse' },
                    { label: 'Status', key: 'status' },
                    { label: 'Updated', key: 'updatedAt' },
                    { label: 'Actions', key: '' }
                  ].map((col) => (
                    <TableCell
                      key={col.label}
                      onClick={() => col.key && handleSort(col.key)}
                      sx={{
                        fontSize: '0.65rem', fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: 0.6,
                        borderBottom: '1px solid #e2e8f0', py: 1.5, px: 2,
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
                {filtered.map((m) => {
                  const isToggling = actionLoading === m.id + '_toggle';
                  const isActive = m.status === 'Active';
                  return (
                    <TableRow
                      key={m.id}
                      sx={{
                        '&:hover': { bgcolor: '#f8fafc' },
                        opacity: isActive ? 1 : 0.65,
                        transition: 'opacity 0.2s',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      {/* ID */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b', fontWeight: 600 }}>
                          {m.materialId}
                        </Typography>
                      </TableCell>

                      {/* Code */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Box sx={{
                          display: 'inline-block', px: 1, py: 0.25,
                          bgcolor: '#eff6ff', color: '#1d4ed8',
                          borderRadius: 1, fontSize: '0.72rem', fontWeight: 700,
                          border: '1px solid #bfdbfe', fontFamily: 'monospace',
                        }}>
                          {m.materialCode}
                        </Box>
                      </TableCell>

                      {/* Name */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                          {m.materialName}
                        </Typography>
                      </TableCell>

                      {/* Efficiency */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{
                            width: 36, height: 36, borderRadius: '50%',
                            border: `2.5px solid`,
                            borderColor: m.efficiencyPercentage >= 90 ? '#22c55e' : m.efficiencyPercentage >= 80 ? '#f59e0b' : '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Typography sx={{
                              fontSize: '0.6rem', fontWeight: 800,
                              color: m.efficiencyPercentage >= 90 ? '#15803d' : m.efficiencyPercentage >= 80 ? '#b45309' : '#dc2626',
                            }}>
                              {m.efficiencyPercentage}%
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Min Stock */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                          {m.minimumStockKg.toLocaleString()} {m.unit}
                        </Typography>
                      </TableCell>

                      {/* Unit */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Typography sx={{ fontSize: '0.78rem', color: '#64748b' }}>{m.unit}</Typography>
                      </TableCell>

                      {/* Visibility */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          <VisPill active={m.showInWarehouse}  label="WH" />
                          <VisPill active={m.showInProduction} label="PR" />
                          <VisPill active={m.showInCostLedger} label="CL" />
                          <VisPill active={m.showInReports}    label="RP" />
                        </Box>
                      </TableCell>

                      {/* Status */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Chip
                          label={m.status}
                          size="small"
                          sx={{
                            fontSize: '0.68rem', fontWeight: 700,
                            bgcolor: isActive ? '#dcfce7' : '#f1f5f9',
                            color: isActive ? '#15803d' : '#64748b',
                            border: `1px solid ${isActive ? '#bbf7d0' : '#e2e8f0'}`,
                          }}
                        />
                      </TableCell>

                      {/* Updated */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {formatDate(m.updatedAt)}
                        </Typography>
                      </TableCell>

                      {/* Actions */}
                      <TableCell sx={{ px: 2, py: 1.5 }}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit Material">
                            <IconButton size="small" onClick={() => handleOpenEdit(m)} sx={{ color: '#1565C0', '&:hover': { bgcolor: '#eff6ff' } }}>
                              <Edit2 size={15} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={isActive ? 'Disable Material' : 'Enable Material'}>
                            <IconButton size="small" onClick={() => handleToggleStatus(m)} disabled={isToggling}
                              sx={{ color: isActive ? '#64748b' : '#22c55e', '&:hover': { bgcolor: isActive ? '#f1f5f9' : '#dcfce7' } }}
                            >
                              {isToggling
                                ? <CircularProgress size={13} />
                                : isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />
                              }
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Material">
                            <IconButton size="small" onClick={() => setDeleteConfirm(m)}
                              sx={{ color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Showing {filtered.length} of {materials.length} materials
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, fontSize: '0.68rem', color: '#94a3b8', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span><b style={{ color: '#1d4ed8' }}>WH</b> = Warehouse</span>
              <span><b style={{ color: '#1d4ed8' }}>PR</b> = Production</span>
              <span><b style={{ color: '#1d4ed8' }}>CL</b> = Cost Ledger</span>
              <span><b style={{ color: '#1d4ed8' }}>RP</b> = Reports</span>
            </Box>
          </Box>
        )}
      </Card>

      {/* Info Banner */}
      <Box sx={{
        mt: 3, p: 2, bgcolor: '#eff6ff', borderRadius: 2,
        border: '1px solid #bfdbfe', display: 'flex', alignItems: 'flex-start', gap: 1.5
      }}>
        <AlertTriangle size={16} color="#1d4ed8" style={{ marginTop: 2, flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8', mb: 0.5 }}>
            How Material Master works
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#3b82f6', lineHeight: 1.7 }}>
            • <b>Active</b> materials appear in all enabled modules dynamically. <br />
            • <b>Disabled</b> materials are hidden from new entries but historical records remain unchanged. <br />
            • <b>Visibility toggles</b> (WH / PR / CL / RP) control per-module presence without disabling globally. <br />
            • Changes take effect <b>immediately</b> across all modules — no page refresh required.
          </Typography>
        </Box>
      </Box>

      {/* Material Add/Edit Dialog */}
      <MaterialDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        editMaterial={editMaterial}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth fullScreen={isMobile}
        slotProps={{ paper: { sx: { borderRadius: isMobile ? 0 : 3 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ p: 1, bgcolor: '#fef2f2', borderRadius: 1.5, display: 'flex' }}>
            <AlertTriangle size={18} color="#dc2626" />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Delete Material?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.6 }}>
            You are about to permanently delete{' '}
            <b style={{ color: '#1e293b' }}>{deleteConfirm?.materialName}</b> ({deleteConfirm?.materialCode}).
          </Typography>
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fecaca' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
              ⚠ This action cannot be undone. Consider disabling the material instead to preserve history.
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
    </Box>
  );
};

export default MasterControllerPage;
