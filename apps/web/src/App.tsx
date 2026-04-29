import { useEffect, useMemo, useState } from 'react'

type PaymentMethod = 'bank_card' | 'sbp' | 'virtual_troika' | 'face_pay'

type FareCalculationRequest = {
  requestId: string
  tariffVersion?: string
  passengerKey: string
  transportDate: string
  paymentMethod: PaymentMethod
  validations: Array<Record<string, unknown>>
}

type FareCalculationResult = {
  requestId: string
  passengerKey: string
  transportDate: string
  tariffVersion: string
  paymentMethod: PaymentMethod
  currency: 'RUB'
  totalAmountKopecks: number
  trips: Array<{
    tripId: string
    windowStart: string
    windowEnd: string
    carriers: string[]
    zones: string[]
    amountKopecks: number
    fareType: string
  }>
  charges: Array<{
    chargeId: string
    tripId: string
    validationId: string
    amountKopecks: number
    chargeType: string
    reason: string
  }>
  warnings: Array<{
    code: string
    message: string
    validationId?: string
  }>
}

type CompareResult = {
  paymentMethod: PaymentMethod
  totalAmountKopecks: number
  warningCount: number
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_card: 'Bank Card',
  sbp: 'SBP',
  virtual_troika: 'Virtual Troika',
  face_pay: 'Face Pay'
}

const sampleRequests: Array<{ id: string; title: string; request: FareCalculationRequest }> = [
  {
    id: 'region-exit',
    title: 'Moscow -> Region Exit',
    request: {
      requestId: 'req-region-exit-1',
      passengerKey: 'pax-5',
      transportDate: '2026-04-28',
      paymentMethod: 'bank_card',
      validations: [
        {
          validationId: 'v1',
          eventTime: '2026-04-28T08:00:00+03:00',
          status: 'accepted',
          eventType: 'entry',
          mode: 'metro',
          carrier: 'metro',
          zone: 'moscow'
        },
        {
          validationId: 'v2',
          eventTime: '2026-04-28T08:30:00+03:00',
          status: 'accepted',
          eventType: 'onboard',
          mode: 'mgt',
          carrier: 'mgt',
          zone: 'moscow'
        },
        {
          validationId: 'v3',
          eventTime: '2026-04-28T08:50:00+03:00',
          status: 'accepted',
          eventType: 'entry',
          mode: 'cppk',
          carrier: 'cppk',
          zone: 'moscow',
          lineId: 'd1',
          cppkValidationType: 0
        },
        {
          validationId: 'v4',
          eventTime: '2026-04-28T09:10:00+03:00',
          status: 'accepted',
          eventType: 'exit',
          mode: 'cppk',
          carrier: 'cppk',
          zone: 'moscow_region',
          lineId: 'd1',
          cppkValidationType: 1
        }
      ]
    }
  },
  {
    id: 'region-to-moscow',
    title: 'Region -> Moscow -> Metro',
    request: {
      requestId: 'req-region-to-moscow-1',
      passengerKey: 'pax-6',
      transportDate: '2026-04-28',
      paymentMethod: 'bank_card',
      validations: [
        {
          validationId: 'v1',
          eventTime: '2026-04-28T08:00:00+03:00',
          status: 'accepted',
          eventType: 'entry',
          mode: 'cppk',
          carrier: 'cppk',
          zone: 'moscow_region',
          lineId: 'd1',
          cppkValidationType: 0
        },
        {
          validationId: 'v2',
          eventTime: '2026-04-28T08:40:00+03:00',
          status: 'accepted',
          eventType: 'exit',
          mode: 'cppk',
          carrier: 'cppk',
          zone: 'moscow',
          lineId: 'd1',
          cppkValidationType: 1
        },
        {
          validationId: 'v3',
          eventTime: '2026-04-28T08:55:00+03:00',
          status: 'accepted',
          eventType: 'entry',
          mode: 'metro',
          carrier: 'metro',
          zone: 'moscow'
        }
      ]
    }
  },
  {
    id: 'cppk-types',
    title: 'CPPK Types Playground',
    request: {
      requestId: 'req-cppk-types-1',
      passengerKey: 'pax-7',
      transportDate: '2026-04-28',
      paymentMethod: 'bank_card',
      validations: [
        {
          validationId: 'v1',
          eventTime: '2026-04-28T08:00:00+03:00',
          status: 'accepted',
          eventType: 'entry',
          mode: 'cppk',
          carrier: 'cppk',
          zone: 'moscow',
          lineId: 'd1',
          cppkValidationType: 0
        },
        {
          validationId: 'v2',
          eventTime: '2026-04-28T08:20:00+03:00',
          status: 'accepted',
          eventType: 'exit',
          mode: 'cppk',
          carrier: 'cppk',
          zone: 'moscow_region',
          lineId: 'd1',
          cppkValidationType: 3
        },
        {
          validationId: 'v3',
          eventTime: '2026-04-28T09:00:00+03:00',
          status: 'accepted',
          eventType: 'entry',
          mode: 'cppk',
          carrier: 'cppk',
          zone: 'moscow',
          lineId: 'd1',
          cppkValidationType: 4
        }
      ]
    }
  }
]

