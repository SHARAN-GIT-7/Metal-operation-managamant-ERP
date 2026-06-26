import { useState, useMemo } from 'react';
import { Box, Card, CardContent, Typography, Button } from '@mui/material';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { CostLedgerEntry } from '../../costLedger/types/costLedger.types';
import { getColorForAlloy, getColorForMaterial } from '../hooks/useDashboardFilters';

interface Props {
  costEntries: CostLedgerEntry[];
}

const AlloySparklinesCard = ({ costEntries }: Props) => {
  const [activeTab, setActiveTab] = useState<'trending' | 'materials' | 'scrap'>('trending');

  // Compute sparkline data dynamically from cost ledger
  const sparklineData = useMemo(() => {
    // Default fallback alloys if ledger has no entries
    const defaultAlloys = [
      { code: 'A6063', name: 'Alloy 6063', basePrice: 245.5, color: getColorForAlloy('A6063'), wave: [241, 243, 242, 245.5, 244, 246] },
      { code: 'A356', name: 'Alloy A356', basePrice: 260.0, color: getColorForAlloy('A356'), wave: [252, 255, 258, 256, 260, 262] },
      { code: 'ADC12', name: 'Alloy ADC12', basePrice: 210.8, color: getColorForAlloy('ADC12'), wave: [215, 212, 211, 210.8, 209, 210] },
      { code: 'LM6', name: 'Alloy LM6', basePrice: 228.4, color: getColorForAlloy('LM6'), wave: [220, 222, 225, 224, 228.4, 230] },
      { code: 'A6082', name: 'Alloy 6082', basePrice: 252.3, color: getColorForAlloy('A6082'), wave: [258, 256, 255, 253, 252.3, 250] },
    ];

    if (activeTab === 'materials') {
      return [
        { symbol: 'AL', name: 'Pure Aluminum Ingots', price: '₹225.40/kg', change: '+2.14%', isPositive: true, color: getColorForMaterial('AL'), data: [{val: 220}, {val: 222}, {val: 221}, {val: 224}, {val: 223}, {val: 225.4}] },
        { symbol: 'SI', name: 'Silicon Metal', price: '₹312.50/kg', change: '+6.55%', isPositive: true, color: getColorForMaterial('SI'), data: [{val: 295}, {val: 300}, {val: 305}, {val: 302}, {val: 310}, {val: 312.5}] },
        { symbol: 'MG', name: 'Magnesium Ingots', price: '₹415.00/kg', change: '-1.25%', isPositive: false, color: getColorForMaterial('MG'), data: [{val: 425}, {val: 420}, {val: 422}, {val: 418}, {val: 416}, {val: 415}] },
        { symbol: 'CU', name: 'Copper Scrap', price: '₹745.80/kg', change: '+3.98%', isPositive: true, color: getColorForMaterial('CU'), data: [{val: 720}, {val: 728}, {val: 735}, {val: 730}, {val: 742}, {val: 745.8}] },
        { symbol: 'MN', name: 'Manganese Flakes', price: '₹188.00/kg', change: '-2.33%', isPositive: false, color: getColorForMaterial('MN'), data: [{val: 195}, {val: 192}, {val: 190}, {val: 191}, {val: 189}, {val: 188}] },
      ];
    }

    if (activeTab === 'scrap') {
      return [
        { symbol: 'TSE', name: 'Tense Scrap', price: '₹182.20/kg', change: '+3.15%', isPositive: true, color: getColorForMaterial('TSE'), data: [{val: 175}, {val: 178}, {val: 176}, {val: 180}, {val: 179}, {val: 182.2}] },
        { symbol: 'TTR', name: 'Tabor Scrap', price: '₹194.50/kg', change: '+4.20%', isPositive: true, color: getColorForMaterial('TTR'), data: [{val: 186}, {val: 189}, {val: 192}, {val: 190}, {val: 193}, {val: 194.5}] },
        { symbol: 'EXT', name: 'Extrusion Scrap', price: '₹208.00/kg', change: '+1.80%', isPositive: true, color: getColorForMaterial('EXT'), data: [{val: 202}, {val: 204}, {val: 205}, {val: 206}, {val: 207}, {val: 208}] },
        { symbol: 'TEL', name: 'Telic Scrap', price: '₹165.00/kg', change: '-0.95%', isPositive: false, color: getColorForMaterial('TEL'), data: [{val: 168}, {val: 167}, {val: 169}, {val: 166}, {val: 165.5}, {val: 165}] },
        { symbol: 'ZIN', name: 'Zinc Dross', price: '₹212.00/kg', change: '-1.85%', isPositive: false, color: getColorForMaterial('ZIN'), data: [{val: 218}, {val: 216}, {val: 215}, {val: 214}, {val: 213}, {val: 212}] },
      ];
    }

    // Default 'trending' tab - computes dynamic rates from actual Cost Ledger
    return defaultAlloys.map(def => {
      // Find actual matching cost entries
      const matching = costEntries.filter(e => (e.alloyType || '').toUpperCase().includes(def.code));
      let currentPrice = def.basePrice;
      let pctChange = 2.45; // base default change
      let isPos = true;
      let chartPoints = def.wave.map(val => ({ val }));

      if (matching.length > 0) {
        // Sort by date descending to get latest
        const sortedMatching = [...matching].sort((a, b) => {
          const ad = a.date ? (a.date.toDate ? a.date.toDate() : new Date(a.date as any)) : new Date(0);
          const bd = b.date ? (b.date.toDate ? b.date.toDate() : new Date(b.date as any)) : new Date(0);
          return bd.getTime() - ad.getTime();
        });
        
        const latest = sortedMatching[0];
        currentPrice = latest.sellingPricePerKg || latest.totalProductionCostPerKg || def.basePrice;

        // Calculate change over previous entry
        if (sortedMatching.length > 1) {
          const prev = sortedMatching[1];
          const prevPrice = prev.sellingPricePerKg || prev.totalProductionCostPerKg || def.basePrice;
          pctChange = ((currentPrice - prevPrice) / prevPrice) * 100;
          isPos = pctChange >= 0;
        }

        // Build chart points from latest entries (up to 6)
        const recentEntries = sortedMatching.slice(0, 6).reverse();
        chartPoints = recentEntries.map(e => ({
          val: e.sellingPricePerKg || e.totalProductionCostPerKg || def.basePrice
        }));
      }

      return {
        symbol: def.code,
        name: def.name,
        price: `₹${currentPrice.toFixed(1)}/kg`,
        change: `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`,
        isPositive: isPos,
        color: def.color,
        data: chartPoints,
      };
    });
  }, [activeTab, costEntries]);

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
      <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5, '&:last-child': { pb: 3 } }}>
        
        {/* Navigation Tabs */}
        <Box sx={{ display: 'flex', gap: 1, borderBottom: '1px solid #f1f5f9', pb: 1.5, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {(['trending', 'materials', 'scrap'] as const).map((tab) => (
            <Button
              key={tab}
              size="small"
              onClick={() => setActiveTab(tab)}
              sx={{
                fontSize: '0.68rem',
                fontWeight: 800,
                textTransform: 'none',
                color: activeTab === tab ? '#0f172a' : '#94a3b8',
                position: 'relative',
                p: '4px 8px',
                minWidth: 0,
                '&::after': activeTab === tab ? {
                  content: '""',
                  position: 'absolute',
                  bottom: -13,
                  left: 0,
                  right: 0,
                  height: 2.5,
                  bgcolor: '#0f172a',
                  borderRadius: 1
                } : {}
              }}
            >
              {tab === 'trending' ? 'Trending Alloys' : tab === 'materials' ? 'Raw Materials' : 'Scrap Rates'}
            </Button>
          ))}
        </Box>

        {/* Alloys List with Sparklines */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, justifyContent: 'center' }}>
          {sparklineData.map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              {/* Badge + Name */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, width: '35%' }}>
                {/* Colored Circle Badge */}
                <Box sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  bgcolor: `${item.color}15`,
                  color: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '0.58rem',
                  flexShrink: 0
                }}>
                  {item.symbol.substring(0, 3)}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e293b' }}>
                    {item.symbol}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: '0.58rem', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {item.name}
                  </Typography>
                </Box>
              </Box>

              {/* Sparkline (Recharts) */}
              <Box sx={{ width: 68, height: 26, display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={item.data}>
                    <Line
                      type="monotone"
                      dataKey="val"
                      stroke={item.isPositive ? '#22c55e' : '#ef4444'}
                      strokeWidth={1.8}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              {/* Price & Change */}
              <Box sx={{ textAlign: 'right', width: '32%' }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>
                  {item.price}
                </Typography>
                <Typography sx={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  color: item.isPositive ? '#22c55e' : '#ef4444',
                  mt: 0.15
                }}>
                  {item.change}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

      </CardContent>
    </Card>
  );
};

export default AlloySparklinesCard;
