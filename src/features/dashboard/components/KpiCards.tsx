import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material';
import {
  Factory, Package, Layers, TrendingUp, Inbox, Truck,
  IndianRupee, Clock, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import type { KpiData } from '../types/dashboard.types';

const ICONS: Record<string, React.ReactNode> = {
  factory: <Factory size={18} />,
  package: <Package size={18} />,
  layers: <Layers size={18} />,
  trending: <TrendingUp size={18} />,
  inbox: <Inbox size={18} />,
  truck: <Truck size={18} />,
  rupee: <IndianRupee size={18} />,
  clock: <Clock size={18} />,
  check: <CheckCircle2 size={18} />,
};

const formatValue = (kpi: KpiData): string => {
  const v = kpi.value;
  if (kpi.format === 'weight') {
    if (v >= 1000) return (v / 1000).toFixed(2) + ' T';
    return v.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' kg';
  }
  if (kpi.format === 'percent') return v.toFixed(1) + '%';
  if (kpi.format === 'currency') return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (kpi.format === 'hours') return v.toFixed(1) + ' hrs';
  return v.toLocaleString('en-IN');
};

const calcChange = (curr: number, prev: number): number => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};

interface KpiCardProps {
  kpi: KpiData;
  loading: boolean;
}

const KpiCard = ({ kpi, loading }: KpiCardProps) => {
  const change = calcChange(kpi.value, kpi.prevValue);
  const isPositive = change >= 0;
  const isNeutral = Math.abs(change) < 0.1;
  const changeColor = isNeutral ? '#64748b' : isPositive ? '#15803d' : '#dc2626';
  const ChangIcon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <Card sx={{
      borderRadius: 1.5,
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      border: '1px solid #e2e8f0',
      height: '100%',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Left accent */}
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: kpi.color }} />

      <CardContent sx={{ pl: 3, pr: 2.5, py: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Icon + label */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 1.3 }}>
            {kpi.label}
          </Typography>
          <Box sx={{ p: 1, borderRadius: 2, background: `${kpi.color}18`, color: kpi.color, display: 'flex', flexShrink: 0 }}>
            {ICONS[kpi.icon]}
          </Box>
        </Box>

        {/* Value */}
        {loading ? (
          <Skeleton width={100} height={36} />
        ) : (
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: -0.5, lineHeight: 1.1 }}>
            {formatValue(kpi)}
          </Typography>
        )}

        {/* Trend */}
        {loading ? (
          <Skeleton width={80} height={16} sx={{ mt: 1 }} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            <Box sx={{ color: changeColor, display: 'flex', alignItems: 'center' }}>
              <ChangIcon size={13} />
            </Box>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: changeColor }}>
              {isNeutral ? '—' : `${Math.abs(change).toFixed(1)}%`}
            </Typography>
            {!isNeutral && (
              <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>
                vs prev period
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

interface Props {
  kpis: KpiData[];
  loading: boolean;
}

const KpiCards = ({ kpis, loading }: Props) => (
  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
    {kpis.map((kpi) => (
      <KpiCard key={kpi.label} kpi={kpi} loading={loading} />
    ))}
  </div>
);

export default KpiCards;
