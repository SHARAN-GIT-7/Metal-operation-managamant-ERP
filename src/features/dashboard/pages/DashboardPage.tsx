import { useState } from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { LayoutDashboard } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import DashboardFiltersComponent from '../components/DashboardFilters';
import KpiCards from '../components/KpiCards';
import ProductionSection from '../components/ProductionSection';
import InventorySection from '../components/InventorySection';
import FinancialSection from '../components/FinancialSection';
import DispatchSection from '../components/DispatchSection';
import QualitySection from '../components/QualitySection';

// Revamped Overview Cards
import ProductionPerformanceCard from '../components/ProductionPerformanceCard';

type DashboardTab = 'overview' | 'production' | 'inventory' | 'financial' | 'dispatch' | 'quality';

const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const { data, loading, lastRefreshed, refresh } = useDashboardData();
  const { filters, setFilters, filterOptions, analytics, filteredCounts } = useDashboardFilters(data);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%' }}>

      {/* ── Page Header ── */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ p: 1, background: 'linear-gradient(135deg,#1565C0,#1976d2)', borderRadius: 2, display: 'flex' }}>
              <LayoutDashboard size={22} color="#fff" />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>
              Executive Dashboard
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#64748b', ml: 6 }}>
            Real-time overview of all foundry operations
          </Typography>
        </Box>

        {/* Live counters */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label={`${filteredCounts.production} heats`}
            size="small"
            sx={{ fontSize: '0.68rem', fontWeight: 700, bgcolor: '#eff6ff', color: '#1565C0', border: '1px solid #bfdbfe' }}
          />
          <Chip
            label={`${filteredCounts.dispatch} dispatches`}
            size="small"
            sx={{ fontSize: '0.68rem', fontWeight: 700, bgcolor: '#eff6ff', color: '#0277bd', border: '1px solid #bfdbfe' }}
          />
          <Chip
            label={`${filteredCounts.qc} QC records`}
            size="small"
            sx={{ fontSize: '0.68rem', fontWeight: 700, bgcolor: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}
          />
          {loading && (
            <Chip
              label="Loading…"
              size="small"
              sx={{ fontSize: '0.68rem', fontWeight: 700, bgcolor: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } } }}
            />
          )}
        </Box>
      </Box>

      {/* ── Global Filters ── */}
      <DashboardFiltersComponent
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
        lastRefreshed={lastRefreshed}
        onRefresh={refresh}
        loading={loading}
      />

      {/* ── Dashboard Navigation Tabs ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, overflowX: 'auto', pb: 1, width: '100%', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {[
          { value: 'overview', label: 'Executive Overview' },
          { value: 'production', label: 'Production Analytics' },
          { value: 'inventory', label: 'Inventory Analytics' },
          { value: 'financial', label: 'Financial Analytics' },
          { value: 'dispatch', label: 'Dispatch Analytics' },
          { value: 'quality', label: 'Quality & Efficiency' },
        ].map((tab) => (
          <Button
            key={tab.value}
            variant={activeTab === tab.value ? 'contained' : 'outlined'}
            onClick={() => setActiveTab(tab.value as DashboardTab)}
            sx={{
              borderRadius: 3,
              textTransform: 'none',
              fontSize: '0.72rem',
              fontWeight: 800,
              px: 2,
              py: 0.6,
              bgcolor: activeTab === tab.value ? '#1e293b' : 'transparent',
              color: activeTab === tab.value ? '#ffffff' : '#64748b',
              borderColor: activeTab === tab.value ? '#1e293b' : '#e2e8f0',
              flexShrink: 0,
              '&:hover': {
                bgcolor: activeTab === tab.value ? '#0f172a' : '#f8fafc',
                borderColor: activeTab === tab.value ? '#0f172a' : '#cbd5e1',
              }
            }}
          >
            {tab.label}
          </Button>
        ))}
      </Box>

      {/* ── Tab Views ── */}
      {activeTab === 'overview' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Row 1: Production Performance Chart (Full Width) */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3 }}>
            <Box sx={{ minWidth: 0 }}>
              <ProductionPerformanceCard
                analytics={analytics}
                kpi={analytics.kpis[0]}
                filters={filters}
                setFilters={setFilters}
              />
            </Box>
          </Box>
        </Box>
      )}

      {activeTab === 'production' && (
        <Box>
          <KpiCards kpis={analytics.kpis.filter(k => ['Total Production', 'Avg Recovery', 'Production Hours'].includes(k.label))} loading={loading} />
          <ProductionSection analytics={analytics} loading={loading} />
        </Box>
      )}

      {activeTab === 'inventory' && (
        <Box>
          <KpiCards kpis={analytics.kpis.filter(k => ['Raw Material Stock', 'Total Input Material', 'Finished Stock'].includes(k.label))} loading={loading} />
          <InventorySection analytics={analytics} inventoryItems={data.inventoryItems} loading={loading} />
        </Box>
      )}

      {activeTab === 'financial' && (
        <Box>
          <KpiCards kpis={analytics.kpis.filter(k => ['Avg Production Cost', 'Avg Selling Price'].includes(k.label))} loading={loading} />
          <FinancialSection analytics={analytics} loading={loading} />
        </Box>
      )}

      {activeTab === 'dispatch' && (
        <Box>
          <KpiCards kpis={analytics.kpis.filter(k => ['Total Dispatch'].includes(k.label))} loading={loading} />
          <DispatchSection analytics={analytics} loading={loading} />
        </Box>
      )}

      {activeTab === 'quality' && (
        <Box>
          <KpiCards kpis={analytics.kpis.filter(k => ['Avg Recovery', 'QC Pass Rate'].includes(k.label))} loading={loading} />
          <QualitySection analytics={analytics} loading={loading} />
        </Box>
      )}

      {/* Bottom spacer */}
      <Box sx={{ height: 40 }} />
    </Box>
  );
};

export default DashboardPage;
