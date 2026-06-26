import { Box, Card, CardContent, Typography, Button, IconButton } from '@mui/material';
import { ArrowUpRight, ArrowDownRight, ArrowLeft } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { DashboardAnalytics, KpiData, DashboardFilters } from '../types/dashboard.types';

interface Props {
  analytics: DashboardAnalytics;
  kpi: KpiData;
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
}

const axisStyle = { fontSize: '0.65rem', fill: '#94a3b8', fontWeight: 600 };
const tooltipStyle = {
  contentStyle: { fontSize: '0.72rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)' },
  labelStyle: { fontWeight: 800, color: '#1e293b', marginBottom: 4 },
};

const calcChange = (curr: number, prev: number): number => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};

const formatWeight = (val: number): string => {
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toLocaleString('en-IN') + ' kg';
};

const ProductionPerformanceCard = ({ analytics, kpi, filters, setFilters }: Props) => {
  const change = calcChange(kpi.value, kpi.prevValue);
  const isPositive = change >= 0;
  const isNeutral = Math.abs(change) < 0.1;

  // Format value to look like mockup, e.g. "$128.4K" -> "128.4 T" or similar weight
  const mainValue = kpi.value >= 1000 
    ? (kpi.value / 1000).toFixed(1) + ' T' 
    : kpi.value.toLocaleString('en-IN') + ' kg';

  const rangeButtons: { label: string; value: typeof filters.datePreset }[] = [
    { label: '1W', value: 'last7' },
    { label: '1M', value: 'last30' },
    { label: '3M', value: 'currentMonth' },
    { label: '6M', value: 'previousMonth' },
    { label: '1Y', value: 'currentYear' },
    { label: 'All', value: 'custom' },
  ];

  return (
    <Card sx={{
      borderRadius: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      border: '1px solid #e2e8f0',
      bgcolor: '#ffffff',
      height: '100%',
      position: 'relative',
      overflow: 'visible'
    }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        
        {/* Top Header Row */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 0.5 }}>
              <ArrowLeft size={14} />
            </IconButton>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
              Production Performance
            </Typography>
          </Box>
          
          {/* Ranges Switcher */}
          <Box sx={{ display: 'flex', gap: 0.5, bgcolor: '#f8fafc', p: 0.5, borderRadius: 2.5, border: '1px solid #f1f5f9', alignSelf: { xs: 'stretch', sm: 'auto' }, justifyContent: 'space-between' }}>
            {rangeButtons.map((btn) => (
              <Button
                key={btn.label}
                size="small"
                onClick={() => setFilters(prev => ({ ...prev, datePreset: btn.value }))}
                sx={{
                  minWidth: 32,
                  height: 24,
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  p: 0,
                  borderRadius: 1.8,
                  textTransform: 'none',
                  color: filters.datePreset === btn.value ? '#1e293b' : '#94a3b8',
                  bgcolor: filters.datePreset === btn.value ? '#ffffff' : 'transparent',
                  boxShadow: filters.datePreset === btn.value ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                  border: filters.datePreset === btn.value ? '1px solid #e2e8f0' : '1px solid transparent',
                  '&:hover': {
                    bgcolor: filters.datePreset === btn.value ? '#ffffff' : '#f1f5f9',
                  }
                }}
              >
                {btn.label}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Dynamic Metric display */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 3 }}>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px', lineHeight: 1 }}>
            {mainValue}
          </Typography>
          {!isNeutral && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: isPositive ? '#f0fdf4' : '#fef2f2',
              color: isPositive ? '#16a34a' : '#dc2626',
              px: 1,
              py: 0.25,
              borderRadius: 1.5,
              border: `1px solid ${isPositive ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, ml: 0.25 }}>
                {isPositive ? '+' : ''}{change.toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Box>

        {/* Main Area Chart */}
        <Box sx={{ width: '100%', height: 260, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={analytics.dailyProductionTrend} 
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="performanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={true} horizontal={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={axisStyle} 
                axisLine={false} 
                tickLine={false}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis 
                tick={axisStyle} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(v) => formatWeight(v)}
                width={50}
              />
              <Tooltip 
                {...tooltipStyle} 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const prodVal = payload[0].value as number;
                    // Mock a potential value as 1.08x actual to replicate the image design
                    const potentialVal = prodVal * 1.12; 
                    return (
                      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', mb: 0.5 }}>{label}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#3b82f6' }} />
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155' }}>
                            Actual: <span style={{ fontWeight: 800 }}>{prodVal.toLocaleString('en-IN')} kg</span>
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#f97316' }} />
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155' }}>
                            Potential: <span style={{ fontWeight: 800 }}>{Math.round(potentialVal).toLocaleString('en-IN')} kg</span>
                          </Typography>
                        </Box>
                      </Box>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                fill="url(#performanceGrad)" 
                dot={false}
                activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#ffffff' }} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProductionPerformanceCard;
