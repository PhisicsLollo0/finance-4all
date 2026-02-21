import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  RingProgress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  ThemeIcon,
  Title,
  rem,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconChartBar,
  IconDice5,
  IconEye,
  IconFlame,
  IconInfoCircle,
  IconPlayerPlay,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react'
import type { Data, Layout } from 'plotly.js'
import Plot from 'react-plotly.js'

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────────────────────── */
interface MartingaleResponse {
  num_simulations: number
  base_bet: number
  max_table_limit: number | null
  take_profit: number
  bankroll: number

  bust_rate: number
  take_profit_rate: number
  profit_probability: number
  average_final_balance: number
  median_final_balance: number
  min_final_balance: number
  max_final_balance: number
  std_final_balance: number
  average_profit: number
  median_profit: number

  average_rounds_played: number
  median_rounds_played: number

  average_peak_balance: number
  average_max_consecutive_losses: number
  average_max_bet_placed: number
  sharpe_ratio: number

  balance_histogram_bins: number[]
  balance_histogram_counts: number[]

  percentile_5: number
  percentile_25: number
  percentile_75: number
  percentile_95: number

  sample_paths: { round: number[]; balance: number[]; bet: number[] }[]
}

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────────────────── */
const toNumber = (v: string | number, fallback: number) =>
  typeof v === 'number' ? v : fallback

