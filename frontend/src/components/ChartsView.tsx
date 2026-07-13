import { useState, useEffect, useRef } from 'react'
import {
  BarChart2, TrendingUp, PieChart, ScatterChart, AreaChart,
  Loader2, AlertCircle,
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
import { withAttribution, shareOrCopy, printAsPdf, escapeHtml, type SectionShareActions } from '../lib/share'
import SectionComposer from './SectionComposer'
import SectionExtras from './SectionExtras'
import HintTooltip from './Tooltip'
import { chartsSupported } from '../lib/fileSupport'

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
  // Register this section's header actions (Share text / Export PDF) with the shared
  // WorkspaceHeader. Called with the actions once a chart exists, null when there isn't.
  registerActions?: (mode: AppMode, actions: SectionShareActions | null) => void
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

export default function ChartsView({ session, onSwitchMode, engagedModes, onActivity, autoGenerate, registerActions }: Props) {
  const [chartType, setChartType] = useState('bar')
  const [chart, setChart] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // The rendered chart container — its <svg> is serialized into the shared PDF.
  const chartRef = useRef<HTMLDivElement>(null)

  // Whether this file can produce charts (frontend file-type heuristic). When it can't,
  // the Generate button is blurred and a warning line shows above the composer on hover/press.
  const supported = chartsSupported(session)
  const [showUnsupported, setShowUnsupported] = useState(false)

  const activeType = CHART_TYPES.find((c) => c.id === chartType)

  // Auto-generate once on entry when this is the section chosen on the Landing page.
  // The ref guard ensures it fires only the first time, never on a later re-render.
  const didAutoGen = useRef(false)
  useEffect(() => {
    if (autoGenerate && !didAutoGen.current) {
      didAutoGen.current = true
      if (supported) generate()
      else setShowUnsupported(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  // Register the header actions for this section. Export prints the rendered chart
  // (serialized SVG) plus a data table; Share sends the chart's data as text (a chart is
  // visual, so its shareable form is the underlying values). Scatter has (x, y) pairs
  // rather than one value per label, so its table is skipped in the PDF.
  useEffect(() => {
    if (!chart) { registerActions?.('charts', null); return }
    const subtitle = [chart.x_label, chart.y_label].filter(Boolean).join(' · ') || session.documents.map((d) => d.filename).join(', ')
    registerActions?.('charts', {
      share: () => {
        const lines: string[] = [chart.title || 'Chart']
        if (chart.chart_type !== 'scatter') {
          lines.push([chart.x_label || 'Label', ...chart.series.map((s) => s.name)].join('\t'))
          chart.labels.forEach((lab, i) => lines.push([String(lab), ...chart.series.map((s) => String(s.data[i] ?? ''))].join('\t')))
        } else {
          chart.series.forEach((s) => {
            lines.push(s.name)
            ;(s.data as [number, number][]).forEach(([x, y]) => lines.push(`${x}, ${y}`))
          })
        }
        return shareOrCopy(withAttribution(lines.join('\n')), `${chart.title || 'Chart'} — Talktofile`)
      },
      exportPdf: () => {
        const svg = chartRef.current?.querySelector('svg')?.outerHTML ?? ''
        let table = ''
        if (chart.chart_type !== 'scatter') {
          const head = `<tr><th>${escapeHtml(chart.x_label || 'Label')}</th>${chart.series.map((s) => `<th>${escapeHtml(s.name)}</th>`).join('')}</tr>`
          const rows = chart.labels
            .map((lab, i) => `<tr><td>${escapeHtml(String(lab))}</td>${chart.series.map((s) => `<td>${escapeHtml(String(s.data[i] ?? ''))}</td>`).join('')}</tr>`)
            .join('')
          table = `<table>${head}${rows}</table>`
        }
        printAsPdf({ title: chart.title || 'Chart', subtitle, bodyHtml: `${svg}${table}` })
      },
    })
    return () => registerActions?.('charts', null)
  }, [chart, registerActions, session])

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
            <div>
              <h2 className="font-brand font-bold text-xl text-slate-900 dark:text-slate-100">{chart.title}</h2>
              {(chart.x_label || chart.y_label) && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{chart.x_label}{chart.x_label && chart.y_label ? ' · ' : ''}{chart.y_label}</p>
              )}
            </div>

            {/* Chart — kept on a light surface so the Recharts axes/legend stay legible in
                dark mode (their text/grid colours are light-theme defaults). */}
            <div ref={chartRef} className="bg-white rounded-2xl border border-slate-100 p-4 dark:border-slate-700">
              <ChartRenderer chart={chart} />
            </div>

            {error && (
              <p className="text-brand-600 text-sm text-center bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400">{error}</p>
            )}
          </>
        )}

        <SectionExtras show={engagedModes.has('charts')} />
      </div>

      {/* Bottom bar — the shared composer. The chart-type picker takes the place of the
          composer's "Follow-up suggestions" row (via pickerRow), and the wide "Generate
          <Type> Chart" button takes the place of the send button and runs the generation. */}
      <SectionComposer
        active="charts"
        onSwitch={onSwitchMode}
        engaged={engagedModes}
        placeholder="Add specific instructions here."
        pickerRow={
          <div className="px-4 pb-3 pt-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <BarChart2 className="w-3.5 h-3.5 text-brand-500" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chart type</span>
              </div>
              {CHART_TYPES.map(({ id, label, Icon, desc }) => (
                <HintTooltip key={id} label={desc} side="right" className="flex-shrink-0">
                  <button
                    // Blur after a mouse click so the pill doesn't retain focus — otherwise the
                    // Tooltip's focus-within rule keeps the bubble open on the just-selected pill.
                    onClick={(e) => { setChartType(id); e.currentTarget.blur() }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
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
        notice={!supported && showUnsupported ? 'Charts cover spreadsheets only (.xlsx and .csv files).' : undefined}
        proceedButton={
          <button
            onClick={() => { if (!supported) { setShowUnsupported(true); return } generate() }}
            onMouseEnter={() => { if (!supported) setShowUnsupported(true) }}
            onMouseLeave={() => setShowUnsupported(false)}
            disabled={loading}
            aria-label={loading ? 'Generating…' : `${chart ? 'Regenerate' : 'Generate'} ${activeType?.label} Chart`}
            className={`flex items-center justify-center gap-2 h-11 w-11 sm:w-auto px-0 sm:px-5 rounded-xl bg-[#E2611B] text-white text-sm font-medium hover:bg-[#E2611B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0 ${!supported ? 'blur-[1.2px] opacity-60 cursor-not-allowed' : ''}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{loading ? 'Generating…' : `${chart ? 'Regenerate' : 'Generate'} ${activeType?.label} Chart`}</span>
          </button>
        }
      />
    </div>
  )
}
