import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  List,
  NumberInput,
  Paper,
  RingProgress,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconBolt,
  IconBuildingBank,
  IconChartLine,
  IconChevronDown,
  IconCoin,
  IconInfoCircle,
  IconRobot,
  IconShield,
  IconTrendingDown,
} from '@tabler/icons-react'
import type { Data, Layout, PlotDatum, PlotMouseEvent } from 'plotly.js'
import Plot from 'react-plotly.js'

/* ─────────────────────────────────────────────────────────────────────────────
   INVESTMENT CATEGORY DEFINITIONS
   ───────────────────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  {
    key: 'etf',
    label: 'ETF',
    subtitle: 'Exchange-Traded Fund',
    fee: 0.15,
    color: '#22c55e',
    mantineColor: 'green',
    icon: IconChartLine,
    description:
      'Passively tracks an index. Ultra-low costs, broad diversification, and tax-efficient.',
    examples: ['VWCE', 'iShares Core MSCI World', 'Amundi MSCI EM'],
    verdict: 'Low cost',
    verdictColor: 'green',
  },
  {
    key: 'robo',
    label: 'Robo-advisor',
    subtitle: 'Automated Portfolio',
    fee: 1.0,
    color: '#3b82f6',
    mantineColor: 'blue',
    icon: IconRobot,
    description:
      'Algorithm-driven allocation with automatic rebalancing. Convenient, but the service layer adds cost.',
    examples: ['Scalable Capital', 'Moneyfarm', 'Nutmeg'],
    verdict: 'Moderate cost',
    verdictColor: 'blue',
  },
  {
    key: 'active',
    label: 'Active Fund',
    subtitle: 'Human-Managed Fund',
    fee: 2.0,
    color: '#f97316',
    mantineColor: 'orange',
    icon: IconBuildingBank,
    description:
      'Portfolio managers pick stocks trying to beat the market. Most do not — and the fee drag is steep.',
    examples: ['Typical bank mutual fund', 'Hedge fund feeder', 'SICAV'],
    verdict: 'High cost',
    verdictColor: 'orange',
  },
  {
    key: 'insurance',
    label: 'Insurance',
    subtitle: 'Insurance-Wrapped Product',
    fee: 3.0,
    color: '#ef4444',
    mantineColor: 'red',
    icon: IconShield,
    description:
      'Investment bundled with a life-insurance wrapper. Highest fees, complex structure, poor transparency.',
    examples: ['Unit-linked policy', 'Variable annuity', 'Fondi pensione costosi'],
    verdict: 'Very high cost',
    verdictColor: 'red',
  },
] as const

/* ─────────────────────────────────────────────────────────────────────────────
   CLIENT-SIDE COMPOUND GROWTH (no API needed for preset section)
   formula: V(n) = V0 × (1 + r − f)^n
   ───────────────────────────────────────────────────────────────────────────── */