const fmt = (n: number, d = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────────────────────── */
export default function MartingaleSimulator() {
  const apiBase =
    (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

  /* ── Controls ── */
  const [numSims, setNumSims] = useState(1000)
  const [baseBet, setBaseBet] = useState(10)
  const [bankroll, setBankroll] = useState(1000)
  const [takeProfit, setTakeProfit] = useState(2000)
  const [hasTableLimit, setHasTableLimit] = useState(false)
  const [tableLimit, setTableLimit] = useState(500)

  /* ── State ── */
  const [data, setData] = useState<MartingaleResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)

  const computedScheme = useComputedColorScheme('light')

  /* ── Chart tokens ── */
  const chartTokens = useMemo(() => {
    if (typeof document === 'undefined') {
      return {
        text: '#1f2937',
        grid: 'rgba(148, 163, 184, 0.25)',
        zero: 'rgba(148, 163, 184, 0.55)',
        paper: '#ffffff',
        plot: '#ffffff',
      }
    }
    const s = getComputedStyle(document.documentElement)
    const isDark = computedScheme === 'dark'
    return {
      text: s.getPropertyValue('--mantine-color-text').trim() || '#1f2937',
      grid:
        s.getPropertyValue('--mantine-color-gray-4').trim() ||
        'rgba(148, 163, 184, 0.25)',
      zero:
        s.getPropertyValue('--mantine-color-gray-6').trim() ||
        'rgba(148, 163, 184, 0.55)',
      paper: isDark ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0)',
      plot: isDark ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0)',
    }
  }, [computedScheme])

  /* ── Validation ── */
  const baseBetError =
    baseBet <= 0
      ? 'Must be greater than €0'
      : baseBet >= bankroll
        ? `Must be less than the bankroll (€${fmt(bankroll)})`
        : null

  const takeProfitError =
    takeProfit <= bankroll
      ? `Must be greater than the bankroll (€${fmt(bankroll)})`
      : null

  const hasValidationErrors = !!baseBetError || !!takeProfitError

  /* ── Run simulation ── */
  const runSimulation = useCallback(async () => {
    // Guard: re-check validation inside callback (hasValidationErrors is derived, not in closure)
    if (baseBet <= 0 || baseBet >= bankroll || takeProfit <= bankroll) return

    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        num_simulations: String(numSims),
        base_bet: String(baseBet),
        bankroll: String(bankroll),
        take_profit: String(takeProfit),
      })
      if (hasTableLimit) {
        params.set('max_table_limit', String(tableLimit))
      }
      const res = await fetch(`${apiBase}/games/martingale?${params}`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json: MartingaleResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [apiBase, numSims, baseBet, bankroll, takeProfit, hasTableLimit, tableLimit])

  /* ── Plot config ── */
  const plotConfig = useMemo(
    () => ({
      responsive: true,
      displayModeBar: false,
    }),
    []
  )

  /* ── Balance paths chart data ── */
  const pathsPlotData = useMemo<Data[]>(() => {
    if (!data) return []
    return data.sample_paths.map((p, i) => ({
      x: p.round,
      y: p.balance,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: {
        color:
          p.balance[p.balance.length - 1] <= 0
            ? 'rgba(239, 68, 68, 0.35)'
            : 'rgba(34, 197, 94, 0.35)',
        width: 1.5,
      },
      hovertemplate: `Sim ${i + 1}<br>Round %{x}<br>€%{y:,.2f}<extra></extra>`,
      showlegend: false,
    }))
  }, [data])

  /* ── Histogram chart data ── */
  const histogramPlotData = useMemo<Data[]>(() => {
    if (!data) return []
    const bins = data.balance_histogram_bins
    const counts = data.balance_histogram_counts
    const midpoints = counts.map((_, i) => (bins[i] + bins[i + 1]) / 2)
    const colors = midpoints.map((m) =>
      m >= data.bankroll ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
    )
    return [
      {
        x: midpoints,
        y: counts,
        type: 'bar' as const,
        marker: { color: colors },
        hovertemplate: '€%{x:,.0f}<br>%{y} sims<extra></extra>',
        showlegend: false,
      },
    ]
  }, [data])

  const baseLayout = useCallback(
    (title: string, xLabel: string, yLabel: string): Partial<Layout> => ({
      autosize: true,
      margin: { l: 70, r: 35, t: 40, b: 60 },
      title: { text: title, font: { color: chartTokens.text, size: 15 } },
      paper_bgcolor: chartTokens.paper,
      plot_bgcolor: chartTokens.plot,
      xaxis: {
        title: { text: xLabel },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
      },
      yaxis: {
        title: { text: yLabel },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
      },
    }),
    [chartTokens]
  )

  const pathsLayout = useMemo<Partial<Layout>>(
    () => ({
      ...baseLayout('Balance Paths (sample)', 'Round', 'Balance (€)'),
      showlegend: false,
      shapes: [
        {
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          yref: 'y',
          y0: bankroll,
          y1: bankroll,
          line: { color: 'rgba(249,115,22,0.6)', width: 2, dash: 'dash' },
        },
      ],
    }),
    [baseLayout, bankroll]
  )

  /* ── Aggregated dual-axis chart data (balance + bet) ── */
  const aggregatedPlotData = useMemo<Data[]>(() => {
    if (!data) return []
    const balanceTraces: Data[] = data.sample_paths.map((p, i) => ({
      x: p.round,
      y: p.balance,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: {
        color:
          p.balance[p.balance.length - 1] <= 0
            ? 'rgba(239, 68, 68, 0.3)'
            : 'rgba(59, 130, 246, 0.3)',
        width: 1.5,
      },
      hovertemplate: `Sim ${i + 1}<br>Round %{x}<br>Balance: €%{y:,.2f}<extra></extra>`,
      showlegend: false,
    }))
    const betTraces: Data[] = data.sample_paths.map((p, i) => ({
      x: p.round,
      y: p.bet,
      type: 'scatter' as const,
      mode: 'lines' as const,
      yaxis: 'y2',
      line: {
        color:
          p.balance[p.balance.length - 1] <= 0
            ? 'rgba(239, 68, 68, 0.18)'
            : 'rgba(249, 115, 22, 0.18)',
        width: 1,
      },
      hovertemplate: `Sim ${i + 1}<br>Round %{x}<br>Bet: €%{y:,.2f}<extra></extra>`,
      showlegend: false,
    }))
    return [...balanceTraces, ...betTraces]
  }, [data])

  const aggregatedLayout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      margin: { l: 70, r: 70, t: 40, b: 60 },
      title: { text: 'Sample Runs — Balance & Bet Size', font: { color: chartTokens.text, size: 15 } },
      paper_bgcolor: chartTokens.paper,
      plot_bgcolor: chartTokens.plot,
      showlegend: false,
      xaxis: {
        title: { text: 'Round' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
      },
      yaxis: {
        title: { text: 'Balance (€)' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
      },
      yaxis2: {
        title: { text: 'Bet size (€)' },
        overlaying: 'y',
        side: 'right',
        gridcolor: 'transparent',
        color: 'rgba(249,115,22,0.7)',
      },
      shapes: [
        {
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          yref: 'y',
          y0: bankroll,
          y1: bankroll,
          line: { color: 'rgba(148,163,184,0.5)', width: 1.5, dash: 'dash' },
        },
      ],
    }),
    [chartTokens, bankroll]
  )

  const histLayout = useMemo<Partial<Layout>>(
    () => ({
      ...baseLayout('Final Balance Distribution', 'Final Balance (€)', 'Count'),
      shapes: [
        {
          type: 'line',
          xref: 'x',
          x0: bankroll,
          x1: bankroll,
          yref: 'paper',
          y0: 0,
          y1: 1,
          line: { color: 'rgba(249,115,22,0.7)', width: 2, dash: 'dash' },
        },
      ],
    }),
    [baseLayout, bankroll]
  )

  /* ── Stat cards ── */
  const statCards = useMemo(() => {
    if (!data) return []
    return [
      {
        icon: IconFlame,
        color: 'red',
        label: 'Bust rate',
        value: fmtPct(data.bust_rate),
        desc: `${Math.round(data.bust_rate * data.num_simulations)} of ${data.num_simulations} sims went to €0`,
      },
      {
        icon: IconTrendingUp,
        color: 'green',
        label: 'Profit probability',
        value: fmtPct(data.profit_probability),
        desc: `Ended above €${fmt(data.bankroll, 0)} starting bankroll`,
      },
      {
        icon: IconChartBar,
        color: 'blue',
        label: 'Average final balance',
        value: `€${fmt(data.average_final_balance)}`,
        desc: `Median: €${fmt(data.median_final_balance)}`,
      },
      {
        icon: IconTrendingDown,
        color: 'orange',
        label: 'Average profit',
        value: `€${fmt(data.average_profit)}`,
        desc: `Median profit: €${fmt(data.median_profit)}`,
      },
      {
        icon: IconChartBar,
        color: 'violet',
        label: 'Sharpe ratio',
        value: fmt(data.sharpe_ratio, 3),
        desc: 'Mean profit / std of profit (0 = no edge)',
      },
    ]
  }, [data])

  /* ── Detail modal: selected sim path ── */
  const selectedPath = data && detailIndex !== null ? data.sample_paths[detailIndex] : null

  const detailPlotData = useMemo<Data[]>(() => {
    if (!selectedPath) return []
    return [
      {
        x: selectedPath.round,
        y: selectedPath.balance,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Balance',
        line: { color: 'rgba(59,130,246,0.85)', width: 2 },
        hovertemplate: 'Round %{x}<br>Balance: €%{y:,.2f}<extra></extra>',
      },
      {
        x: selectedPath.round,
        y: selectedPath.bet,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Bet size',
        yaxis: 'y2',
        line: { color: 'rgba(249,115,22,0.85)', width: 2 },
        hovertemplate: 'Round %{x}<br>Bet: €%{y:,.2f}<extra></extra>',
      },
    ]
  }, [selectedPath])

  const detailLayout = useMemo<Partial<Layout>>(() => {
    if (!selectedPath) return {}
    return {
      autosize: true,
      margin: { l: 70, r: 70, t: 40, b: 60 },
      paper_bgcolor: chartTokens.paper,
      plot_bgcolor: chartTokens.plot,
      legend: { orientation: 'h', y: -0.2, font: { color: chartTokens.text } },
      xaxis: {
        title: { text: 'Round' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
      },
      yaxis: {
        title: { text: 'Balance (€)' },
        gridcolor: chartTokens.grid,
        zerolinecolor: chartTokens.zero,
        color: chartTokens.text,
      },
      yaxis2: {
        title: { text: 'Bet size (€)' },
        overlaying: 'y',
        side: 'right',
        gridcolor: 'transparent',
        color: 'rgba(249,115,22,0.85)',
      },
      shapes: [
        {
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          yref: 'y',
          y0: bankroll,
          y1: bankroll,
          line: { color: 'rgba(148,163,184,0.5)', width: 1.5, dash: 'dash' },
        },
      ],
    }
  }, [selectedPath, chartTokens, bankroll])

  return (
    <Container size="lg" py="xl">
      <Stack gap={rem(40)}>

        {/* ── Detail modal ── */}
        <Modal
          opened={detailIndex !== null}
          onClose={() => setDetailIndex(null)}
          title={
            <Group gap="xs">
              <IconEye size={18} />
              <Text fw={700}>Simulation #{detailIndex !== null ? detailIndex + 1 : ''} — Round-by-round detail</Text>
            </Group>
          }
          size="xl"
          centered
          overlayProps={{ backgroundOpacity: 0.4, blur: 4 }}
        >
          {selectedPath && (
            <Stack gap="md">
              {/* Summary badges */}
              <Group gap="sm">
                <Badge color={selectedPath.balance[selectedPath.balance.length - 1] <= 0 ? 'red' : 'green'} variant="light" size="lg">
                  Final: €{fmt(selectedPath.balance[selectedPath.balance.length - 1])}
                </Badge>
                <Badge color="blue" variant="light" size="lg">
                  {selectedPath.round.length - 1} rounds
                </Badge>
                <Badge color="orange" variant="light" size="lg">
                  Max bet: €{fmt(Math.max(...selectedPath.bet))}
                </Badge>
                <Badge color="violet" variant="light" size="lg">
                  Peak: €{fmt(Math.max(...selectedPath.balance))}
                </Badge>
              </Group>

              {/* Dual-axis chart */}
              <div className="plot-wrapper">
                <Plot
                  data={detailPlotData}
                  layout={detailLayout}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>

              {/* Scrollable table */}
              <ScrollArea h={300} type="auto" offsetScrollbars>
                <Table striped highlightOnHover withTableBorder withColumnBorders stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 80 }}>Round</Table.Th>
                      <Table.Th style={{ width: 120 }}>Balance (€)</Table.Th>
                      <Table.Th style={{ width: 120 }}>Bet (€)</Table.Th>
                      <Table.Th style={{ width: 100 }}>Outcome</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedPath.round.map((r, i) => {
                      const prevBal = i > 0 ? selectedPath.balance[i - 1] : selectedPath.balance[0]
                      const curBal = selectedPath.balance[i]
                      const bet = selectedPath.bet[i]
                      const outcome =
                        i === 0
                          ? '—'
                          : curBal > prevBal
                            ? 'Win'
                            : curBal < prevBal
                              ? 'Loss'
                              : 'N/A'
                      return (
                        <Table.Tr key={r}>
                          <Table.Td>{r}</Table.Td>
                          <Table.Td>€{fmt(curBal)}</Table.Td>
                          <Table.Td>{bet > 0 ? `€${fmt(bet)}` : '—'}</Table.Td>
                          <Table.Td>
                            {outcome === 'Win' && <Badge color="green" variant="light" size="sm">Win</Badge>}
                            {outcome === 'Loss' && <Badge color="red" variant="light" size="sm">Loss</Badge>}
                            {outcome !== 'Win' && outcome !== 'Loss' && <Text size="xs" c="dimmed">{outcome}</Text>}
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          )}
        </Modal>

        {/* ── Header ── */}
        <Stack gap="sm">
          <Button
            component={Link}
            to="/"
            variant="subtle"
            color="gray"
            size="xs"
            leftSection={<IconArrowLeft size={14} />}
            style={{ alignSelf: 'flex-start' }}
          >
            Back to home
          </Button>

          <Group gap="sm" align="center">
            <ThemeIcon color="red" variant="light" size={48} radius="lg">
              <IconDice5 size={26} />
            </ThemeIcon>
            <div>
              <Title order={1} size="h2">Martingale Roulette Simulator</Title>
              <Text size="sm" c="dimmed">Monte-Carlo simulation of the Martingale betting strategy on European roulette</Text>
            </div>
          </Group>

          <Paper withBorder radius="lg" p="md" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
            <Group gap="xs" mb={4}>
              <IconInfoCircle size={16} color="var(--mantine-color-red-6)" />
              <Text size="sm" fw={600} c="red.7">How Martingale works</Text>
            </Group>
            <Text size="sm" c="dimmed">
              Bet on red or black (European roulette: 18/37 ≈ 48.65% win chance, 1:1 payout).
              After a <b>loss</b>, double the bet. After a <b>win</b>, reset to the base bet.
              The strategy guarantees short-term wins but carries catastrophic long-term risk —
              a single losing streak can wipe out your entire bankroll.
            </Text>
          </Paper>
        </Stack>

        {/* ── Controls ── */}
        <Card withBorder shadow="md" radius="lg" p="lg">
          <Group gap="xs" mb="xs">
            <ThemeIcon color="red" variant="light" size="md" radius="xl">
              <IconPlayerPlay size={15} />
            </ThemeIcon>
            <Title order={2} size="h3">Simulation parameters</Title>
          </Group>
          <Divider mb="md" />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" mb="md">
            <NumberInput
              label="Number of simulations"
              description="Monte-Carlo runs (1 – 10 000)"
              value={numSims}
              min={1}
              max={10_000}
              step={100}
              clampBehavior="strict"
              onChange={(v) => setNumSims(Math.min(10_000, Math.max(1, toNumber(v, numSims))))}
            />
            <NumberInput
              label="Base bet size"
              description="Starting wager per round (must be < bankroll)"
              value={baseBet}
              min={0.01}
              step={5}
              decimalScale={2}
              prefix="€"
              error={baseBetError}
              onChange={(v) => setBaseBet(toNumber(v, baseBet))}
            />
            <NumberInput
              label="Bankroll"
              description="Starting balance"
              value={bankroll}
              min={1}
              step={100}
              prefix="€"
              onChange={(v) => setBankroll(toNumber(v, bankroll))}
            />
            <NumberInput
              label="Take-profit target"
              description={takeProfit > bankroll ? `Stop playing when reached (+${fmtPct((takeProfit - bankroll) / bankroll)})` : 'Must exceed the bankroll'}
              value={takeProfit}
              min={bankroll + 1}
              step={100}
              prefix="€"
              error={takeProfitError}
              onChange={(v) => setTakeProfit(toNumber(v, takeProfit))}
            />
            <Stack gap="xs">
              <Switch
                label="Enable table limit"
                description="Cap the max bet the table allows"
                checked={hasTableLimit}
                onChange={(e) => setHasTableLimit(e.currentTarget.checked)}
                color="red"
              />
              {hasTableLimit && (
                <NumberInput
                  label="Max table limit"
                  value={tableLimit}
                  min={1}
                  step={100}
                  prefix="€"
                  onChange={(v) => setTableLimit(toNumber(v, tableLimit))}
                />
              )}
            </Stack>
          </SimpleGrid>

          <Button
            color="red"
            radius="xl"
            size="md"
            fullWidth
            loading={isLoading}
            disabled={hasValidationErrors}
            leftSection={<IconDice5 size={18} />}
            onClick={runSimulation}
          >
            Run {numSims.toLocaleString()} simulations
          </Button>

          {error && (
            <Text size="sm" c="red" mt="xs">
              {error}
            </Text>
          )}
        </Card>

        {/* ── Results ── */}
        {data && (
          <>
            {/* Headline stats  */}
            <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
              {statCards.map(({ icon: Icon, color, label, value, desc }) => (
                <Card key={label} withBorder radius="xl" p="lg">
                  <Group gap="sm" mb="xs">
                    <ThemeIcon color={color} variant="light" size="lg" radius="md">
                      <Icon size={18} />
                    </ThemeIcon>
                    <Text fw={700} size="sm">{label}</Text>
                  </Group>
                  <Text size="xl" fw={800} mb={2}>{value}</Text>
                  <Text size="xs" c="dimmed">{desc}</Text>
                </Card>
              ))}
            </SimpleGrid>

            {/* Ring progress: bust vs profit */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Card withBorder radius="xl" p="lg" ta="center">
                <Text fw={700} size="sm" mb="md">Outcome breakdown</Text>
                <Group justify="center">
                  <RingProgress
                    size={180}
                    thickness={18}
                    roundCaps
                    sections={[
                      { value: data.take_profit_rate * 100, color: 'teal' },
                      { value: Math.max(0, (data.profit_probability - data.take_profit_rate) * 100), color: 'green' },
                      { value: data.bust_rate * 100, color: 'red' },
                      {
                        value:
                          Math.max(0, (1 - data.profit_probability - data.bust_rate) * 100),
                        color: 'gray',
                      },
                    ]}
                    label={
                      <Stack gap={0} align="center">
                        <Text fw={800} size="lg">{fmtPct(data.bust_rate)}</Text>
                        <Text size="xs" c="dimmed">bust</Text>
                      </Stack>
                    }
                  />
                </Group>
                <Group justify="center" gap="lg" mt="md">
                  {data.take_profit_rate > 0 && (
                    <Badge color="teal" variant="light" size="lg">
                      Take-profit {fmtPct(data.take_profit_rate)}
                    </Badge>
                  )}
                  <Badge color="green" variant="light" size="lg">
                    Profit {fmtPct(data.profit_probability)}
                  </Badge>
                  <Badge color="red" variant="light" size="lg">
                    Bust {fmtPct(data.bust_rate)}
                  </Badge>
                  <Badge color="gray" variant="light" size="lg">
                    Break-even {fmtPct(Math.max(0, 1 - data.profit_probability - data.bust_rate))}
                  </Badge>
                </Group>
              </Card>

              <Card withBorder radius="xl" p="lg">
                <Text fw={700} size="sm" mb="md">Detailed statistics</Text>
                <SimpleGrid cols={2} spacing="xs">
                  {[
                    ['Std deviation', `€${fmt(data.std_final_balance)}`],
                    ['Min balance', `€${fmt(data.min_final_balance)}`],
                    ['Max balance', `€${fmt(data.max_final_balance)}`],
                    ['5th percentile', `€${fmt(data.percentile_5)}`],
                    ['25th percentile', `€${fmt(data.percentile_25)}`],
                    ['75th percentile', `€${fmt(data.percentile_75)}`],
                    ['95th percentile', `€${fmt(data.percentile_95)}`],
                    ['Avg rounds survived', fmt(data.average_rounds_played, 0)],
                    ['Median rounds survived', fmt(data.median_rounds_played, 0)],
                    ['Avg peak balance', `€${fmt(data.average_peak_balance)}`],
                    ['Avg max consec. losses', fmt(data.average_max_consecutive_losses, 1)],
                    ['Avg max bet placed', `€${fmt(data.average_max_bet_placed)}`],
                  ].map(([label, value]) => (
                    <Group key={label} justify="space-between" wrap="nowrap">
                      <Text size="xs" c="dimmed">{label}</Text>
                      <Text size="xs" fw={600}>{value}</Text>
                    </Group>
                  ))}
                </SimpleGrid>
              </Card>
            </SimpleGrid>

            {/* Balance paths plot */}
            <Card withBorder shadow="md" radius="lg" p="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon color="blue" variant="light" size="md" radius="xl">
                  <IconChartBar size={15} />
                </ThemeIcon>
                <Title order={3} size="h4">Balance paths</Title>
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                Each line is one simulated session. Green = ended in profit, Red = went bust.
                Dashed orange line = starting bankroll. Click "Inspect" to see round-by-round detail.
              </Text>
              <div className="plot-wrapper">
                <Plot
                  data={pathsPlotData}
                  layout={pathsLayout}
                  config={plotConfig}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <Divider my="sm" />
              <Text size="xs" fw={600} mb="xs">
                Inspect a run (showing a representative sample of {data.sample_paths.length} runs to keep the browser fast)
              </Text>
              <ScrollArea h={120} type="auto" offsetScrollbars>
                <Group gap="xs" wrap="wrap">
                  {data.sample_paths.map((p, i) => {
                    const final = p.balance[p.balance.length - 1]
                    const bust = final <= 0
                    return (
                      <Button
                        key={i}
                        size="compact-xs"
                        variant="light"
                        color={bust ? 'red' : 'green'}
                        leftSection={<IconEye size={12} />}
                        onClick={() => setDetailIndex(i)}
                      >
                        #{i + 1} → €{fmt(final, 0)}
                      </Button>
                    )
                  })}
                </Group>
              </ScrollArea>
            </Card>

            {/* Aggregated balance + bet chart */}
            <Card withBorder shadow="md" radius="lg" p="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon color="orange" variant="light" size="md" radius="xl">
                  <IconChartBar size={15} />
                </ThemeIcon>
                <Title order={3} size="h4">Balance & Bet Size (sample runs)</Title>
              </Group>
              <Text size="xs" c="dimmed" mb="xs">
                Left axis (blue/red) = balance over time. Right axis (orange) = bet size.
                Colours: blue/orange = survived, red = went bust. Dashed line = starting bankroll.
                Showing a representative sample of {data.sample_paths.length} runs.
              </Text>
              <Group gap="sm" mb="sm">
                <Badge variant="dot" color="blue" size="sm">Balance (survived)</Badge>
                <Badge variant="dot" color="red" size="sm">Balance (bust)</Badge>
                <Badge variant="dot" color="orange" size="sm">Bet size</Badge>
              </Group>
              <div className="plot-wrapper">
                <Plot
                  data={aggregatedPlotData}
                  layout={aggregatedLayout}
                  config={plotConfig}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </Card>

            {/* Histogram */}
            <Card withBorder shadow="md" radius="lg" p="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon color="violet" variant="light" size="md" radius="xl">
                  <IconChartBar size={15} />
                </ThemeIcon>
                <Title order={3} size="h4">Final balance distribution</Title>
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                How final balances are distributed across all simulations.
                Green bars = above starting bankroll, Red bars = below.
                Dashed orange line = starting bankroll.
              </Text>
              <div className="plot-wrapper">
                <Plot
                  data={histogramPlotData}
                  layout={histLayout}
                  config={plotConfig}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </Card>

            {/* Educational note */}
            <Paper
              withBorder
              radius="xl"
              p="lg"
              style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              <Group gap="xs" mb={4}>
                <IconInfoCircle size={16} color="var(--mantine-color-red-6)" />
                <Text size="sm" fw={600} c="red.7">Why the Martingale fails</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Even though each individual loss is "recoverable" by doubling, the <b>required bet grows
                exponentially</b>. After just 10 consecutive losses with a €10 base bet you need to wager
                €10,240. The house edge (2.7% on European roulette) ensures the <b>expected value of every spin
                is negative</b>. Over enough rounds, the strategy doesn't beat the maths — it merely
                reshapes the distribution of outcomes into many small wins and rare catastrophic losses.
                Table limits and finite bankrolls make the bust scenario inevitable given enough time.
              </Text>
            </Paper>
          </>
        )}

      </Stack>
    </Container>
  )
}
