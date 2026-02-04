import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

  const plotData = useMemo(
    () => {
      if (!investmentData) {
        return []
      }
      return [
        {
          x: investmentData.years,
          y: investmentData.series.fee_a,
          type: 'scatter',
          mode: 'lines',
          line: { color: '#60a5fa', width: 3, shape: 'spline' },
          fill: 'tozeroy',
          fillcolor: 'rgba(96, 165, 250, 0.2)',
          hovertemplate: 'Year %{x}<br>%{y:.2f} EUR<extra></extra>',
          name: `Fee A (${feeRateA.toFixed(2)}%)`,
        },
        {
          x: investmentData.years,
          y: investmentData.series.fee_b,
          type: 'scatter',
          mode: 'lines',
          line: { color: '#f97316', width: 3, shape: 'spline' },
          fill: 'tozeroy',
          fillcolor: 'rgba(249, 115, 22, 0.2)',
          hovertemplate: 'Year %{x}<br>%{y:.2f} EUR<extra></extra>',
          name: `Fee B (${feeRateB.toFixed(2)}%)`,
        },
      ]
    },
    [investmentData, feeRateA, feeRateB]
  )
  const plotLayout = useMemo(
    () => ({
      title: 'Impact of Fees on Investment',
      autosize: true,
      margin: { l: 60, r: 35, t: 70, b: 55 },
      legend: {
        orientation: 'h',
        y: 1.08,
        x: 0,
        font: { color: '#e2e8f0' },
      },
      xaxis: {
        title: 'Year',
        gridcolor: 'rgba(148, 163, 184, 0.12)',
        zerolinecolor: 'rgba(148, 163, 184, 0.35)',
        color: '#e2e8f0',
        ticks: 'outside',
        ticklen: 6,
        tickcolor: 'rgba(148, 163, 184, 0.35)',
      },
      yaxis: {
        title: 'Balance (EUR)',
        gridcolor: 'rgba(148, 163, 184, 0.12)',
        zerolinecolor: 'rgba(148, 163, 184, 0.35)',
        color: '#e2e8f0',
        ticks: 'outside',
        ticklen: 6,
        tickcolor: 'rgba(148, 163, 184, 0.35)',
      },
      font: { color: '#e2e8f0', family: 'Inter, system-ui, sans-serif' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      uirevision: 'static',
    }),
    []
  )
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
    (point: Plotly.PlotDatum) => {
      const year = Number(point.x)
      const balance = Number(point.y)
      return `Year ${year}: ${currencyFormatter.format(balance)}`
    },
    [currencyFormatter]
  )

  const handleHover = useCallback(
    (event: Readonly<Plotly.PlotMouseEvent>) => {
      const point = event.points[0]
      setHoveredPoint(formatPoint(point))
    },
    [formatPoint]
  )
  const handleClick = useCallback(
    (event: Readonly<Plotly.PlotMouseEvent>) => {
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

  const toNumber = useCallback((value: string, fallback: number) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }, [])

  return (
    <div className="app">
      <header className="app-header app-header-row">
        <div>
          <p className="app-kicker">Finance Simulator Scaffold</p>
          <h1>Fees Impact Explorer</h1>
          <p className="app-subtitle">
            Compare how fees reduce long-term investment growth.
          </p>
        </div>
        <Link className="ghost-button" to="/">
          Back to start
        </Link>
      </header>
      <section className="controls">
        <div className="controls-header">
          <div>
            <p className="controls-kicker">Simulation inputs</p>
            <h2 className="controls-title">Investment assumptions</h2>
          </div>
          <div className="controls-status">
            <span className="detail-label">Data:</span>{' '}
            {isLoading ? 'loading' : loadError ?? 'ready'}
          </div>
        </div>
        <div className="control-grid">
          <label className="control-field" htmlFor="initial">
            <span className="control-label">Initial investment</span>
            <div className="control-input">
              <input
                id="initial"
                type="number"
                min={0}
                step={100}
                value={initialInvestment}
                onChange={(event) =>
                  setInitialInvestment(
                    toNumber(event.target.value, initialInvestment)
                  )
                }
              />
              <span className="control-unit">EUR</span>
            </div>
          </label>
          <label className="control-field" htmlFor="growth">
            <span className="control-label">Annual growth</span>
            <div className="control-input">
              <input
                id="growth"
                type="number"
                min={0}
                step={0.1}
                value={annualGrowthRate}
                onChange={(event) =>
                  setAnnualGrowthRate(
                    toNumber(event.target.value, annualGrowthRate)
                  )
                }
              />
              <span className="control-unit">%</span>
            </div>
          </label>
          <label className="control-field" htmlFor="fee-a">
            <span className="control-label">Fee A</span>
            <div className="control-input">
              <input
                id="fee-a"
                type="number"
                min={0}
                step={0.1}
                value={feeRateA}
                onChange={(event) =>
                  setFeeRateA(toNumber(event.target.value, feeRateA))
                }
              />
              <span className="control-unit">%</span>
            </div>
          </label>
          <label className="control-field" htmlFor="fee-b">
            <span className="control-label">Fee B</span>
            <div className="control-input">
              <input
                id="fee-b"
                type="number"
                min={0}
                step={0.1}
                value={feeRateB}
                onChange={(event) =>
                  setFeeRateB(toNumber(event.target.value, feeRateB))
                }
              />
              <span className="control-unit">%</span>
            </div>
          </label>
          <label className="control-field control-field-wide" htmlFor="years">
            <span className="control-label">
              Years <span className="control-value">{years}</span>
            </span>
            <input
              id="years"
              type="range"
              min={5}
              max={60}
              step={5}
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
            />
          </label>
        </div>
      </section>
      <section className="plot-card">
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
        <div className="plot-details">
          <div>
            <span className="detail-label">Hover:</span>{' '}
            {hoveredPoint ?? 'Move over a point'}
          </div>
          <div>
            <span className="detail-label">Selected:</span>{' '}
            {selectedPoint ?? 'Click a point to lock'}
          </div>
        </div>
      </section>
    </div>
  )
}
