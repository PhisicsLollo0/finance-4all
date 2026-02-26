import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconChartLine,
  IconChevronDown,
  IconFlame,
  IconInfoCircle,
  IconScale,
  IconShieldCheck,
  IconStars,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react'
import type { Data, Layout } from 'plotly.js'
import Plot from 'react-plotly.js'

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────────────────────── */
interface PortfolioMeta {
  id: string
  label: string
  description: string
  group: string
}

interface SeriesData {
  annualised: number[]
  total: number[]
  dates: string[]
  sharpe: number[]
  max_drawdown: number[]
  time_underwater: number[]
}

interface DistributionData {
  values: number[]
  median: number
  p5: number
  p95: number
  mean: number
  sharpe_median: number
  sharpe_mean: number
  max_drawdown_median: number
  max_drawdown_worst: number
  time_underwater_median: number
  time_underwater_worst: number
}

interface RollingResult {
  series: Record<string, SeriesData>
  distributions: Record<string, DistributionData>
  years: number
}

/* ─────────────────────────────────────────────────────────────────────────────
   COLOUR PALETTE — 14 distinct colours for up to 14 portfolios
   ───────────────────────────────────────────────────────────────────────────── */
const PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
  '#a855f7', // purple
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
]

/* ─────────────────────────────────────────────────────────────────────────────
   HELPER — parse curvo-style "MM/YYYY" dates to JS Date strings
   ───────────────────────────────────────────────────────────────────────────── */