function formatKopecks(value: number): string {
  return `${(value / 100).toFixed(2)} ₽`
}

async function postCalculation(
  request: FareCalculationRequest
): Promise<{ ok: true; data: FareCalculationResult } | { ok: false; error: string }> {
  const response = await fetch('/api/v1/fare/calculate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })

  const responseText = await response.text()
  if (!response.ok) {
    return {
      ok: false,
      error: responseText || `HTTP ${response.status}`
    }
  }

  try {
    return {
      ok: true,
      data: JSON.parse(responseText) as FareCalculationResult
    }
  } catch {
    return {
      ok: false,
      error: 'API returned invalid JSON.'
    }
  }
}

export function App() {
  const [activeSampleId, setActiveSampleId] = useState(sampleRequests[0].id)
  const [requestText, setRequestText] = useState(
    JSON.stringify(sampleRequests[0].request, null, 2)
  )
  const [result, setResult] = useState<FareCalculationResult | null>(null)
  const [compare, setCompare] = useState<CompareResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [apiHealth, setApiHealth] = useState<'checking' | 'up' | 'down'>('checking')

  useEffect(() => {
    let cancelled = false

    const checkHealth = async () => {
      try {
        const response = await fetch('/health')
        if (!cancelled) {
          setApiHealth(response.ok ? 'up' : 'down')
        }
      } catch {
        if (!cancelled) {
          setApiHealth('down')
        }
      }
    }

    void checkHealth()
    const intervalId = window.setInterval(() => {
      void checkHealth()
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  const parsedRequest = useMemo(() => {
    try {
      return JSON.parse(requestText) as FareCalculationRequest
    } catch {
      return null
    }
  }, [requestText])

  const handleLoadSample = (sampleId: string) => {
    const sample = sampleRequests.find((entry) => entry.id === sampleId)
    if (!sample) {
      return
    }
    setActiveSampleId(sample.id)
    setRequestText(JSON.stringify(sample.request, null, 2))
    setResult(null)
    setCompare([])
    setError(null)
  }

  const handleFormatJson = () => {
    if (!parsedRequest) {
      setError('JSON is invalid. Fix syntax before formatting.')
      return
    }
    setRequestText(JSON.stringify(parsedRequest, null, 2))
    setError(null)
  }

  const handleCalculate = async () => {
    if (!parsedRequest) {
      setError('JSON is invalid. Cannot send request.')
      return
    }

    setIsLoading(true)
    setError(null)
    setCompare([])

    try {
      const response = await postCalculation(parsedRequest)
      if (!response.ok) {
        setError(response.error)
        setResult(null)
        return
      }
      setResult(response.data)
    } catch (calculationError) {
      const message =
        calculationError instanceof Error ? calculationError.message : 'Unknown frontend error'
      setError(message)
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleComparePaymentMethods = async () => {
    if (!parsedRequest) {
      setError('JSON is invalid. Cannot run comparison.')
      return
    }

    const methods: PaymentMethod[] = ['bank_card', 'sbp', 'virtual_troika', 'face_pay']
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const responses = await Promise.all(
        methods.map((paymentMethod) =>
          postCalculation({
            ...parsedRequest,
            paymentMethod
          })
        )
      )

      const failed = responses.find((entry) => !entry.ok)
      if (failed && !failed.ok) {
        setError(failed.error)
        setCompare([])
        return
      }

      const compareRows = responses
        .filter((entry): entry is { ok: true; data: FareCalculationResult } => entry.ok)
        .map((entry) => ({
          paymentMethod: entry.data.paymentMethod,
          totalAmountKopecks: entry.data.totalAmountKopecks,
          warningCount: entry.data.warnings.length
        }))

      setCompare(compareRows)
    } catch (compareError) {
      const message = compareError instanceof Error ? compareError.message : 'Unknown comparison error'
      setError(message)
      setCompare([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Fare Playground</h1>
        <p className="sidebar-subtitle">
          UI for Moscow fare calculation core. Build requests, run pricing, inspect every charge.
        </p>

        <div className="status-card">
          <span className={`status-dot status-${apiHealth}`} />
          <div>
            <div className="status-title">API Status</div>
            <div className="status-value">
              {apiHealth === 'checking' && 'Checking'}
              {apiHealth === 'up' && 'Connected to /health'}
              {apiHealth === 'down' && 'API unavailable'}
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Scenarios</div>
          <div className="sample-list">
            {sampleRequests.map((sample) => (
              <button
                key={sample.id}
                className={sample.id === activeSampleId ? 'sample-button active' : 'sample-button'}
                onClick={() => handleLoadSample(sample.id)}
              >
                {sample.title}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-title">Quick Actions</div>
          <button onClick={handleFormatJson} className="action-button secondary">
            Format JSON
          </button>
          <button onClick={handleComparePaymentMethods} className="action-button">
            Compare Payment Methods
          </button>
          <button onClick={handleCalculate} className="action-button primary">
            {isLoading ? 'Calculating...' : 'Calculate Fare'}
          </button>
        </div>
      </aside>

      <main className="content">
        <section className="panel request-panel">
          <div className="panel-header">
            <h2>FareCalculationRequest</h2>
            <span className={parsedRequest ? 'json-state valid' : 'json-state invalid'}>
              {parsedRequest ? 'Valid JSON' : 'Invalid JSON'}
            </span>
          </div>
          <textarea
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            spellCheck={false}
            className="json-editor"
          />
        </section>

        <section className="panel result-panel">
          <div className="panel-header">
            <h2>Calculation Result</h2>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}

          {result ? (
            <>
              <div className="metrics-grid">
                <article className="metric-card">
                  <span className="metric-label">Total</span>
                  <strong>{formatKopecks(result.totalAmountKopecks)}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Trips</span>
                  <strong>{result.trips.length}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Charges</span>
                  <strong>{result.charges.length}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Warnings</span>
                  <strong>{result.warnings.length}</strong>
                </article>
              </div>

              <div className="split-grid">
                <article className="card">
                  <h3>Trips Timeline</h3>
                  <ul className="timeline">
                    {result.trips.map((trip) => (
                      <li key={trip.tripId}>
                        <div className="timeline-top">
                          <strong>{trip.fareType}</strong>
                          <span>{formatKopecks(trip.amountKopecks)}</span>
                        </div>
                        <div className="timeline-meta">
                          {trip.windowStart} → {trip.windowEnd}
                        </div>
                        <div className="chip-row">
                          {trip.carriers.map((carrier) => (
                            <span key={`${trip.tripId}-${carrier}`} className={`chip carrier-${carrier}`}>
                              {carrier}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="card">
                  <h3>Warnings</h3>
                  {result.warnings.length === 0 ? (
                    <p className="empty-text">No warnings for this request.</p>
                  ) : (
                    <ul className="warnings-list">
                      {result.warnings.map((warning) => (
                        <li key={`${warning.code}-${warning.validationId ?? ''}`}>
                          <strong>{warning.code}</strong>
                          <p>{warning.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              <article className="card">
                <h3>Charges Breakdown</h3>
                <table className="charges-table">
                  <thead>
                    <tr>
                      <th>Charge Type</th>
                      <th>Reason</th>
                      <th>Validation</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.charges.map((charge) => (
                      <tr key={charge.chargeId}>
                        <td>{charge.chargeType}</td>
                        <td>{charge.reason}</td>
                        <td>{charge.validationId}</td>
                        <td>{formatKopecks(charge.amountKopecks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </>
          ) : (
            <div className="placeholder">
              <p>Run calculation to see trips, charges, warnings, and detailed reasoning.</p>
            </div>
          )}

          {compare.length > 0 ? (
            <article className="card">
              <h3>Payment Method Comparison</h3>
              <div className="compare-grid">
                {compare.map((row) => (
                  <div key={row.paymentMethod} className="compare-item">
                    <span>{paymentMethodLabels[row.paymentMethod]}</span>
                    <strong>{formatKopecks(row.totalAmountKopecks)}</strong>
                    <small>{row.warningCount} warnings</small>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      </main>
    </div>
  )
}
