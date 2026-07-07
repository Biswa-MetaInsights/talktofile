import { useState, useEffect, useRef } from 'react'
import {
  BarChart2, TrendingUp, PieChart, ScatterChart, AreaChart,
  Loader2, MessageSquare, AlertCircle,
} from 'lucide-react'
import {
  BarChart, LineChart, AreaChart as RechartsArea, PieChart as RechartsPie,
  ScatterChart as RechartsScatter,
  Bar, Line, Area, Pie, Cell, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { SessionInfo, AppMode } from '../types'
import type { ChartData } from '../api/client'
import { toolsApi } from '../api/client'
import SectionComposer from './SectionComposer'
import HintTooltip from './Tooltip'

interface Props {
  session: SessionInfo
  // Feature-tab switching (this section renders its own bottom bar with the tabs,
  // instead of the shared WorkspaceComposer — like Translate).
  onSwitchMode: (mode: AppMode) => void
  engagedModes: Set<AppMode>
  // Fire once a chart has been generated, so this section earns its "pick up where you
  // left off" star.
  onActivity?: () => void
  // When true, generate immediately on mount — the user picked this section on the
  // Landing page and proceeded, so the "Generate chart" step is redundant the first
  // time. Only the landing-selected section gets this; switching in via a tab does not
  // (it keeps the manual button). Uses the default chart type ('bar').
  autoGenerate?: boolean
}

const CHART_TYPES = [
  { id: 'bar',     label: 'Bar',     Icon: BarChart2,    desc: 'Compare values across categories' },
  { id: 'line',    label: 'Line',    Icon: TrendingUp,   desc: 'Show trends over time or sequence' },
  { id: 'area',    label: 'Area',    Icon: AreaChart,    desc: 'Cumulative trends and volumes' },
  { id: 'pie',     label: 'Pie',     Icon: PieChart,     desc: 'Part-to-whole proportions' },
  { id: 'scatter', label: 'Scatter', Icon: ScatterChart, desc: 'Correlation between two variables' },
]

const PALETTE = ['#E2611B', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

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

export default function ChartsView({ session, onSwitchMode, engagedModes, onActivity, autoGenerate }: Props) {
  const [chartType, setChartType] = useState('bar')
  const [chart, setChart] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeType = CHART_TYPES.find((c) => c.id === chartType)

  // Auto-generate once on entry when this is the section chosen on the Landing page.
  // The ref guard ensures it fires only the first time, never on a later re-render.
  const didAutoGen = useRef(false)
  useEffect(() => {
    if (autoGenerate && !didAutoGen.current) {
      didAutoGen.current = true
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await toolsApi.chart(session.session_id, chartType)
      setChart(res.data)
      onActivity?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate chart. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content — scrolls above the pinned bottom bar */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-8 h-8 text-[#E2611B] animate-spin" />
            <p className="text-slate-600 dark:text-slate-300 text-sm">Analysing your data…</p>
          </div>
        )}

        {!chart && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#E2611B]/10 flex items-center justify-center">
              <BarChart2 className="w-8 h-8 text-[#E2611B]" />
            </div>
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">Visualise Your Data</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Pick a chart type below and we'll turn your spreadsheet into a visual. Works with Excel (.xlsx) and CSV files.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 max-w-sm text-left dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {chart && !loading && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100">{chart.title}</h2>
                {(chart.x_label || chart.y_label) && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{chart.x_label}{chart.x_label && chart.y_label ? ' · ' : ''}{chart.y_label}</p>
                )}
              </div>
              <button
                onClick={() => onSwitchMode('chat')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#E2611B] hover:text-[#E2611B] transition-all dark:border-slate-700 dark:text-slate-300"
              >
                <MessageSquare className="w-4 h-4" /> Chat
              </button>
            </div>

            {/* Chart — kept on a light surface so the Recharts axes/legend stay legible in
                dark mode (their text/grid colours are light-theme defaults). */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 dark:border-slate-700">
              <ChartRenderer chart={chart} />
            </div>

            {error && (
              <p className="text-brand-600 text-sm text-center bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">{error}</p>
            )}
          </>
        )}
      </div>

      {/* Bottom bar — the shared composer. The chart-type picker takes the place of the
          composer's "Follow-up suggestions" row (via pickerRow), and the wide "Generate
          <Type> Chart" button takes the place of the send button and runs the generation. */}
      <SectionComposer
        active="charts"
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder="Add your preferences here."
        pickerRow={
          <div className="px-4 pb-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 mb-2 pt-3">
              <BarChart2 className="w-3.5 h-3.5 text-brand-500" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chart type</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {CHART_TYPES.map(({ id, label, Icon, desc }) => (
                <HintTooltip key={id} label={desc} side="right">
                  <button
                    // Blur after a mouse click so the pill doesn't retain focus — otherwise the
                    // Tooltip's focus-within rule keeps the bubble open on the just-selected pill.
                    onClick={(e) => { setChartType(id); e.currentTarget.blur() }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      chartType === id
                        ? 'bg-[#E2611B] text-white border-[#E2611B]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#E2611B] hover:text-[#E2611B] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                </HintTooltip>
              ))}
            </div>
          </div>
        }
        proceedButton={
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            {loading ? 'Generating…' : `${chart ? 'Regenerate' : 'Generate'} ${activeType?.label} Chart`}
          </button>
        }
      />
    </div>
  )
}