function buildSeries(
  initial: number,
  growthRate: number,
  feeRate: number,
  years: number
) {
  const values: number[] = []
  for (let y = 0; y <= years; y++) {
    values.push(initial * Math.pow(1 + growthRate - feeRate, y))
  }
  return values
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────────────────────── */
export default function Simulator() {
  const apiBase =
    (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

  /* ── Shared controls ── */
  const [initialInvestment, setInitialInvestment] = useState(10_000)
  const [annualGrowthRate, setAnnualGrowthRate] = useState(7)
  const [years, setYears] = useState(30)

  /* ── Custom comparison (fee A vs B) ── */
  const [feeRateA, setFeeRateA] = useState(0.15)
  const [feeRateB, setFeeRateB] = useState(2.0)
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null)
  const [investmentData, setInvestmentData] = useState<{
    years: number[]
    series: { fee_a: number[]; fee_b: number[] }
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const computedScheme = useComputedColorScheme('light')

  /* ── Chart tokens ── */
  const chartTokens = useMemo(() => {
    if (typeof document === 'undefined') {
      return {
        text: '#1f2937',
        grid: 'rgba(148, 163, 184, 0.25)',
        zero: 'rgba(148, 163, 184, 0.55)',
      }
    }
    const styles = getComputedStyle(document.documentElement)
    return {
      text: styles.getPropertyValue('--mantine-color-text').trim() || '#1f2937',
      grid:
        styles.getPropertyValue('--mantine-color-gray-4').trim() ||
        'rgba(148, 163, 184, 0.25)',
      zero:
        styles.getPropertyValue('--mantine-color-gray-6').trim() ||
        'rgba(148, 163, 184, 0.55)',
    }
  }, [computedScheme])

  /* ─────────────────────────────────────────────────────────────────────────
     PRESET COMPARISON DATA (all 4 categories, calculated client-side)
     ──────────────────────────────────────────────────────────────────────── */
  const presetPlotData = useMemo<Data[]>(() => {
    const yearAxis = Array.from({ length: years + 1 }, (_, i) => i)
    const gr = annualGrowthRate / 100
    return CATEGORIES.map((cat) => ({
      x: yearAxis,
      y: buildSeries(initialInvestment, gr, cat.fee / 100, years),
      type: 'scatter' as const,
      mode: 'lines',
      line: { color: cat.color, width: 3, shape: 'spline' },
      hovertemplate: `<b>${cat.label}</b><br>Year %{x}<br>%{y:.2f} EUR<extra></extra>`,
      name: `${cat.label} (${cat.fee}%)`,
    }))
  }, [initialInvestment, annualGrowthRate, years])

  const baseLayout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      margin: { l: 70, r: 35, t: 40, b: 60 },
      legend: {
        orientation: 'h' as const,
        y: 1.1,
        x: 0,
        font: { color: chartTokens.text, size: 13 },
      },
      xaxis: {
        title: { text: 'Years' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
        ticks: 'outside',
        ticklen: 6,
        tickcolor: chartTokens.zero,
      },
      yaxis: {
        title: { text: 'Balance (EUR)' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
        ticks: 'outside',
        ticklen: 6,
        tickcolor: chartTokens.zero,
        tickformat: ',.0f',
      },
      font: { color: chartTokens.text, family: 'Inter, system-ui, sans-serif' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      uirevision: 'static',
    }),
    [chartTokens]
  )

  /* ─────────────────────────────────────────────────────────────────────────
     FEE DRAIN SUMMARY (vs. no-fee baseline)
     ──────────────────────────────────────────────────────────────────────── */
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    []
  )

  const feeDrainStats = useMemo(() => {
    const gr = annualGrowthRate / 100
    const noFeeBalance = initialInvestment * Math.pow(1 + gr, years)
    return CATEGORIES.map((cat) => {
      const balance = initialInvestment * Math.pow(1 + gr - cat.fee / 100, years)
      const lostToFees = noFeeBalance - balance
      const percentLost = (lostToFees / noFeeBalance) * 100
      return { ...cat, balance, lostToFees, percentLost }
    })
  }, [initialInvestment, annualGrowthRate, years])

  const etfStats = feeDrainStats[0]

  /* ─────────────────────────────────────────────────────────────────────────
     CUSTOM COMPARISON — API CALL
     ──────────────────────────────────────────────────────────────────────── */
  const plotData = useMemo<Data[]>(() => {
    if (!investmentData) return []
    return [
      {
        x: investmentData.years,
        y: investmentData.series.fee_a,
        type: 'scatter' as const,
        mode: 'lines',
        line: { color: '#22c55e', width: 3, shape: 'spline' },
        fill: 'tozeroy',
        fillcolor: 'rgba(34, 197, 94, 0.12)',
        hovertemplate: 'Year %{x}<br>%{y:.2f} EUR<extra></extra>',
        name: `Fee A (${feeRateA.toFixed(2)}%)`,
      },
      {
        x: investmentData.years,
        y: investmentData.series.fee_b,
        type: 'scatter' as const,
        mode: 'lines',
        line: { color: '#ef4444', width: 3, shape: 'spline' },
        fill: 'tozeroy',
        fillcolor: 'rgba(239, 68, 68, 0.12)',
        hovertemplate: 'Year %{x}<br>%{y:.2f} EUR<extra></extra>',
        name: `Fee B (${feeRateB.toFixed(2)}%)`,
      },
    ]
  }, [investmentData, feeRateA, feeRateB])

  const plotConfig = useMemo(() => ({ responsive: true, displayModeBar: false }), [])

  const formatPoint = useCallback(
    (point: PlotDatum) =>
      `Year ${Number(point.x)}: ${currencyFormatter.format(Number(point.y))}`,
    [currencyFormatter]
  )
  const handleHover = useCallback(
    (event: Readonly<PlotMouseEvent>) => setHoveredPoint(formatPoint(event.points[0])),
    [formatPoint]
  )
  const handleClick = useCallback(
    (event: Readonly<PlotMouseEvent>) => setSelectedPoint(formatPoint(event.points[0])),
    [formatPoint]
  )

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      initial: initialInvestment.toString(),
      growth_rate: (annualGrowthRate / 100).toString(),
      fee_a: (feeRateA / 100).toString(),
      fee_b: (feeRateB / 100).toString(),
      years: Math.max(1, Math.round(years)).toString(),
    })
    setIsLoading(true)
    setLoadError(null)
    fetch(`${apiBase}/simulators/investment?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error('Unable to load simulation data.')
        return r.json()
      })
      .then(
        (payload: {
          years?: number[]
          series?: { fee_a?: number[]; fee_b?: number[] }
        }) => {
          if (payload.years && payload.series?.fee_a && payload.series?.fee_b) {
            setInvestmentData({
              years: payload.years,
              series: { fee_a: payload.series.fee_a, fee_b: payload.series.fee_b },
            })
          }
        }
      )
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setLoadError('Unable to reach the API.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [apiBase, annualGrowthRate, feeRateA, feeRateB, initialInvestment, years])

  const toNumber = useCallback(
    (value: string | number | undefined, fallback: number) => {
      const parsed = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
    },
    []
  )

  const statusColor = loadError ? 'red' : isLoading ? 'yellow' : 'green'
  const statusLabel = isLoading ? 'loading…' : loadError ?? 'live'

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
            leftSection={<IconChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />}
          >
            Back
          </Button>
          <Badge variant="light" color="orange" size="lg">Finance 4 All</Badge>
        </Group>

        {/* ══════════════════════════════════════════════════════════════════
            HERO — TER INTRODUCTION
            ══════════════════════════════════════════════════════════════════ */}
        <Stack gap="md" align="center" ta="center">
          <Badge variant="dot" color="orange" size="xl">TER — Total Expense Ratio</Badge>
          <Title
            order={1}
            style={{ fontSize: 'clamp(1.8rem, 5vw, 3.2rem)', lineHeight: 1.1, maxWidth: 700 }}
          >
            The hidden tax on your{' '}
            <Text span c="orange" inherit>wealth</Text>
          </Title>
          <Text c="dimmed" size="lg" maw={620}>
            Every investment product charges a yearly fee. Even a seemingly small
            percentage difference, compounded over decades, can silently consume a
            significant portion of your returns. This is the TER effect.
          </Text>
        </Stack>

        {/* ── KEY FACTS BANNER ── */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {[
            {
              icon: IconTrendingDown,
              color: 'red',
              title: 'Compounding works both ways',
              body: 'Fees compound against you every year — the longer you invest, the bigger the damage.',
            },
            {
              icon: IconCoin,
              color: 'orange',
              title: "1% sounds small. It isn't.",
              body: `On ${currencyFormatter.format(initialInvestment)} over ${years} years, 1% extra TER can cost you ${currencyFormatter.format(Math.abs(feeDrainStats[1].lostToFees - feeDrainStats[0].lostToFees))}.`,
            },
            {
              icon: IconInfoCircle,
              color: 'blue',
              title: "Most investors don't check",
              body: 'TER is buried in the KIID document. Banks and advisors have every incentive not to highlight it.',
            },
          ].map(({ icon: Icon, color, title, body }) => (
            <Card key={title} withBorder radius="lg" p="lg">
              <Group gap="sm" mb="xs">
                <ThemeIcon color={color} variant="light" size="lg" radius="md">
                  <Icon size={18} />
                </ThemeIcon>
                <Text fw={700} size="sm">{title}</Text>
              </Group>
              <Text size="sm" c="dimmed">{body}</Text>
            </Card>
          ))}
        </SimpleGrid>

        {/* ══════════════════════════════════════════════════════════════════
            INVESTMENT CATEGORY CARDS
            ══════════════════════════════════════════════════════════════════ */}
        <Stack gap="sm">
          <Group gap="xs">
            <ThemeIcon color="orange" variant="light" size="md" radius="xl">
              <IconBolt size={15} />
            </ThemeIcon>
            <Title order={2} size="h3">Investment types by TER</Title>
          </Group>
          <Text c="dimmed" size="sm">
            Typical annual cost ranges — what you pay every year, regardless of performance.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const ringValue = Math.min((cat.fee / 4) * 100, 100)
            return (
              <Card
                key={cat.key}
                withBorder
                radius="xl"
                p="lg"
                style={{ borderColor: cat.color + '44' }}
              >
                <Stack gap="sm" align="center" ta="center">
                  <RingProgress
                    size={88}
                    thickness={8}
                    roundCaps
                    sections={[{ value: ringValue, color: cat.color }]}
                    label={
                      <ThemeIcon color={cat.mantineColor} variant="light" size={46} radius="xl">
                        <Icon size={22} />
                      </ThemeIcon>
                    }
                  />
                  <Stack gap={2} align="center">
                    <Text fw={800} size="xl" style={{ color: cat.color }}>
                      {cat.fee}%
                    </Text>
                    <Text fw={700} size="sm">{cat.label}</Text>
                    <Text size="xs" c="dimmed">{cat.subtitle}</Text>
                  </Stack>
                  <Badge variant="light" color={cat.mantineColor} size="sm" radius="sm">
                    {cat.verdict}
                  </Badge>
                  <Divider w="100%" />
                  <Text size="xs" c="dimmed" ta="center">{cat.description}</Text>
                  <Stack gap={4} w="100%">
                    <Text size="xs" fw={600} c="dimmed" ta="left">Examples</Text>
                    {cat.examples.map((ex) => (
                      <Text key={ex} size="xs" c="dimmed" ta="left">· {ex}</Text>
                    ))}
                  </Stack>
                </Stack>
              </Card>
            )
          })}
        </SimpleGrid>

        {/* ══════════════════════════════════════════════════════════════════
            SHARED SIMULATION CONTROLS
            ══════════════════════════════════════════════════════════════════ */}
        <Card withBorder shadow="sm" radius="lg" p="lg">
          <Group gap="xs" mb="sm">
            <ThemeIcon color="orange" variant="light" size="md" radius="xl">
              <IconCoin size={15} />
            </ThemeIcon>
            <Title order={3} size="h4">Simulation parameters</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            These inputs apply to all charts and tables below.
          </Text>
          <Divider mb="md" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            <NumberInput
              label="Initial investment"
              value={initialInvestment}
              min={0}
              step={1000}
              rightSection={<Text size="xs" c="dimmed">EUR</Text>}
              rightSectionWidth={46}
              onChange={(v) => setInitialInvestment(toNumber(v, initialInvestment))}
            />
            <NumberInput
              label="Annual market growth"
              value={annualGrowthRate}
              min={0}
              step={0.5}
              rightSection={<Text size="xs" c="dimmed">%</Text>}
              rightSectionWidth={36}
              onChange={(v) => setAnnualGrowthRate(toNumber(v, annualGrowthRate))}
            />
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>Time horizon</Text>
                <Text size="sm" c="dimmed">{years} years</Text>
              </Group>
              <Slider
                min={5}
                max={60}
                step={5}
                value={years}
                onChange={setYears}
                marks={[
                  { value: 10, label: '10y' },
                  { value: 30, label: '30y' },
                  { value: 60, label: '60y' },
                ]}
                color="orange"
              />
            </Stack>
          </SimpleGrid>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            PRESET COMPARISON CHART — ALL 4 CATEGORIES
            ══════════════════════════════════════════════════════════════════ */}
        <Card withBorder shadow="md" radius="lg" p="lg">
          <Stack gap="xs" mb="md">
            <Group gap="xs">
              <ThemeIcon color="orange" variant="light" size="md" radius="xl">
                <IconChartLine size={15} />
              </ThemeIcon>
              <Title order={2} size="h3">
                Growth of {currencyFormatter.format(initialInvestment)} — all categories
              </Title>
            </Group>
            <Text size="sm" c="dimmed">
              Assuming {annualGrowthRate}% annual market growth before fees, over {years} years.
              The widening gap between lines is pure fee drag.
            </Text>
          </Stack>

          <div className="plot-wrapper">
            <Plot
              data={presetPlotData}
              layout={baseLayout}
              config={plotConfig}
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Final balance summary row */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mt="lg">
            {feeDrainStats.map((cat) => (
              <Paper
                key={cat.key}
                radius="lg"
                p="sm"
                withBorder
                style={{ borderColor: cat.color + '55' }}
              >
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={600}>{cat.label}</Text>
                  <Text size="sm" fw={800} style={{ color: cat.color }}>
                    {currencyFormatter.format(cat.balance)}
                  </Text>
                  <Text size="xs" c="dimmed">after {years}y</Text>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            FEE DRAIN — WHAT YOU SILENTLY LOSE
            ══════════════════════════════════════════════════════════════════ */}
        <Card withBorder shadow="sm" radius="lg" p="lg">
          <Group gap="xs" mb="xs">
            <ThemeIcon color="red" variant="light" size="md" radius="xl">
              <IconTrendingDown size={15} />
            </ThemeIcon>
            <Title order={2} size="h3">The fee drain — what you silently lose</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="lg">
            Compared to a hypothetical zero-fee scenario.
          </Text>

          <Stack gap="md">
            {feeDrainStats.map((cat) => {
              const Icon = cat.icon
              const extraLoss = cat.lostToFees - etfStats.lostToFees
              // wealth retained = balance / no-fee baseline
              const retainedPct = 100 - cat.percentLost
              const isHighFee = cat.percentLost >= 40
              return (
                <Paper
                  key={cat.key}
                  withBorder
                  radius="lg"
                  p="lg"
                  style={{
                    borderLeft: `6px solid ${cat.color}`,
                    background: isHighFee ? `${cat.color}08` : undefined,
                  }}
                >
                  {/* ── Header row ── */}
                  <Group justify="space-between" wrap="wrap" gap="sm" mb="md">
                    <Group gap="sm">
                      <ThemeIcon color={cat.mantineColor} variant="light" size={44} radius="md">
                        <Icon size={22} />
                      </ThemeIcon>
                      <Stack gap={2}>
                        <Text fw={700} size="md">
                          {cat.label} — {cat.fee}% TER
                        </Text>
                        <Text size="xs" c="dimmed">
                          Final balance: {currencyFormatter.format(cat.balance)}
                        </Text>
                      </Stack>
                    </Group>

                    {/* ── Big % badge ── */}
                    <Stack gap={2} align="flex-end">
                      <Text
                        fw={900}
                        style={{
                          fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                          lineHeight: 1,
                          color: cat.color,
                        }}
                      >
                        {cat.percentLost.toFixed(1)}%
                      </Text>
                      <Text size="xs" c="dimmed" fw={600}>of gross gains lost to fees</Text>
                      {cat.key !== 'etf' && (
                        <Badge variant="light" color={cat.mantineColor} size="sm" mt={2}>
                          +{currencyFormatter.format(extraLoss)} extra vs low-cost
                        </Badge>
                      )}
                    </Stack>
                  </Group>

                  {/* ── Stacked wealth bar ── */}
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Wealth retained</Text>
                      <Text size="xs" c="dimmed">Wealth burned by fees</Text>
                    </Group>
                    <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', width: '100%' }}>
                      <div
                        style={{
                          width: `${retainedPct}%`,
                          background: cat.color,
                          opacity: 0.85,
                          transition: 'width 0.4s ease',
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          background: `${cat.color}33`,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <Group justify="space-between">
                      <Text size="xs" fw={700} style={{ color: cat.color }}>
                        {currencyFormatter.format(cat.balance)}
                      </Text>
                      <Text size="xs" fw={700} c="red">
                        −{currencyFormatter.format(cat.lostToFees)}
                      </Text>
                    </Group>
                  </Stack>

                  {/* ── Warning callout for high-fee categories ── */}
                  {isHighFee && (
                    <Paper
                      radius="md"
                      p="xs"
                      mt="sm"
                      style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}55` }}
                    >
                      <Group gap="xs">
                        <IconTrendingDown size={14} style={{ color: cat.color, flexShrink: 0 }} />
                        <Text size="xs" fw={600} style={{ color: cat.color }}>
                          At {cat.fee}% TER, fees consume {cat.percentLost.toFixed(0)}% of what the market theoretically generates — more than {retainedPct.toFixed(0)}% of gross gains remain in your portfolio.
                        </Text>
                      </Group>
                    </Paper>
                  )}
                </Paper>
              )
            })}
          </Stack>

          {/* Bottom-line callout */}
          <Paper
            radius="lg"
            p="md"
            mt="lg"
            withBorder
            style={{ background: 'rgba(249,115,22,0.06)', borderColor: '#f97316' }}
          >
            <Group gap="sm">
              <ThemeIcon color="orange" variant="light" size="lg" radius="md">
                <IconInfoCircle size={18} />
              </ThemeIcon>
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={700}>Bottom line</Text>
                <Text size="sm" c="dimmed">
                  The difference in final balance between a 0.15% TER product and a 3% TER product
                  on {currencyFormatter.format(initialInvestment)} over {years} years is{' '}
                  <Text span fw={700} c="orange">
                    {currencyFormatter.format(
                      Math.abs(feeDrainStats[3].balance - feeDrainStats[0].balance)
                    )}
                  </Text>
                  . That gap comes entirely from fee drag — no market timing, no risk difference.
                </Text>
              </Stack>
            </Group>
          </Paper>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            WHAT IS INCLUDED IN TER
            ══════════════════════════════════════════════════════════════════ */}
        <Card withBorder shadow="sm" radius="lg" p="lg">
          <Group gap="xs" mb="md">
            <ThemeIcon color="blue" variant="light" size="md" radius="xl">
              <IconInfoCircle size={15} />
            </ThemeIcon>
            <Title order={2} size="h3">What is included in TER?</Title>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            {[
              {
                title: 'Management fee',
                lines: [
                  'Paid to fund managers for running the portfolio.',
                  'The biggest component — often 80%+ of TER.',
                  'Active funds charge more, claiming to outperform.',
                ],
              },
              {
                title: 'Administrative & operational',
                lines: [
                  'Custody, auditing, legal, and reporting costs.',
                  'Spread across all investors in the fund.',
                  'Largely invisible to retail investors.',
                ],
              },
              {
                title: 'Distribution (trailer fees)',
                lines: [
                  'Paid to distributors (banks, advisors) for selling.',
                  'Creates a conflict of interest.',
                  'ETFs sold on exchange avoid most of this.',
                ],
              },
            ].map(({ title, lines }) => (
              <Stack key={title} gap="sm">
                <Text fw={700} size="sm">{title}</Text>
                <List size="xs" spacing={4} c="dimmed">
                  {lines.map((l) => (
                    <List.Item key={l}>{l}</List.Item>
                  ))}
                </List>
              </Stack>
            ))}
          </SimpleGrid>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            CUSTOM COMPARISON — API-POWERED
            ══════════════════════════════════════════════════════════════════ */}
        <Card withBorder shadow="md" radius="lg" p="lg">
          <Group gap="xs" mb="xs">
            <ThemeIcon color="orange" variant="light" size="md" radius="xl">
              <IconBolt size={15} />
            </ThemeIcon>
            <Title order={2} size="h3">Custom fee comparison</Title>
          </Group>
          <Group justify="space-between" wrap="wrap" mb="xs">
            <Text size="sm" c="dimmed">Set any two TER values and compare head-to-head.</Text>
            <Badge variant="dot" color={statusColor} size="sm">
              API: {statusLabel}
            </Badge>
          </Group>
          <Divider mb="md" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
            <NumberInput
              label="Fee A"
              description="e.g. an ETF at 0.15%"
              value={feeRateA}
              min={0}
              step={0.05}
              decimalScale={2}
              rightSection={<Text size="xs" c="dimmed">%</Text>}
              rightSectionWidth={36}
              onChange={(v) => setFeeRateA(toNumber(v, feeRateA))}
            />
            <NumberInput
              label="Fee B"
              description="e.g. an active fund at 2%"
              value={feeRateB}
              min={0}
              step={0.05}
              decimalScale={2}
              rightSection={<Text size="xs" c="dimmed">%</Text>}
              rightSectionWidth={36}
              onChange={(v) => setFeeRateB(toNumber(v, feeRateB))}
            />
          </SimpleGrid>
          <div className="plot-wrapper">
            <Plot
              data={plotData}
              layout={baseLayout}
              config={plotConfig}
              onHover={handleHover}
              onUnhover={() => setHoveredPoint(null)}
              onClick={handleClick}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <Group mt="md" gap="xl" wrap="wrap">
            <Text size="sm">
              <Text span fw={600}>Hover: </Text>
              {hoveredPoint ?? 'Move over a point'}
            </Text>
            <Text size="sm">
              <Text span fw={600}>Selected: </Text>
              {selectedPoint ?? 'Click a point to lock'}
            </Text>
          </Group>
        </Card>

      </Stack>
    </Container>
  )
}
