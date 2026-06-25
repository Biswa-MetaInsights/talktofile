import { useState } from 'react'
import {
  BarChart2, TrendingUp, PieChart, ScatterChart, AreaChart,
  Loader2, MessageSquare, RefreshCw, AlertCircle,
} from 'lucide-react'
import {
  BarChart, LineChart, AreaChart as RechartsArea, PieChart as RechartsPie,
  ScatterChart as RechartsScatter,
  Bar, Line, Area, Pie, Cell, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { SessionInfo } from '../types'
import type { ChartData } from '../api/client'
import { toolsApi } from '../api/client'

interface Props {
  session: SessionInfo
  onStartChat: () => void
}

const CHART_TYPES = [
  { id: 'bar',     label: 'Bar',     Icon: BarChart2,    desc: 'Compare values across categories' },
  { id: 'line',    label: 'Line',    Icon: TrendingUp,   desc: 'Show trends over time or sequence' },
  { id: 'area',    label: 'Area',    Icon: AreaChart,    desc: 'Cumulative trends and volumes' },
  { id: 'pie',     label: 'Pie',     Icon: PieChart,     desc: 'Part-to-whole proportions' },
  { id: 'scatter', label: 'Scatter', Icon: ScatterChart, desc: 'Correlation between two variables' },
]

const PALETTE = ['#E60026', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

function buildRechartsData(chart: ChartData) {
  return chart.labels.map((label, i) => {
    const row: Record<string, number | string> = { name: label }
    chart.series.forEach((s) => {
      const val = s.data[i]
      row[s.name] = typeof val === 'number' ? val : 0
    })
    return row
  })
}

function buildPieData(chart: ChartData) {
  const values = chart.series[0]?.data ?? []
  return chart.labels.map((label, i) => ({
    name: label,
    value: typeof values[i] === 'number' ? values[i] as number : 0,
  }))
}

function buildScatterData(series: ChartData['series'][0]) {
  return (series.data as [number, number][]).map(([x, y]) => ({ x, y }))
}

function ChartRenderer({ chart }: { chart: ChartData }) {
  const data = buildRechartsData(chart)
  const commonProps = { data, margin: { top: 8, right: 16, bottom: 8, left: 8 } }

  if (chart.chart_type === 'bar') return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis label={{ value: chart.y_label, angle: -90, position: 'insideLeft', offset: -4, style: { fontSize: 11 } }} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {chart.series.map((s, i) => <Bar key={s.name} dataKey={s.name} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  )

  if (chart.chart_type === 'line') return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis label={{ value: chart.y_label, angle: -90, position: 'insideLeft', offset: -4, style: { fontSize: 11 } }} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {chart.series.map((s, i) => <Line key={s.name} dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} />)}
      </LineChart>
    </ResponsiveContainer>
  )

  if (chart.chart_type === 'area') return (
    <ResponsiveContainer width="100%" height={360}>
      <RechartsArea {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis label={{ value: chart.y_label, angle: -90, position: 'insideLeft', offset: -4, style: { fontSize: 11 } }} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {chart.series.map((s, i) => (
          <Area key={s.name} dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length] + '33'} strokeWidth={2} />
        ))}
      </RechartsArea>
    </ResponsiveContainer>
  )

  if (chart.chart_type === 'pie') return (
    <ResponsiveContainer width="100%" height={360}>
      <RechartsPie>
        <Pie data={buildPieData(chart)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={140} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}>
          {buildPieData(chart).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </RechartsPie>
    </ResponsiveContainer>
  )

  if (chart.chart_type === 'scatter') return (
    <ResponsiveContainer width="100%" height={360}>
      <RechartsScatter margin={commonProps.margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="x" name={chart.x_label} tick={{ fontSize: 12 }} label={{ value: chart.x_label, position: 'insideBottom', offset: -4, style: { fontSize: 11 } }} />
        <YAxis dataKey="y" name={chart.y_label} label={{ value: chart.y_label, angle: -90, position: 'insideLeft', offset: -4, style: { fontSize: 11 } }} tick={{ fontSize: 12 }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Legend />
        {chart.series.map((s, i) => (
          <Scatter key={s.name} name={s.name} data={buildScatterData(s)} fill={PALETTE[i % PALETTE.length]} />
        ))}
      </RechartsScatter>
    </ResponsiveContainer>
  )

  return null
}

export default function ChartsView({ session, onStartChat }: Props) {
  const [chartType, setChartType] = useState('bar')
  const [chart, setChart] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await toolsApi.chart(session.session_id, chartType)
      setChart(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate chart. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Loader2 className="w-8 h-8 text-[#E60026] animate-spin" />
      <p className="text-slate-600 text-sm">Analysing your data…</p>
    </div>
  )

  if (!chart) return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#E60026]/10 flex items-center justify-center">
        <BarChart2 className="w-8 h-8 text-[#E60026]" />
      </div>
      <div>
        <h2 className="font-brand font-bold text-xl text-slate-900 mb-2">Visualise Your Data</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          Choose a chart type and we'll turn your spreadsheet into a visual. Works with Excel (.xlsx) and CSV files.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-sm text-left">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-md">
        {CHART_TYPES.map(({ id, label, Icon, desc }) => (
          <button
            key={id}
            onClick={() => setChartType(id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
              chartType === id
                ? 'border-[#E60026] bg-[#E60026]/5 text-[#E60026]'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-[10px] text-slate-400 leading-tight">{desc}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={generate}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E60026] text-white font-medium text-sm hover:bg-[#E60026]/90 transition-all shadow-md shadow-[#E60026]/20"
        >
          <BarChart2 className="w-4 h-4" /> Generate {CHART_TYPES.find(c => c.id === chartType)?.label} Chart
        </button>
        <button onClick={onStartChat} className="text-sm text-slate-500 hover:text-[#E60026] flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4" /> Chat with your data instead
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-brand font-bold text-xl text-slate-900">{chart.title}</h2>
          {(chart.x_label || chart.y_label) && (
            <p className="text-xs text-slate-400 mt-0.5">{chart.x_label}{chart.x_label && chart.y_label ? ' · ' : ''}{chart.y_label}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChart(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E60026] hover:text-[#E60026] transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Change chart
          </button>
          <button
            onClick={onStartChat}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E60026] hover:text-[#E60026] transition-all"
          >
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
        </div>
      </div>

      {/* Chart type switcher */}
      <div className="flex gap-2 flex-wrap">
        {CHART_TYPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => { setChartType(id); setChart(null) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              chart.chart_type === id
                ? 'border-[#E60026] bg-[#E60026]/5 text-[#E60026]'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <ChartRenderer chart={chart} />
      </div>

      {error && (
        <p className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}
    </div>
  )
}
