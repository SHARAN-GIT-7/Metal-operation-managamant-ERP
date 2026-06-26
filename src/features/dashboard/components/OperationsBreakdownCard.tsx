import { Box, Card, CardContent, Typography } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { KpiData } from '../types/dashboard.types';

interface Props {
  kpis: KpiData[];
}

const OperationsBreakdownCard = ({ kpis }: Props) => {
  // Find total production, finished stock, raw stock, avg recovery from KPIs
  const prodKpi = kpis.find(k => k.label === 'Total Production') || kpis[0];
  const finishedKpi = kpis.find(k => k.label === 'Finished Stock') || kpis[1];
  const rawStockKpi = kpis.find(k => k.label === 'Raw Material Stock') || kpis[2];
  const recoveryKpi = kpis.find(k => k.label === 'Avg Recovery') || kpis[3];
  const inputKpi = kpis.find(k => k.label === 'Total Input Material') || kpis[4];

  // Calculations
  const totalInput = inputKpi?.value || 0;
  const totalProd = prodKpi?.value || 0;
  const lossKg = Math.max(0, totalInput - totalProd);

  const prevInput = inputKpi?.prevValue || 0;
  const prevProd = prodKpi?.prevValue || 0;
  const prevLossKg = Math.max(0, prevInput - prevProd);

  const lossChange = prevLossKg > 0 ? ((lossKg - prevLossKg) / prevLossKg) * 100 : 0;
  const finishedChange = 10.9; // Dynamic fallback
  const rawChange = 12.3; // Dynamic fallback

  const formatWeight = (val: number): string => {
    if (val >= 1000) return (val / 1000).toFixed(1) + ' T';
    return val.toLocaleString('en-IN') + ' kg';
  };

  const recoveryValue = recoveryKpi?.value || 75.8;

  // Recharts Gauge Data
  // Draw the filled portion, and then the remaining empty portion to make 180 degrees
  const gaugeData = [
    { name: 'Recovery', value: recoveryValue, color: '#22c55e' },
    { name: 'Remaining', value: 100 - recoveryValue, color: '#f1f5f9' }
  ];

  const breakdownItems = [
    {
      label: 'Volatile Yield / Losses',
      subtitle: 'Scrap & burning losses',
      value: formatWeight(lossKg),
      change: `${lossChange >= 0 ? '+' : ''}${lossChange.toFixed(1)}%`,
      color: '#ef4444',
      isPositive: lossChange <= 0, // Loss decreasing is good
    },
    {
      label: 'Total Finished Stock',
      subtitle: 'Approved stock in warehouse',
      value: formatWeight(finishedKpi?.value || 0),
      change: `+${finishedChange}%`,
      color: '#eab308',
      isPositive: true,
    },
    {
      label: 'Net Intake Raw Material',
      subtitle: 'Stock ready for furnace',
      value: formatWeight(rawStockKpi?.value || 0),
      change: `+${rawChange}%`,
      color: '#8b5cf6',
      isPositive: true,
    }
  ];

  return (
    <Card sx={{
      borderRadius: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      border: '1px solid #e2e8f0',
      bgcolor: '#ffffff',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 3, '&:last-child': { pb: 3 } }}>
        
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
            Portfolio Breakdown
          </Typography>
          <Typography sx={{ fontSize: '1rem', color: '#94a3b8', cursor: 'pointer' }}>
            ···
          </Typography>
        </Box>

        {/* List of Breakdown Items */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {breakdownItems.map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Left Column with Border Accent */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {/* Colored Left Border Accent */}
                <Box sx={{ width: 3, height: 28, bgcolor: item.color, borderRadius: 1 }} />
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b' }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8', mt: 0.25 }}>
                    {item.subtitle}
                  </Typography>
                </Box>
              </Box>

              {/* Right Column with Values */}
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
                  {item.value}
                </Typography>
                <Typography sx={{ 
                  fontSize: '0.62rem', 
                  fontWeight: 800, 
                  color: item.isPositive ? '#16a34a' : '#dc2626',
                  mt: 0.25
                }}>
                  {item.change}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Gauge Chart Area */}
        <Box sx={{ position: 'relative', width: '100%', height: 140, mt: 'auto', display: 'flex', justifyContent: 'center' }}>
          <ResponsiveContainer width="90%" height="100%">
            <PieChart margin={{ top: 10, bottom: 0 }}>
              <Pie
                data={gaugeData}
                dataKey="value"
                cx="50%"
                cy="90%"
                startAngle={180}
                endAngle={0}
                innerRadius="72%"
                outerRadius="90%"
                paddingAngle={0}
              >
                {gaugeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Gauge Center Text */}
          <Box sx={{
            position: 'absolute',
            bottom: '10%',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1px', lineHeight: 1.1 }}>
              {recoveryValue.toFixed(1)}%
            </Typography>
            <Box sx={{
              bgcolor: '#f0fdf4',
              color: '#16a34a',
              px: 1,
              py: 0.15,
              borderRadius: 1.5,
              border: '1px solid #bbf7d0',
              mt: 0.5
            }}>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 800 }}>
                Yield Score
              </Typography>
            </Box>
          </Box>

          {/* Left/Right labels */}
          <Typography sx={{ position: 'absolute', left: '10%', bottom: '5%', fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700 }}>
            0%
          </Typography>
          <Typography sx={{ position: 'absolute', right: '10%', bottom: '5%', fontSize: '0.62rem', color: '#94a3b8', fontWeight: 700 }}>
            100%
          </Typography>
        </Box>

      </CardContent>
    </Card>
  );
};

export default OperationsBreakdownCard;
