import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import ChartCard from './ChartCard';
import type { DashboardAnalytics } from '../types/dashboard.types';
import type { InventoryItem, StockStatus } from '../../warehouse/types/warehouse.types';

interface Props {
  analytics: DashboardAnalytics;
  inventoryItems: InventoryItem[];
  loading: boolean;
}

const STOCK_AMBER = '#f59e0b';
const CONSUME_TEAL = '#0d9488';
const SHARE_PURPLE = '#8b5cf6';

const axisStyle = { fontSize: '0.65rem', fill: '#94a3b8', fontWeight: 600 };
const tooltipStyle = {
  contentStyle: { fontSize: '0.72rem', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  labelStyle: { fontWeight: 700, color: '#1e293b' },
};

const StockStatusChip = ({ status }: { status: string }) => {
  const config: Record<string, { color: string; bg: string; border: string }> = {
    'Healthy': { color: '#15803d', bg: '#dcfce7', border: '#86efac' },
    'Low Stock': { color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
    'Critical Stock': { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
    'Out Of Stock': { color: '#7c3aed', bg: '#f3e8ff', border: '#c4b5fd' },
  };
  const c = config[status] ?? config['Healthy'];
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
};

const computeStatus = (current: number, minimum: number): StockStatus => {
  if (current <= 0) return 'Out Of Stock';
  if (current < minimum * 0.5) return 'Critical Stock';
  if (current < minimum) return 'Low Stock';
  return 'Healthy';
};

const InventorySection = ({ analytics, inventoryItems, loading }: Props) => {
  const enrichedItems = inventoryItems.map((item) => ({
    ...item,
    status: computeStatus(item.currentStockKg ?? 0, item.minimumStockKg ?? 0),
  }));

  const lowStock = enrichedItems.filter((i) => i.status === 'Low Stock' || i.status === 'Critical Stock' || i.status === 'Out Of Stock' || (i.currentStockKg ?? 0) <= 0);
  const healthyCount = enrichedItems.filter((i) => i.status === 'Healthy' && (i.currentStockKg ?? 0) > 0).length;
  const criticalCount = enrichedItems.filter((i) => i.status === 'Critical Stock' || i.status === 'Out Of Stock' || (i.currentStockKg ?? 0) <= 0).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 mt-6">
        <div className="w-1 h-5 rounded-full" style={{ background: STOCK_AMBER }} />
        <span className="text-sm font-black text-slate-700 uppercase tracking-wider">Inventory Analytics</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1. Raw Material Stock */}
        <ChartCard title="Raw Material Stock" subtitle="Current stock per material (kg)" loading={loading} empty={analytics.rawMaterialStock.length === 0} accentColor={STOCK_AMBER}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={analytics.rawMaterialStock} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}kg`} />
              <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: '0.68rem' }} axisLine={false} tickLine={false} width={68} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => [`${Number(v).toLocaleString('en-IN')} kg`, 'Current Stock']} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {analytics.rawMaterialStock.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color || STOCK_AMBER} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 2. Material Consumption */}
        <ChartCard title="Material Consumption" subtitle="Materials used in production (kg)" loading={loading} empty={analytics.materialConsumption.length === 0} accentColor={CONSUME_TEAL}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics.materialConsumption} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: '0.6rem' }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}kg`} width={52} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => [`${Number(v).toLocaleString('en-IN')} kg`, 'Consumed']} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {analytics.materialConsumption.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color || CONSUME_TEAL} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 3. Material Share Pie */}
        <ChartCard title="Material Share" subtitle="% contribution of each material to production" loading={loading} empty={analytics.materialShare.length === 0} accentColor={SHARE_PURPLE}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={analytics.materialShare}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={90}
                innerRadius={48}
                paddingAngle={2}
                label={({ name, percent }) => percent !== undefined && percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                {analytics.materialShare.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color || SHARE_PURPLE} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v: any, name: any) => [
                `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`,
                name,
              ]} />
              <Legend wrapperStyle={{ fontSize: '0.65rem', fontWeight: 600 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 4. Low Stock Alerts */}
        <ChartCard title="Stock Alerts" subtitle={`${healthyCount} healthy · ${lowStock.length} need attention`} loading={loading} empty={false} accentColor="#c62828">
          {loading ? (
            <Box sx={{ height: 260 }} />
          ) : (
            <Box sx={{ height: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5, pr: 0.5 }}>
              {/* Summary badges */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Chip label={`${healthyCount} Healthy`} size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, bgcolor: '#dcfce7', color: '#15803d', height: 22, border: '1px solid #86efac' }} icon={<CheckCircle2 size={10} style={{ color: '#15803d' }} />} />
                {criticalCount > 0 && (
                  <Chip label={`${criticalCount} Critical`} size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, bgcolor: '#fee2e2', color: '#dc2626', height: 22, border: '1px solid #fca5a5' }} icon={<AlertTriangle size={10} style={{ color: '#dc2626' }} />} />
                )}
              </Box>

              {lowStock.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
                  <CheckCircle2 size={32} style={{ color: '#15803d' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>All stock levels healthy!</Typography>
                </Box>
              ) : (
                lowStock.map((item) => (
                  <Card key={item.id} sx={{ borderRadius: 2, border: '1px solid #fee2e2', bgcolor: '#fff8f8', flexShrink: 0 }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b' }}>
                          {item.materialCode}
                        </Typography>
                        <StockStatusChip status={item.status} />
                      </Box>
                      <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500, mb: 0.25 }}>
                        {item.materialName}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626' }}>
                          Stock: {item.currentStockKg.toLocaleString('en-IN')} kg
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>
                          Min: {item.minimumStockKg.toLocaleString('en-IN')} kg
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>
          )}
        </ChartCard>

      </div>
    </div>
  );
};

export default InventorySection;
