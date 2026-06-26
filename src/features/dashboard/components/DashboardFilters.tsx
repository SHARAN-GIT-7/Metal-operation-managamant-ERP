import { Box, Card, CardContent, Chip, FormControl, MenuItem, Select, TextField, Typography, IconButton, Tooltip } from '@mui/material';
import { RefreshCw, X } from 'lucide-react';
import type { DashboardFilters, DatePreset } from '../types/dashboard.types';

interface FilterOption { label: string; options: string[]; key: keyof DashboardFilters }

interface Props {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  filterOptions: {
    alloyTypes: string[];
    furnaceNos: string[];
    supervisors: string[];
    customers: string[];
    shifts: string[];
  };
  lastRefreshed: Date | null;
  onRefresh: () => void;
  loading: boolean;
}

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7' },
  { label: 'Last 30 Days', value: 'last30' },
  { label: 'This Month', value: 'currentMonth' },
  { label: 'Prev Month', value: 'previousMonth' },
  { label: 'This Quarter', value: 'currentQuarter' },
  { label: 'This Year', value: 'currentYear' },
  { label: 'Custom', value: 'custom' },
];

const DashboardFiltersComponent = ({ filters, setFilters, filterOptions, lastRefreshed, onRefresh, loading }: Props) => {
  const set = <K extends keyof DashboardFilters>(key: K, val: DashboardFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const hasActiveFilters =
    filters.alloyType || filters.furnaceNo || filters.shift || filters.supervisor || filters.customer || filters.qualityStatus;

  const clearAll = () =>
    setFilters((f) => ({ ...f, alloyType: '', furnaceNo: '', shift: '', supervisor: '', customer: '', qualityStatus: '' }));

  const fmtRefresh = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Card sx={{ mb: 2.5, borderRadius: 3, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <CardContent sx={{ py: 2, px: { xs: 1.5, sm: 3 }, '&:last-child': { pb: 2 } }}>
        {/* Row 1 — Date presets */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%' }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mr: 0.5, flexShrink: 0 }}>
              Period
            </Typography>
            {DATE_PRESETS.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                size="small"
                onClick={() => set('datePreset', p.value)}
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  height: 26,
                  cursor: 'pointer',
                  bgcolor: filters.datePreset === p.value ? '#1565C0' : '#f1f5f9',
                  color: filters.datePreset === p.value ? '#fff' : '#475569',
                  border: filters.datePreset === p.value ? '1.5px solid #1565C0' : '1.5px solid #e2e8f0',
                  '&:hover': { bgcolor: filters.datePreset === p.value ? '#0d47a1' : '#e2e8f0' },
                }}
              />
            ))}

            {/* Custom date range inputs */}
            {filters.datePreset === 'custom' && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 0.5, flexWrap: 'wrap' }}>
                <TextField
                  type="date" size="small" value={filters.customStart}
                  onChange={(e) => set('customStart', e.target.value)}
                  slotProps={{ htmlInput: { style: { fontSize: '0.72rem', padding: '4px 8px' } } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>to</Typography>
                <TextField
                  type="date" size="small" value={filters.customEnd}
                  onChange={(e) => set('customEnd', e.target.value)}
                  slotProps={{ htmlInput: { style: { fontSize: '0.72rem', padding: '4px 8px' } } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Box>
            )}
          </Box>

          {/* Refresh info */}
          <Box sx={{ ml: { xs: 0, sm: 'auto' }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: { xs: '100%', sm: 'auto' }, mt: { xs: 0.5, sm: 0 }, flexShrink: 0 }}>
            {lastRefreshed && (
              <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>
                Updated {fmtRefresh(lastRefreshed)}
              </Typography>
            )}
            <Tooltip title="Refresh data">
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={loading}
                sx={{
                  color: '#1565C0',
                  bgcolor: '#eff6ff',
                  '&:hover': { bgcolor: '#dbeafe' },
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } },
                  width: 28, height: 28,
                  ml: 'auto'
                }}
              >
                <RefreshCw size={13} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Row 2 — Field filters */}
        <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap', alignItems: 'center' }}>
          {([
            { label: 'Alloy Type', key: 'alloyType', options: filterOptions.alloyTypes },
            { label: 'Furnace', key: 'furnaceNo', options: filterOptions.furnaceNos },
            { label: 'Shift', key: 'shift', options: filterOptions.shifts },
            { label: 'Supervisor', key: 'supervisor', options: filterOptions.supervisors },
            { label: 'Customer', key: 'customer', options: filterOptions.customers },
          ] as FilterOption[]).map(({ label, key, options }) => (
            <FormControl key={key} size="small" sx={{ minWidth: { xs: 0, sm: 120 }, width: { xs: 'calc(50% - 6px)', sm: 'auto' }, flexGrow: { xs: 1, sm: 0 } }}>
              <Select
                value={filters[key] as string}
                onChange={(e) => set(key, e.target.value as any)}
                displayEmpty
                sx={{ fontSize: '0.72rem', borderRadius: 1.5, bgcolor: filters[key] ? '#eff6ff' : '#f8fafc' }}
                renderValue={(val) => val ? <span style={{ color: '#1565C0', fontWeight: 700, fontSize: '0.72rem' }}>{val as string}</span> : <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{label}</span>}
              >
                <MenuItem value="" sx={{ fontSize: '0.72rem' }}><em>All {label}s</em></MenuItem>
                {options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: '0.72rem' }}>{o}</MenuItem>)}
              </Select>
            </FormControl>
          ))}

          {/* Quality filter */}
          <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 120 }, width: { xs: 'calc(50% - 6px)', sm: 'auto' }, flexGrow: { xs: 1, sm: 0 } }}>
            <Select
              value={filters.qualityStatus}
              onChange={(e) => set('qualityStatus', e.target.value as any)}
              displayEmpty
              sx={{ fontSize: '0.72rem', borderRadius: 1.5, bgcolor: filters.qualityStatus ? '#eff6ff' : '#f8fafc' }}
              renderValue={(val) => val ? <span style={{ color: '#1565C0', fontWeight: 700, fontSize: '0.72rem' }}>{val as string}</span> : <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>QC Status</span>}
            >
              <MenuItem value="" sx={{ fontSize: '0.72rem' }}><em>All QC Status</em></MenuItem>
              <MenuItem value="PASS" sx={{ fontSize: '0.72rem', color: '#2e7d32', fontWeight: 700 }}>PASS</MenuItem>
              <MenuItem value="FAIL" sx={{ fontSize: '0.72rem', color: '#c62828', fontWeight: 700 }}>FAIL</MenuItem>
            </Select>
          </FormControl>

          {hasActiveFilters && (
            <Chip
              label="Clear Filters"
              size="small"
              deleteIcon={<X size={10} />}
              onDelete={clearAll}
              onClick={clearAll}
              sx={{ fontSize: '0.65rem', fontWeight: 700, height: 26, bgcolor: '#fee2e2', color: '#c62828', border: '1px solid #fca5a5', cursor: 'pointer', width: { xs: '100%', sm: 'auto' }, mt: { xs: 0.5, sm: 0 } }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default DashboardFiltersComponent;
