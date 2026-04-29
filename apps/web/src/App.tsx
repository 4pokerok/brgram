import { useMemo, useState } from 'react'

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

type ApiStatus = 'unknown' | 'up' | 'down'

const paymentMethods: PaymentMethod[] = ['bank_card', 'sbp', 'virtual_troika', 'face_pay']

const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_card: 'Банковская карта',
  sbp: 'СБП',
  virtual_troika: 'Виртуальная Тройка',
  face_pay: 'Face Pay'
}

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

function tryParseRequest(json: string): FareCalculationRequest | null {
  try {
    return JSON.parse(json) as FareCalculationRequest
  } catch {
    return null
  }
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
  const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0].id)
  const [requestText, setRequestText] = useState(JSON.stringify(scenarios[0].request, null, 2))
  const [result, setResult] = useState<FareCalculationResult | null>(null)
  const [compare, setCompare] = useState<CompareResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('unknown')
  const [onlyPaidCharges, setOnlyPaidCharges] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  const parsedRequest = useMemo(() => tryParseRequest(requestText), [requestText])

  const visibleCharges = useMemo(() => {
    if (!result) {
      return []
    }
    if (!onlyPaidCharges) {
      return result.charges
    }
    return result.charges.filter((charge) => charge.amountKopecks > 0)
  }, [onlyPaidCharges, result])

  const checkApi = async () => {
    try {
      const response = await fetch('/health')
      setApiStatus(response.ok ? 'up' : 'down')
    } catch {
      setApiStatus('down')
    }
  }

  const loadScenario = (scenarioId: string) => {
    const scenario = scenarios.find((entry) => entry.id === scenarioId)
    if (!scenario) {
      return
    }

    setActiveScenarioId(scenario.id)
    setRequestText(JSON.stringify(scenario.request, null, 2))
    setResult(null)
    setCompare([])
    setError(null)
  }

  const formatJson = () => {
    if (!parsedRequest) {
      setError('JSON невалидный. Сначала исправь синтаксис.')
      return
    }
    setRequestText(JSON.stringify(parsedRequest, null, 2))
    setError(null)
  }

  const calculateFare = async () => {
    if (!parsedRequest) {
      setError('JSON невалидный. Нельзя отправить запрос.')
      return
    }

    setIsLoading(true)
    setError(null)
    setCompare([])

    try {
      const response = await callFareApi(parsedRequest)
      if (!response.ok) {
        setError(response.error)
        setResult(null)
        return
      }

      setResult(response.data)
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : 'Неизвестная ошибка'
      setError(message)
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  const comparePaymentMethods = async () => {
    if (!parsedRequest) {
      setError('JSON невалидный. Нельзя запустить сравнение.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const results = await Promise.all(
        paymentMethods.map((paymentMethod) =>
          callFareApi({
            ...parsedRequest,
            paymentMethod
          })
        )
      )

      const failed = results.find((item) => !item.ok)
      if (failed && !failed.ok) {
        setCompare([])
        setError(failed.error)
        return
      }

      const rows = results
        .filter((item): item is { ok: true; data: FareCalculationResult } => item.ok)
        .map((item) => ({
          paymentMethod: item.data.paymentMethod,
          totalAmountKopecks: item.data.totalAmountKopecks,
          warningCount: item.data.warnings.length
        }))
      setCompare(rows)
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : 'Неизвестная ошибка'
      setError(message)
      setCompare([])
    } finally {
      setIsLoading(false)
    }
  }

  const copyResultJson = async () => {
    if (!result) {
      return
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      setCopyMessage('Результат скопирован')
      window.setTimeout(() => {
        setCopyMessage('')
      }, 1500)
    } catch {
      setCopyMessage('Не удалось скопировать')
      window.setTimeout(() => {
        setCopyMessage('')
      }, 1500)
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Тарифный Playground</h1>
        <p className="sidebar-subtitle">
          Быстрый интерфейс для проверки `calculateFare`: загрузи сценарий, посмотри поездки,
          начисления и предупреждения.
        </p>

        <div className="status-card">
          <span className={`status-dot status-${apiStatus}`} />
          <div>
            <div className="status-title">Статус API</div>
            <div className="status-value">
              {apiStatus === 'unknown' && 'не проверен'}
              {apiStatus === 'up' && 'API доступен'}
              {apiStatus === 'down' && 'API недоступен'}
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Сценарии</div>
          <div className="sample-list">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                className={
                  scenario.id === activeScenarioId ? 'sample-button active' : 'sample-button'
                }
                onClick={() => loadScenario(scenario.id)}
              >
                {scenario.title}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-title">Действия</div>
          <button className="action-button secondary" onClick={checkApi}>
            Проверить API
          </button>
          <button className="action-button secondary" onClick={formatJson}>
            Форматировать JSON
          </button>
          <button className="action-button primary" onClick={calculateFare}>
            {isLoading ? 'Считаем...' : 'Рассчитать'}
          </button>
          <button className="action-button" onClick={comparePaymentMethods}>
            Сравнить способы оплаты
          </button>
        </div>
      </aside>

      <main className="content">
        <section className="panel request-panel">
          <div className="panel-header">
            <h2>Запрос FareCalculationRequest</h2>
            <span className={parsedRequest ? 'json-state valid' : 'json-state invalid'}>
              {parsedRequest ? 'JSON корректен' : 'Ошибка JSON'}
            </span>
          </div>
          <textarea
            className="json-editor"
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            spellCheck={false}
          />
        </section>

        <section className="panel result-panel">
          <div className="panel-header">
            <h2>Результат расчёта</h2>
            {result ? (
              <div className="panel-actions">
                <button className="copy-button" onClick={copyResultJson}>
                  Скопировать JSON
                </button>
                {copyMessage ? <span className="copy-message">{copyMessage}</span> : null}
              </div>
            ) : null}
          </div>

          {error ? <div className="error-banner">{error}</div> : null}

          {result ? (
            <>
              <div className="metrics-grid">
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
                  <h3>Лента поездок</h3>
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
                    Только платные начисления
                  </label>
                </div>

                <table className="charges-table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Причина</th>
                      <th>Validation ID</th>
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
              <p>
                Нажми «Рассчитать», чтобы увидеть поездки, начисления, предупреждения и итоговую
                сумму.
              </p>
            </div>
          )}

          {compare.length > 0 ? (
            <article className="card">
              <h3>Сравнение способов оплаты</h3>
              <div className="compare-grid">
                {compare.map((row) => (
                  <div key={row.paymentMethod} className="compare-item">
                    <span>{paymentMethodLabels[row.paymentMethod]}</span>
                    <strong>{formatKopecks(row.totalAmountKopecks)}</strong>
                    <small>Предупреждений: {row.warningCount}</small>
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