function parseDate(d: string): string {
  const [mm, yyyy] = d.split('/')
  return `${yyyy}-${mm}-01`
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────────────────────── */
export default function RollingReturns() {
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'
  const computedScheme = useComputedColorScheme('light')

  /* ── Chart colour tokens ── */
  const chartTokens = useMemo(() => {
    if (typeof document === 'undefined') {
      return { text: '#1f2937', grid: 'rgba(148,163,184,0.25)', zero: 'rgba(148,163,184,0.55)' }
    }
    const s = getComputedStyle(document.documentElement)
    return {
      text: s.getPropertyValue('--mantine-color-text').trim() || '#1f2937',
      grid: s.getPropertyValue('--mantine-color-gray-4').trim() || 'rgba(148,163,184,0.25)',
      zero: s.getPropertyValue('--mantine-color-gray-6').trim() || 'rgba(148,163,184,0.55)',
    }
  }, [computedScheme])

  /* ── State ── */
  const [catalogueLoading, setCatalogueLoading] = useState(true)
  const [catalogue, setCatalogue] = useState<PortfolioMeta[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(['80_20_World', '100_2factors_EUR'])
  const [years, setYears] = useState<string>('15')
  const [mode, setMode] = useState<'annualised' | 'total'>('annualised')
  const [result, setResult] = useState<RollingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ── Load catalogue once ── */
  useEffect(() => {
    fetch(`${apiBase}/rolling-returns/portfolios`)
      .then((r) => r.json())
      .then((data: PortfolioMeta[]) => {
        setCatalogue(data)
        setCatalogueLoading(false)
      })
      .catch(() => setCatalogueLoading(false))
  }, [apiBase])

  /* ── Toggle all portfolios in a group ── */
  const toggleGroup = useCallback(
    (groupIds: string[]) => {
      setSelectedIds((prev) => {
        const allSelected = groupIds.every((id) => prev.includes(id))
        if (allSelected) {
          return prev.filter((id) => !groupIds.includes(id))
        }
        return [...new Set([...prev, ...groupIds])]
      })
    },
    []
  )

  /* ── Fetch rolling returns when selection changes ── */
  useEffect(() => {
    if (selectedIds.length === 0) {
      setResult(null)
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams()
    selectedIds.forEach((id) => params.append('portfolios', id))
    params.set('years', years)

    setLoading(true)
    setError(null)
    fetch(`${apiBase}/rolling-returns/compute?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('API error')
        return r.json()
      })
      .then((data: RollingResult) => setResult(data))
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setError('Unable to load rolling returns.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [apiBase, selectedIds, years])

  /* ── Toggle portfolio ── */
  const togglePortfolio = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }, [])

  /* ── Plotly base layout ── */
  const baseLayout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      margin: { l: 70, r: 35, t: 40, b: 60 },
      legend: {
        orientation: 'h' as const,
        y: 1.12,
        x: 0,
        font: { color: chartTokens.text, size: 12 },
      },
      xaxis: {
        title: { text: 'Start date of rolling window' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
        ticks: 'outside',
        ticklen: 6,
        tickcolor: chartTokens.zero,
      },
      yaxis: {
        title: { text: mode === 'annualised' ? 'Annualised Return (%)' : 'Total Return (%)' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
        ticks: 'outside',
        ticklen: 6,
        tickcolor: chartTokens.zero,
        tickformat: '.1f',
        ticksuffix: '%',
      },
      font: { color: chartTokens.text, family: 'Inter, system-ui, sans-serif' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      uirevision: 'static',
    }),
    [chartTokens, mode]
  )

  /* ── Build line plot data ── */
  const linePlotData = useMemo<Data[]>(() => {
    if (!result) return []
    const labels = Object.keys(result.series)
    return labels.map((label, i) => {
      const s = result.series[label]
      const yData = mode === 'annualised' ? s.annualised : s.total
      return {
        x: s.dates.map(parseDate),
        y: yData.map((v) => v * 100),
        type: 'scatter' as const,
        mode: 'lines',
        line: { color: PALETTE[i % PALETTE.length], width: 2.5 },
        name: label,
        hovertemplate: `<b>${label}</b><br>Date: %{x|%b %Y}<br>Return: %{y:.2f}%<extra></extra>`,
      }
    })
  }, [result, mode])

  /* ── Build violin/box distribution data ── */
  const violinPlotData = useMemo<Data[]>(() => {
    if (!result) return []
    const labels = Object.keys(result.distributions)
    return labels.map((label, i) => ({
      type: 'violin' as const,
      y: result.distributions[label].values.map((v) => v * 100),
      name: label,
      box: { visible: true },
      meanline: { visible: true },
      line: { color: PALETTE[i % PALETTE.length] },
      points: 'all',
      jitter: 0.3,
      pointpos: -1.5,
      marker: { size: 3, opacity: 0.4 },
      hovertemplate: `<b>${label}</b><br>Return: %{y:.2f}%<extra></extra>`,
    }))
  }, [result])

  const violinLayout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      margin: { l: 70, r: 35, t: 40, b: 100 },
      legend: {
        orientation: 'h' as const,
        y: 1.1,
        x: 0,
        font: { color: chartTokens.text, size: 12 },
      },
      xaxis: {
        gridcolor: chartTokens.grid,
        color: chartTokens.text,
      },
      yaxis: {
        title: { text: 'Annualised Return (%)' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
        tickformat: '.1f',
        ticksuffix: '%',
      },
      font: { color: chartTokens.text, family: 'Inter, system-ui, sans-serif' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      violinmode: 'group',
      uirevision: 'static',
    }),
    [chartTokens]
  )

  const plotConfig = useMemo(() => ({ responsive: true, displayModeBar: false }), [])

  /* ── Group portfolios ── */
  const spectrumPortfolios = catalogue.filter((p) => p.group === 'spectrum')
  const classicPortfolios = catalogue.filter((p) => p.group === 'classic')
  const factorPortfolios = catalogue.filter((p) => p.group === 'factor')

  /* ── Distribution stats cards ── */
  const distCards = useMemo(() => {
    if (!result) return []
    return Object.entries(result.distributions).map(([label, d], i) => ({
      label,
      color: PALETTE[i % PALETTE.length],
      median: d.median,
      p5: d.p5,
      p95: d.p95,
      mean: d.mean,
      sharpe_median: d.sharpe_median,
      sharpe_mean: d.sharpe_mean,
      max_drawdown_median: d.max_drawdown_median,
      max_drawdown_worst: d.max_drawdown_worst,
      time_underwater_median: d.time_underwater_median,
      time_underwater_worst: d.time_underwater_worst,
    }))
  }, [result])

  /* ── Build Sharpe ratio plot data ── */
  const sharpePlotData = useMemo<Data[]>(() => {
    if (!result) return []
    return Object.entries(result.series).map(([label, s], i) => ({
      x: s.dates.map(parseDate),
      y: s.sharpe,
      type: 'scatter' as const,
      mode: 'lines',
      line: { color: PALETTE[i % PALETTE.length], width: 2.5 },
      name: label,
      hovertemplate: `<b>${label}</b><br>Date: %{x|%b %Y}<br>Sharpe: %{y:.2f}<extra></extra>`,
    }))
  }, [result])

  /* ── Build Max Drawdown plot data ── */
  const mddPlotData = useMemo<Data[]>(() => {
    if (!result) return []
    return Object.entries(result.series).map(([label, s], i) => ({
      x: s.dates.map(parseDate),
      y: s.max_drawdown.map((v) => v * 100),
      type: 'scatter' as const,
      mode: 'lines',
      line: { color: PALETTE[i % PALETTE.length], width: 2.5 },
      name: label,
      hovertemplate: `<b>${label}</b><br>Date: %{x|%b %Y}<br>Max Drawdown: %{y:.1f}%<extra></extra>`,
    }))
  }, [result])

  /* ── Build Time Underwater plot data ── */
  const underwaterPlotData = useMemo<Data[]>(() => {
    if (!result) return []
    return Object.entries(result.series).map(([label, s], i) => ({
      x: s.dates.map(parseDate),
      y: s.time_underwater,
      type: 'scatter' as const,
      mode: 'lines',
      line: { color: PALETTE[i % PALETTE.length], width: 2.5 },
      name: label,
      hovertemplate: `<b>${label}</b><br>Date: %{x|%b %Y}<br>Months underwater: %{y}<extra></extra>`,
    }))
  }, [result])

  /* ── Metric-specific layouts ── */
  const sharpeLayout = useMemo<Partial<Layout>>(
    () => ({
      ...baseLayout,
      yaxis: {
        ...baseLayout.yaxis,
        title: { text: 'Sharpe Ratio' },
        tickformat: '.2f',
        ticksuffix: '',
      },
    }),
    [baseLayout]
  )

  const mddLayout = useMemo<Partial<Layout>>(
    () => ({
      ...baseLayout,
      yaxis: {
        ...baseLayout.yaxis,
        title: { text: 'Max Drawdown (%)' },
        tickformat: '.0f',
        ticksuffix: '%',
      },
    }),
    [baseLayout]
  )

  const underwaterLayout = useMemo<Partial<Layout>>(
    () => ({
      ...baseLayout,
      yaxis: {
        ...baseLayout.yaxis,
        title: { text: 'Months Underwater' },
        tickformat: 'd',
        ticksuffix: '',
      },
    }),
    [baseLayout]
  )

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <Container size="lg" py="xl">
      <Stack gap={rem(48)}>
        {/* ── NAV ── */}
        <Group justify="space-between" align="center">
          <Button
            variant="subtle"
            component={Link}
            to="/"
            leftSection={
              <IconChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
            }
          >
            Back
          </Button>
          <Badge variant="light" color="orange" size="lg">
            Finance 4 All
          </Badge>
        </Group>

        {/* ── HERO ── */}
        <Stack gap="md" align="center" ta="center">
          <Badge variant="dot" color="violet" size="xl">
            Rolling Returns Analysis
          </Badge>
          <Title
            order={1}
            style={{
              fontSize: 'clamp(1.8rem, 5vw, 3.2rem)',
              lineHeight: 1.1,
              maxWidth: 700,
            }}
          >
            How did portfolios{' '}
            <Text span c="violet" inherit>
              actually perform
            </Text>
            ?
          </Title>
          <Text c="dimmed" size="lg" maw={620}>
            Explore rolling annualised and total returns for different portfolio
            allocations using historical MSCI and FTSE index data going back to
            the 1970s. Select portfolios, pick a time horizon, and see the full
            distribution of outcomes.
          </Text>
        </Stack>

        {/* ══════════════════════════════════════════════════════════════════
            PORTFOLIO SELECTION
            ══════════════════════════════════════════════════════════════════ */}
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {/* ── Stock/Bond Spectrum ── */}
          <Card withBorder radius="lg" p="lg">
            <Group gap="xs" mb={4}>
              <ThemeIcon color="blue" variant="light" size="md" radius="xl">
                <IconScale size={15} />
              </ThemeIcon>
              <Title order={3} size="h4">
                Stock / Bond Ratio
              </Title>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Same two indices (MSCI World + Bonds) at different mixes.
              See how the equity percentage alone drives risk and return.
            </Text>
            <Divider mb="sm" />
            {catalogueLoading ? (
              <Loader size="sm" />
            ) : (
              <Stack gap="xs">
                <Checkbox
                  label="Select all"
                  checked={spectrumPortfolios.every((p) => selectedIds.includes(p.id))}
                  indeterminate={
                    spectrumPortfolios.some((p) => selectedIds.includes(p.id)) &&
                    !spectrumPortfolios.every((p) => selectedIds.includes(p.id))
                  }
                  onChange={() => toggleGroup(spectrumPortfolios.map((p) => p.id))}
                  color="blue"
                  fw={600}
                />
                <Divider variant="dashed" />
                {spectrumPortfolios.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={p.label}
                    description={p.description}
                    checked={selectedIds.includes(p.id)}
                    onChange={() => togglePortfolio(p.id)}
                    color="blue"
                  />
                ))}
              </Stack>
            )}
          </Card>

          {/* ── Classic Allocations ── */}
          <Card withBorder radius="lg" p="lg">
            <Group gap="xs" mb={4}>
              <ThemeIcon color="teal" variant="light" size="md" radius="xl">
                <IconTrendingUp size={15} />
              </ThemeIcon>
              <Title order={3} size="h4">
                Classic Allocations
              </Title>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Well-known portfolio templates using broad market indices
              (MSCI World or ACWI) combined with bonds.
            </Text>
            <Divider mb="sm" />
            {catalogueLoading ? (
              <Loader size="sm" />
            ) : (
              <Stack gap="xs">
                <Checkbox
                  label="Select all"
                  checked={classicPortfolios.every((p) => selectedIds.includes(p.id))}
                  indeterminate={
                    classicPortfolios.some((p) => selectedIds.includes(p.id)) &&
                    !classicPortfolios.every((p) => selectedIds.includes(p.id))
                  }
                  onChange={() => toggleGroup(classicPortfolios.map((p) => p.id))}
                  color="teal"
                  fw={600}
                />
                <Divider variant="dashed" />
                {classicPortfolios.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={p.label}
                    description={p.description}
                    checked={selectedIds.includes(p.id)}
                    onChange={() => togglePortfolio(p.id)}
                    color="teal"
                  />
                ))}
              </Stack>
            )}
          </Card>

          {/* ── Factor Tilted ── */}
          <Card withBorder radius="lg" p="lg">
            <Group gap="xs" mb={4}>
              <ThemeIcon color="violet" variant="light" size="md" radius="xl">
                <IconStars size={15} />
              </ThemeIcon>
              <Title order={3} size="h4">
                Factor Tilted
              </Title>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Add exposure to academic risk factors — small-cap value,
              momentum, or EUR home bias — for potentially higher returns.
            </Text>
            <Divider mb="sm" />
            {catalogueLoading ? (
              <Loader size="sm" />
            ) : (
              <Stack gap="xs">
                <Checkbox
                  label="Select all"
                  checked={factorPortfolios.every((p) => selectedIds.includes(p.id))}
                  indeterminate={
                    factorPortfolios.some((p) => selectedIds.includes(p.id)) &&
                    !factorPortfolios.every((p) => selectedIds.includes(p.id))
                  }
                  onChange={() => toggleGroup(factorPortfolios.map((p) => p.id))}
                  color="violet"
                  fw={600}
                />
                <Divider variant="dashed" />
                {factorPortfolios.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={p.label}
                    description={p.description}
                    checked={selectedIds.includes(p.id)}
                    onChange={() => togglePortfolio(p.id)}
                    color="violet"
                  />
                ))}
              </Stack>
            )}
          </Card>
        </SimpleGrid>

        {/* ── CONTROLS ── */}
        <Card withBorder shadow="sm" radius="lg" p="lg">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Investment Horizon (rolling window)
              </Text>
              <SegmentedControl
                value={years}
                onChange={setYears}
                data={[
                  { label: '5y', value: '5' },
                  { label: '10y', value: '10' },
                  { label: '15y', value: '15' },
                  { label: '20y', value: '20' },
                  { label: '25y', value: '25' },
                  { label: '30y', value: '30' },
                  { label: '35y', value: '35' },
                  { label: '40y', value: '40' },
                ]}
                color="violet"
              />
            </Stack>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Return type
              </Text>
              <SegmentedControl
                value={mode}
                onChange={(v) => setMode(v as 'annualised' | 'total')}
                data={[
                  { label: 'Annualised', value: 'annualised' },
                  { label: 'Total', value: 'total' },
                ]}
                color="violet"
              />
            </Stack>
          </SimpleGrid>
        </Card>

        {/* ── STATUS ── */}
        {loading && (
          <Group justify="center">
            <Loader color="violet" />
            <Text c="dimmed" size="sm">
              Computing rolling returns…
            </Text>
          </Group>
        )}
        {error && (
          <Paper withBorder p="md" radius="md" style={{ borderColor: '#ef4444' }}>
            <Text c="red" size="sm">
              {error}
            </Text>
          </Paper>
        )}
        {selectedIds.length === 0 && !loading && (
          <Paper withBorder p="md" radius="md">
            <Text c="dimmed" size="sm">
              Select at least one portfolio above to see results.
            </Text>
          </Paper>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            LINE CHART — ROLLING RETURNS OVER TIME
            ══════════════════════════════════════════════════════════════════ */}
        {result && Object.keys(result.series).length > 0 && (
          <Card withBorder shadow="md" radius="lg" p="lg">
            <Stack gap="xs" mb="md">
              <Group gap="xs">
                <ThemeIcon color="violet" variant="light" size="md" radius="xl">
                  <IconChartLine size={15} />
                </ThemeIcon>
                <Title order={2} size="h3">
                  {mode === 'annualised' ? 'Annualised' : 'Total'} Returns —{' '}
                  {years}‑Year Rolling Window
                </Title>
              </Group>
              <Text size="sm" c="dimmed">
                Each point represents the {mode === 'annualised' ? 'annualised' : 'total'}{' '}
                return of a portfolio over the {years} years starting at that date.
              </Text>
            </Stack>

            <div className="plot-wrapper">
              <Plot
                data={linePlotData}
                layout={baseLayout}
                config={plotConfig}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* explainer */}
            <Paper
              radius="md"
              p="sm"
              mt="md"
              withBorder
              style={{
                background: 'rgba(139,92,246,0.04)',
                borderColor: 'rgba(139,92,246,0.3)',
              }}
            >
              <Group gap="xs">
                <IconInfoCircle size={16} color="#8b5cf6" />
                <Text size="xs" c="dimmed">
                  <Text span fw={600}>How to read this:</Text> If the line is at
                  5% on Jan 2000 with a 15-year window, it means investing in
                  that portfolio from Jan 2000 to Jan 2015 would have produced a{' '}
                  {mode === 'annualised'
                    ? '5% average annual return'
                    : '5% total return'}
                  .
                </Text>
              </Group>
            </Paper>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DISTRIBUTION — VIOLIN PLOTS
            ══════════════════════════════════════════════════════════════════ */}
        {result && Object.keys(result.distributions).length > 0 && (
          <Card withBorder shadow="md" radius="lg" p="lg">
            <Stack gap="xs" mb="md">
              <Group gap="xs">
                <ThemeIcon color="violet" variant="light" size="md" radius="xl">
                  <IconTrendingUp size={15} />
                </ThemeIcon>
                <Title order={2} size="h3">
                  Return Distributions — {years}‑Year Window
                </Title>
              </Group>
              <Text size="sm" c="dimmed">
                The violin shapes show the full distribution of annualised
                returns across all possible {years}-year windows in the data.
                The box shows the interquartile range and the line shows the
                mean.
              </Text>
            </Stack>

            <div className="plot-wrapper" style={{ minHeight: 400 }}>
              <Plot
                data={violinPlotData}
                layout={violinLayout}
                config={plotConfig}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* ── Stats cards ── */}
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm" mt="lg">
              {distCards.map((d) => (
                <Paper
                  key={d.label}
                  withBorder
                  radius="lg"
                  p="sm"
                  style={{ borderLeft: `5px solid ${d.color}` }}
                >
                  <Text size="xs" fw={700} mb={6} lineClamp={1}>
                    {d.label}
                  </Text>

                  {/* Return metrics */}
                  <Text size="xs" c="dimmed" fw={600} mb={2}>Return</Text>
                  <SimpleGrid cols={2} spacing={4} mb="xs">
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Median</Text>
                      <Text size="sm" fw={700}>{(d.median * 100).toFixed(2)}%</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Mean</Text>
                      <Text size="sm" fw={700}>{(d.mean * 100).toFixed(2)}%</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">5th pctl</Text>
                      <Text size="sm" fw={700} c="red">{(d.p5 * 100).toFixed(2)}%</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">95th pctl</Text>
                      <Text size="sm" fw={700} c="teal">{(d.p95 * 100).toFixed(2)}%</Text>
                    </Stack>
                  </SimpleGrid>

                  <Divider my={6} />

                  {/* Risk metrics */}
                  <Text size="xs" c="dimmed" fw={600} mb={2}>Risk</Text>
                  <SimpleGrid cols={2} spacing={4}>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Sharpe (med)</Text>
                      <Text size="sm" fw={700}>{d.sharpe_median.toFixed(2)}</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Sharpe (avg)</Text>
                      <Text size="sm" fw={700}>{d.sharpe_mean.toFixed(2)}</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Max DD (med)</Text>
                      <Text size="sm" fw={700} c="red">{(d.max_drawdown_median * 100).toFixed(1)}%</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Max DD (worst)</Text>
                      <Text size="sm" fw={700} c="red">{(d.max_drawdown_worst * 100).toFixed(1)}%</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Underwater (med)</Text>
                      <Text size="sm" fw={700}>{d.time_underwater_median} mo</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Underwater (worst)</Text>
                      <Text size="sm" fw={700} c="red">{d.time_underwater_worst} mo</Text>
                    </Stack>
                  </SimpleGrid>
                </Paper>
              ))}
            </SimpleGrid>

            {/* explainer */}
            <Paper
              radius="md"
              p="sm"
              mt="md"
              withBorder
              style={{
                background: 'rgba(139,92,246,0.04)',
                borderColor: 'rgba(139,92,246,0.3)',
              }}
            >
              <Group gap="xs">
                <IconInfoCircle size={16} color="#8b5cf6" />
                <Text size="xs" c="dimmed">
                  <Text span fw={600}>5th percentile</Text> represents the
                  worst 5% of outcomes — a useful proxy for downside risk over
                  a {years}-year horizon. The higher this number, the safer the
                  portfolio historically.
                </Text>
              </Group>
            </Paper>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SHARPE RATIO — ROLLING OVER TIME
            ══════════════════════════════════════════════════════════════════ */}
        {result && Object.keys(result.series).length > 0 && (
          <Card withBorder shadow="md" radius="lg" p="lg">
            <Stack gap="xs" mb="md">
              <Group gap="xs">
                <ThemeIcon color="teal" variant="light" size="md" radius="xl">
                  <IconShieldCheck size={15} />
                </ThemeIcon>
                <Title order={2} size="h3">
                  Sharpe Ratio — {years}‑Year Rolling Window
                </Title>
              </Group>
              <Text size="sm" c="dimmed">
                The Sharpe ratio measures return per unit of risk.
                Higher is better — it means you're being compensated more for
                the volatility you endure.
              </Text>
            </Stack>

            <div className="plot-wrapper">
              <Plot
                data={sharpePlotData}
                layout={sharpeLayout}
                config={plotConfig}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <Paper
              radius="md"
              p="sm"
              mt="md"
              withBorder
              style={{
                background: 'rgba(20,184,166,0.04)',
                borderColor: 'rgba(20,184,166,0.3)',
              }}
            >
              <Group gap="xs">
                <IconInfoCircle size={16} color="#14b8a6" />
                <Text size="xs" c="dimmed">
                  <Text span fw={600}>How to read this:</Text> A Sharpe of 0.5
                  means for every 1% of volatility you took on, you earned
                  0.5% of excess return. Above 1.0 is generally considered
                  excellent.
                </Text>
              </Group>
            </Paper>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MAX DRAWDOWN — ROLLING OVER TIME
            ══════════════════════════════════════════════════════════════════ */}
        {result && Object.keys(result.series).length > 0 && (
          <Card withBorder shadow="md" radius="lg" p="lg">
            <Stack gap="xs" mb="md">
              <Group gap="xs">
                <ThemeIcon color="red" variant="light" size="md" radius="xl">
                  <IconTrendingDown size={15} />
                </ThemeIcon>
                <Title order={2} size="h3">
                  Max Drawdown — {years}‑Year Rolling Window
                </Title>
              </Group>
              <Text size="sm" c="dimmed">
                The worst peak-to-trough decline within each {years}-year
                window. Closer to 0% is better — it means the portfolio
                experienced smaller crashes.
              </Text>
            </Stack>

            <div className="plot-wrapper">
              <Plot
                data={mddPlotData}
                layout={mddLayout}
                config={plotConfig}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <Paper
              radius="md"
              p="sm"
              mt="md"
              withBorder
              style={{
                background: 'rgba(239,68,68,0.04)',
                borderColor: 'rgba(239,68,68,0.3)',
              }}
            >
              <Group gap="xs">
                <IconInfoCircle size={16} color="#ef4444" />
                <Text size="xs" c="dimmed">
                  <Text span fw={600}>How to read this:</Text> A max drawdown
                  of −40% means at some point within that window the portfolio
                  lost 40% from its previous peak. This is the pain you would
                  have felt before recovery.
                </Text>
              </Group>
            </Paper>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TIME UNDERWATER — ROLLING OVER TIME
            ══════════════════════════════════════════════════════════════════ */}
        {result && Object.keys(result.series).length > 0 && (
          <Card withBorder shadow="md" radius="lg" p="lg">
            <Stack gap="xs" mb="md">
              <Group gap="xs">
                <ThemeIcon color="orange" variant="light" size="md" radius="xl">
                  <IconFlame size={15} />
                </ThemeIcon>
                <Title order={2} size="h3">
                  Time Underwater — {years}‑Year Rolling Window
                </Title>
              </Group>
              <Text size="sm" c="dimmed">
                The longest consecutive streak (in months) that the portfolio
                stayed below its previous peak within each window. Shorter is
                better — it means the portfolio recovers faster from losses.
              </Text>
            </Stack>

            <div className="plot-wrapper">
              <Plot
                data={underwaterPlotData}
                layout={underwaterLayout}
                config={plotConfig}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <Paper
              radius="md"
              p="sm"
              mt="md"
              withBorder
              style={{
                background: 'rgba(249,115,22,0.04)',
                borderColor: 'rgba(249,115,22,0.3)',
              }}
            >
              <Group gap="xs">
                <IconInfoCircle size={16} color="#f97316" />
                <Text size="xs" c="dimmed">
                  <Text span fw={600}>How to read this:</Text> If the line
                  shows 60 months, it means the portfolio spent 5 years below
                  its previous high. This tests your patience as an investor.
                </Text>
              </Group>
            </Paper>
          </Card>
        )}

        {/* ── FOOTER ── */}
        <Paper
          withBorder
          radius="xl"
          p="lg"
          ta="center"
          style={{
            background: 'rgba(139,92,246,0.04)',
            borderColor: 'rgba(139,92,246,0.3)',
          }}
        >
          <Text size="sm" fw={600} mb={4}>
            Data source: Curvo.eu — historical MSCI & FTSE index prices in EUR.
          </Text>
          <Text size="sm" c="dimmed">
            Past performance does not guarantee future results. This is an
            educational tool, not financial advice.
          </Text>
        </Paper>
      </Stack>
    </Container>
  )
}
