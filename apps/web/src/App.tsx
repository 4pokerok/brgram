import { useEffect, useMemo, useRef, useState } from 'react'

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
    amountKopecks: number
    fareType: string
  }>
  charges: Array<{
    chargeId: string
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

type ApiStatus = 'unknown' | 'up' | 'down'

const scenarios: Array<{ id: string; title: string; request: FareCalculationRequest }> = [
  {
    id: 'region-exit',
    title: 'Москва → область (доплата)',
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
    title: 'Область → Москва → метро',
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
    title: 'Типы валидаций ЦППК',
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

async function callFareApi(
  request: FareCalculationRequest
): Promise<{ ok: true; data: FareCalculationResult } | { ok: false; error: string }> {
  const response = await fetch('/api/v1/fare/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })

  const body = await response.text()
  if (!response.ok) {
    return { ok: false, error: body || `HTTP ${response.status}` }
  }

  try {
    return { ok: true, data: JSON.parse(body) as FareCalculationResult }
  } catch {
    return { ok: false, error: 'API вернул невалидный JSON.' }
  }
}

export function App() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id)
  const [result, setResult] = useState<FareCalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('unknown')
  const [onlyPaidCharges, setOnlyPaidCharges] = useState(false)
  const requestSequenceRef = useRef(0)

  const scenario = useMemo(
    () => scenarios.find((entry) => entry.id === scenarioId) ?? scenarios[0],
    [scenarioId]
  )

  const visibleCharges = useMemo(() => {
    if (!result) {
      return []
    }
    return onlyPaidCharges
      ? result.charges.filter((charge) => charge.amountKopecks > 0)
      : result.charges
  }, [onlyPaidCharges, result])

  const checkApi = async () => {
    try {
      const response = await fetch('/health')
      setApiStatus(response.ok ? 'up' : 'down')
    } catch {
      setApiStatus('down')
    }
  }

  const calculateFare = async (request: FareCalculationRequest) => {
    const requestSequence = ++requestSequenceRef.current
    setIsLoading(true)
    setError(null)

    try {
      const response = await callFareApi(request)
      if (requestSequence !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        setResult(null)
        setError(response.error)
        return
      }
      setResult(response.data)
    } catch (unknownError) {
      if (requestSequence !== requestSequenceRef.current) {
        return
      }

      const message = unknownError instanceof Error ? unknownError.message : 'Неизвестная ошибка'
      setResult(null)
      setError(message)
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    void calculateFare(scenario.request)
  }, [scenarioId])

  return (
    <div className="layout clean-layout">
      <main className="content single-column">
        <section className="panel">
          <div className="panel-header">
            <h2>Калькулятор тарифа</h2>
          </div>

          <div className="top-controls">
            <div className="scenario-row">
              {scenarios.map((entry) => (
                <button
                  key={entry.id}
                  className={entry.id === scenarioId ? 'scenario-button active' : 'scenario-button'}
                  onClick={() => setScenarioId(entry.id)}
                >
                  {entry.title}
                </button>
              ))}
            </div>

            <div className="button-row">
              <button className="action-button secondary" onClick={checkApi}>
                Проверить API
              </button>
            </div>

            <div className="status-inline">
              API:{' '}
              {apiStatus === 'unknown' && 'не проверен'}
              {apiStatus === 'up' && 'доступен'}
              {apiStatus === 'down' && 'недоступен'}
            </div>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}

          {result ? (
            <>
              <div className="metrics-grid compact-grid">
                <article className="metric-card">
                  <span className="metric-label">Итого</span>
                  <strong>{formatKopecks(result.totalAmountKopecks)}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Поездки</span>
                  <strong>{result.trips.length}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Начисления</span>
                  <strong>{result.charges.length}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Предупреждения</span>
                  <strong>{result.warnings.length}</strong>
                </article>
              </div>

              <div className="split-grid">
                <article className="card">
                  <h3>Поездки</h3>
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
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="card">
                  <h3>Предупреждения</h3>
                  {result.warnings.length === 0 ? (
                    <p className="empty-text">Предупреждений нет.</p>
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
                <div className="result-controls">
                  <h3>Начисления</h3>
                  <label className="check-input">
                    <input
                      type="checkbox"
                      checked={onlyPaidCharges}
                      onChange={(event) => setOnlyPaidCharges(event.target.checked)}
                    />
                    Только платные
                  </label>
                </div>
                <table className="charges-table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Причина</th>
                      <th>ID</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCharges.map((charge) => (
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
              <p>{isLoading ? 'Считаем тариф...' : 'Выбери сценарий для расчета.'}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
