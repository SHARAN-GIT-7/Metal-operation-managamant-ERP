import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, Cell } from 'recharts';
import ChartCard from './ChartCard';
import type { DashboardAnalytics } from '../types/dashboard.types';

interface Props {
  analytics: DashboardAnalytics;
  loading: boolean;
}

const OUTPUT_COLOR = '#10b981'; // Emerald
const INPUT_COLOR = '#8b5cf6';  // Violet/Indigo
const TREND_COLOR = '#3b82f6';  // Blue
const HOURS_COLOR = '#f59e0b';  // Amber

const tooltipStyle = {
  contentStyle: { fontSize: '0.72rem', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  labelStyle: { fontWeight: 700, color: '#1e293b' },
};

const axisStyle = { fontSize: '0.65rem', fill: '#94a3b8', fontWeight: 600 };

const ProductionSection = ({ analytics, loading }: Props) => (
  <div>
    <div className="flex items-center gap-2 mb-3 mt-5">
      <div className="w-1 h-5 rounded-full" style={{ background: TREND_COLOR }} />
      <span className="text-sm font-black text-slate-700 uppercase tracking-wider">Production Analytics</span>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* 1. Daily Production Trend */}
      <ChartCard title="Daily Production Trend" subtitle="Good ingots output per day (kg)" loading={loading} empty={analytics.dailyProductionTrend.length === 0} accentColor={TREND_COLOR}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={analytics.dailyProductionTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={TREND_COLOR} stopOpacity={0.18} />
                <stop offset="95%" stopColor={TREND_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}kg`} width={52} />
            <Tooltip {...tooltipStyle} formatter={(v: any) => [`${Number(v).toLocaleString('en-IN')} kg`, 'Production']} />
            <Area type="monotone" dataKey="value" stroke={TREND_COLOR} strokeWidth={2.5} fill="url(#prodGrad)" dot={false} activeDot={{ r: 4, fill: TREND_COLOR }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Input vs Output */}
      <ChartCard title="Input vs Output" subtitle="Total input vs good ingots per heat (kg)" loading={loading} empty={analytics.inputVsOutput.length === 0} accentColor={INPUT_COLOR}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={analytics.inputVsOutput} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: '0.58rem' }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}kg`} width={52} />
            <Tooltip {...tooltipStyle} formatter={(v: any, name: any) => [`${Number(v).toLocaleString('en-IN')} kg`, name]} />
            <Legend wrapperStyle={{ fontSize: '0.68rem', fontWeight: 700 }} />
            <Bar dataKey="value" name="Output" fill={OUTPUT_COLOR} radius={[3, 3, 0, 0]} />
            <Bar dataKey="value2" name="Input" fill={INPUT_COLOR} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. Alloy-wise Production */}
      <ChartCard title="Alloy-wise Production" subtitle="Total good ingots by alloy type (kg)" loading={loading} empty={analytics.alloyWiseProduction.length === 0} accentColor={TREND_COLOR}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart layout="vertical" data={analytics.alloyWiseProduction} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}kg`} />
            <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: '0.68rem' }} axisLine={false} tickLine={false} width={72} />
            <Tooltip {...tooltipStyle} formatter={(v: any) => [`${Number(v).toLocaleString('en-IN')} kg`, 'Production']} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {analytics.alloyWiseProduction.map((entry, idx) => (
                <Cell key={idx} fill={entry.color || TREND_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. Production Hours */}
      <ChartCard title="Production Hours Trend" subtitle="Total shift hours per day" loading={loading} empty={analytics.productionHoursTrend.length === 0} accentColor={HOURS_COLOR}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={analytics.productionHoursTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={HOURS_COLOR} stopOpacity={0.18} />
                <stop offset="95%" stopColor={HOURS_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} width={40} />
            <Tooltip {...tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(1)} hrs`, 'Hours']} />
            <Area type="monotone" dataKey="value" stroke={HOURS_COLOR} strokeWidth={2.5} fill="url(#hoursGrad)" dot={false} activeDot={{ r: 4, fill: HOURS_COLOR }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  </div>
);

export default ProductionSection;
