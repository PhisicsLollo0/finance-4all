import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  NumberInput,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
} from '@mantine/core'
import type { Data, Layout, PlotDatum, PlotMouseEvent } from 'plotly.js'
import Plot from 'react-plotly.js'

export default function Simulator() {
  const apiBase =
    (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'
  const [initialInvestment, setInitialInvestment] = useState(1000)
  const [annualGrowthRate, setAnnualGrowthRate] = useState(7)
  const [feeRateA, setFeeRateA] = useState(0)
  const [feeRateB, setFeeRateB] = useState(2)
  const [years, setYears] = useState(30)
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null)
  const [investmentData, setInvestmentData] = useState<{
    years: number[]
    series: { fee_a: number[]; fee_b: number[] }
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const computedScheme = useComputedColorScheme('light')

  const chartTokens = useMemo(() => {
    if (typeof document === 'undefined') {
      return {
        text: '#1f2937',
        grid: 'rgba(148, 163, 184, 0.25)',
        zero: 'rgba(148, 163, 184, 0.55)',
        feeA: '#3b82f6',
        feeB: '#f97316',
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
      feeA:
        styles.getPropertyValue('--mantine-color-blue-6').trim() || '#3b82f6',
      feeB:
        styles.getPropertyValue('--mantine-color-orange-6').trim() || '#f97316',
    }
  }, [computedScheme])

  const plotData = useMemo<Data[]>(
    () => {
      if (!investmentData) {
        return []
      }
      return [
        {
          x: investmentData.years,
          y: investmentData.series.fee_a,
          type: 'scatter' as const,
          mode: 'lines',
          line: { color: chartTokens.feeA, width: 3, shape: 'spline' },
          fill: 'tozeroy',
          fillcolor: 'rgba(59, 130, 246, 0.18)',
          hovertemplate: 'Year %{x}<br>%{y:.2f} EUR<extra></extra>',
          name: `Fee A (${feeRateA.toFixed(2)}%)`,
        },
        {
          x: investmentData.years,
          y: investmentData.series.fee_b,
          type: 'scatter' as const,
          mode: 'lines',
          line: { color: chartTokens.feeB, width: 3, shape: 'spline' },
          fill: 'tozeroy',
          fillcolor: 'rgba(249, 115, 22, 0.18)',
          hovertemplate: 'Year %{x}<br>%{y:.2f} EUR<extra></extra>',
          name: `Fee B (${feeRateB.toFixed(2)}%)`,
        },
      ]
    },
    [investmentData, feeRateA, feeRateB, chartTokens]
  )
  const plotLayout = useMemo<Partial<Layout>>(() => {
    return {
      title: { text: '' },
      autosize: true,
      margin: { l: 60, r: 35, t: 35, b: 55 },
      legend: {
        orientation: 'h' as const,
        y: 1.08,
        x: 0,
        font: { color: chartTokens.text },
      },
      xaxis: {
        title: { text: 'Year' },
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
      },
      font: { color: chartTokens.text, family: 'Inter, system-ui, sans-serif' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      uirevision: 'static',
    }
  }, [chartTokens])
  const plotConfig = useMemo(
    () => ({ responsive: true, displayModeBar: false }),
    []
  )
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
      }),
    []
  )

  const formatPoint = useCallback(
    (point: PlotDatum) => {
      const year = Number(point.x)
      const balance = Number(point.y)
      return `Year ${year}: ${currencyFormatter.format(balance)}`
    },
    [currencyFormatter]
  )

  const handleHover = useCallback(
    (event: Readonly<PlotMouseEvent>) => {
      const point = event.points[0]
      setHoveredPoint(formatPoint(point))
    },
    [formatPoint]
  )
  const handleClick = useCallback(
    (event: Readonly<PlotMouseEvent>) => {
      const point = event.points[0]
      setSelectedPoint(formatPoint(point))
    },
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
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load simulation data.')
        }
        return response.json()
      })
      .then(
        (payload: {
          years?: number[]
          series?: { fee_a?: number[]; fee_b?: number[] }
        }) => {
          if (payload.years && payload.series?.fee_a && payload.series?.fee_b) {
            setInvestmentData({
              years: payload.years,
              series: {
                fee_a: payload.series.fee_a,
                fee_b: payload.series.fee_b,
              },
            })
          }
        }
      )
      .catch((error: Error) => {
        if (error.name !== 'AbortError') {
          setLoadError('Unable to reach the investment simulator API.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })
    return () => controller.abort()
  }, [apiBase, annualGrowthRate, feeRateA, feeRateB, initialInvestment, years])

  const toNumber = useCallback(
    (value: string | number | undefined, fallback: number) => {
      const parsed = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(parsed) ? parsed : fallback
    },
    []
  )

  const statusLabel = isLoading ? 'loading' : loadError ?? 'ready'
  const statusColor = loadError ? 'red' : isLoading ? 'yellow' : 'orange'

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Badge variant="light" color="orange">
              Finance Simulator Scaffold
            </Badge>
            <Title order={1}>Fees Impact Explorer</Title>
            <Text c="dimmed">
              Compare how fees reduce long-term investment growth.
            </Text>
          </Stack>
          <Button variant="light" component={Link} to="/">
            Back to start
          </Button>
        </Group>

        <Card withBorder shadow="md" radius="lg" p="lg">
          <Group justify="space-between" align="center" wrap="wrap" mb="sm">
            <div>
              <Badge variant="light" color="orange">
                Simulation inputs
              </Badge>
              <Title order={3} mt={6}>
                Investment assumptions
              </Title>
            </div>
            <Badge variant="light" color={statusColor}>
              Data: {statusLabel}
            </Badge>
          </Group>
          <Divider mb="md" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <NumberInput
              label="Initial investment"
              value={initialInvestment}
              min={0}
              step={100}
              rightSection={
                <Text size="xs" c="dimmed">
                  EUR
                </Text>
              }
              rightSectionWidth={50}
              onChange={(value) =>
                setInitialInvestment(toNumber(value, initialInvestment))
              }
            />
            <NumberInput
              label="Annual growth"
              value={annualGrowthRate}
              min={0}
              step={0.1}
              rightSection={
                <Text size="xs" c="dimmed">
                  %
                </Text>
              }
              rightSectionWidth={40}
              onChange={(value) =>
                setAnnualGrowthRate(toNumber(value, annualGrowthRate))
              }
            />
            <NumberInput
              label="Fee A"
              value={feeRateA}
              min={0}
              step={0.1}
              rightSection={
                <Text size="xs" c="dimmed">
                  %
                </Text>
              }
              rightSectionWidth={40}
              onChange={(value) => setFeeRateA(toNumber(value, feeRateA))}
            />
            <NumberInput
              label="Fee B"
              value={feeRateB}
              min={0}
              step={0.1}
              rightSection={
                <Text size="xs" c="dimmed">
                  %
                </Text>
              }
              rightSectionWidth={40}
              onChange={(value) => setFeeRateB(toNumber(value, feeRateB))}
            />
          </SimpleGrid>
          <Stack gap="xs" mt="md">
            <Group justify="space-between">
              <Text fw={600}>Years</Text>
              <Text c="dimmed">{years} years</Text>
            </Group>
            <Slider
              min={5}
              max={60}
              step={5}
              value={years}
              onChange={setYears}
            />
          </Stack>
        </Card>

        <Card withBorder shadow="md" radius="lg" p="lg">
          <Group justify="space-between" align="center" wrap="wrap" mb="md">
            <Title order={3}>Impact of fees</Title>
            <Text c="dimmed">Hover a point for details</Text>
          </Group>
          <div className="plot-wrapper">
            <Plot
              data={plotData}
              layout={plotLayout}
              config={plotConfig}
              onHover={handleHover}
              onUnhover={() => setHoveredPoint(null)}
              onClick={handleClick}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <Group mt="md" gap="xl" wrap="wrap">
            <Text>
              <Text span fw={600}>
                Hover:
              </Text>{' '}
              {hoveredPoint ?? 'Move over a point'}
            </Text>
            <Text>
              <Text span fw={600}>
                Selected:
              </Text>{' '}
              {selectedPoint ?? 'Click a point to lock'}
            </Text>
          </Group>
        </Card>
      </Stack>
    </Container>
  )
}
