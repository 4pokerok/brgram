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

type ValidationFeedItem = {
  validationId: string
  eventTime: string
  passengerKey: string
  carrier: string
  mode: string
  eventType: string
  status: string
  zone: string
  transportDate?: string
  topic: string
  partition: number
  offset: string
}

type ValidationFeedResponse = {
  sourceTopic: string
  connected: boolean
  lastError?: string
  lastMessageAt?: string
  count: number
  items: ValidationFeedItem[]
}

type ApiStatus = 'unknown' | 'up' | 'down'
type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'fare-ui-theme'

const chargeTypeLabels: Record<string, string> = {
  base_fare: 'Базовый тариф',
  free_transfer: 'Бесплатная пересадка',
  region_surcharge: 'Доплата за выезд в область',
  mcd_entry_included: 'Вход МЦД включен в окно',
  mcd_exit_completion: 'Автозавершение выхода МЦД',
  mcd_entry_completion: 'Автодобавление входа МЦД',
  adjustment: 'Корректировка'
}

const chargeReasonLabels: Record<string, string> = {
  BASE_FARE: 'Базовый тариф',
  FREE_TRANSFER_WITHIN_90_MINUTES: 'Бесплатная пересадка в пределах 90 минут',
  METRO_TO_MGT_FREE_TRANSFER: 'Бесплатная пересадка метро -> МГТ',
  MGT_TO_METRO_FREE_TRANSFER: 'Бесплатная пересадка МГТ -> метро',
  METRO_TO_MCK_FREE_TRANSFER: 'Бесплатная пересадка метро -> МЦК',
  MCK_TO_METRO_FREE_TRANSFER: 'Бесплатная пересадка МЦК -> метро',
  MCD_ENTRY_INCLUDED_IN_WINDOW: 'Вход МЦД включен в текущее окно',
  MCD_EXIT_COMPLETION: 'Автозавершение выхода МЦД',
  MCD_ENTRY_COMPLETION: 'Автодобавление входа МЦД',
  MCD_PAIR_AUTO_COMPLETED_BY_CARRIER: 'Пара МЦД автозакрыта перевозчиком',
  MCD_PAIR_AUTO_COMPLETED_BY_FARE_CORE: 'Пара МЦД автозакрыта движком тарифа',
  MOSCOW_TO_REGION_EXIT_SURCHARGE: 'Доплата за выезд из Москвы в область',
  REGION_TO_MOSCOW_FREE_METRO_TRANSFER: 'Бесплатная пересадка на метро после въезда в Москву',
  SAME_CARRIER_NEW_WINDOW: 'Новое окно из-за повторного перевозчика',
  WINDOW_EXPIRED: 'Пересадочное окно истекло',
  TRANSPORT_DAY_BOUNDARY: 'Граница транспортных суток',
  DUPLICATED_LINK_NEW_WINDOW: 'Новое окно из-за дублирования звена',
  UNSUPPORTED_CPPK_TRAIN_SURCHARGE_7000: 'Доплата ЦППК 7000 требует ручной обработки'
}

const fareTypeLabels: Record<string, string> = {
  single_ride: 'Одиночная поездка',
  transfer_window: 'Пересадочное окно',
  transfer_window_with_region_surcharge: 'Пересадка с доплатой за область',
  region_to_moscow_with_free_metro_transfer: 'Область -> Москва с бесплатным метро',
  mcd_pair: 'Пара МЦД (вход-выход)',
  mcd_auto_completed_pair: 'Автодополненная пара МЦД',
  unknown: 'Неизвестный тип поездки'
}

const eventTypeLabels: Record<string, string> = {
  entry: 'Вход',
  exit: 'Выход',
  onboard: 'Посадка',
  unknown: 'Неизвестно'
}

const validationStatusLabels: Record<string, string> = {
  accepted: 'Принято',
  declined: 'Отклонено',
  unknown: 'Неизвестно'
}

const carrierLabels: Record<string, string> = {
  metro: 'Метро',
  mck: 'МЦК',
  mgt: 'МГТ',
  cppk: 'ЦППК',
  mtppk: 'МТППК',
  unknown: 'Неизвестно'
}

const modeLabels: Record<string, string> = {
  metro: 'Метро',
  mck: 'МЦК',
  mgt: 'МГТ',
  cppk: 'ЦППК',
  mtppk: 'МТППК',
  unknown: 'Неизвестно'
}

const zoneLabels: Record<string, string> = {
  moscow: 'Москва',
  moscow_region: 'Московская область',
  unknown: 'Неизвестно'
}

const warningTranslations: Record<string, { title: string; message: string }> = {
  DECLINED_VALIDATION_IGNORED: {
    title: 'Отклоненная валидация пропущена',
    message: 'Событие со статусом declined исключено из расчета.'
  },
  DUPLICATE_VALIDATION_IGNORED: {
    title: 'Дубликат валидации пропущен',
    message: 'Повторное событие не участвует в расчете.'
  },
  EVENT_OUTSIDE_REQUEST_TRANSPORT_DATE: {
    title: 'Событие вне транспортных суток',
    message: 'Событие относится к другим транспортным суткам.'
  },
  MCD_PAIR_AUTO_COMPLETED: {
    title: 'Пара МЦД автодополнена',
    message: 'Отсутствующая операция входа/выхода МЦД была добавлена автоматически.'
  },
  MCD_PAIR_BROKE_TRANSFER_CHAIN: {
    title: 'Цепочка пересадок прервана',
    message: 'Из-за неполной пары МЦД бесплатная цепочка пересадок завершена.'
  },
  UNSUPPORTED_CPPK_TRAIN_SURCHARGE_7000: {
    title: 'Доплата ЦППК 7000 не поддержана',
    message: 'Автотарификация для типа ЦППК 4 не выполняется, нужна ручная обработка.'
  },
  DP_VALIDATION_TYPE_FILTERED_OR_UNSUPPORTED: {
    title: 'Операция дальнего пригорода пропущена',
    message: 'Тип валидации ДП не поддержан для автоматического расчета.'
  },
  TRANSPORT_DAY_BOUNDARY_SPLIT: {
    title: 'Разрыв по транспортным суткам',
    message: 'Окно пересадки разорвано из-за перехода на новые транспортные сутки.'
  },
  DUPLICATED_LINK_STARTED_NEW_WINDOW: {
    title: 'Повторное звено открыло новое окно',
    message: 'Дублирующее транспортное звено начало новую поездку.'
  },
  CPPK_VALIDATION_TYPE_IGNORED_FOR_NON_CPPK_CARRIER: {
    title: 'Тип ЦППК проигнорирован',
    message: 'Поле cppkValidationType получено не от ЦППК/МТППК и не учитывается.'
  }
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

function getChargeTypeLabel(chargeType: string): string {
  return chargeTypeLabels[chargeType] ?? chargeType
}

function getChargeReasonLabel(reason: string): string {
  return chargeReasonLabels[reason] ?? reason
}

function getFareTypeLabel(fareType: string): string {
  return fareTypeLabels[fareType] ?? fareType
}

function getWarningTitle(code: string): string {
  return warningTranslations[code]?.title ?? code
}

function getWarningMessage(code: string, fallbackMessage: string): string {
  return warningTranslations[code]?.message ?? fallbackMessage
}

function getEventTypeLabel(eventType: string): string {
  return eventTypeLabels[eventType] ?? eventType
}

function getValidationStatusLabel(status: string): string {
  return validationStatusLabels[status] ?? status
}

function getCarrierLabel(carrier: string): string {
  return carrierLabels[carrier] ?? carrier
}

function getModeLabel(mode: string): string {
  return modeLabels[mode] ?? mode
}

function getZoneLabel(zone: string): string {
  return zoneLabels[zone] ?? zone
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
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
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [feedItems, setFeedItems] = useState<ValidationFeedItem[]>([])
  const [feedConnected, setFeedConnected] = useState(false)
  const [feedLastError, setFeedLastError] = useState<string | null>(null)
  const [feedLastMessageAt, setFeedLastMessageAt] = useState<string | null>(null)
  const [feedPassengerKey, setFeedPassengerKey] = useState('')
  const [feedTransportDate, setFeedTransportDate] = useState('')
  const [feedCarrier, setFeedCarrier] = useState('')
  const [feedLoading, setFeedLoading] = useState(false)
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    let active = true

    const loadFeed = async () => {
      if (!active) {
        return
      }
      setFeedLoading(true)

      try {
        const params = new URLSearchParams()
        if (feedPassengerKey.trim()) {
          params.set('passengerKey', feedPassengerKey.trim())
        }
        if (feedTransportDate.trim()) {
          params.set('transportDate', feedTransportDate.trim())
        }
        if (feedCarrier.trim()) {
          params.set('carrier', feedCarrier.trim())
        }
        params.set('limit', '50')

        const response = await fetch(`/api/v1/kafka/validations?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const body = (await response.json()) as ValidationFeedResponse
        if (!active) {
          return
        }
        setFeedItems(body.items)
        setFeedConnected(body.connected)
        setFeedLastError(body.lastError ?? null)
        setFeedLastMessageAt(body.lastMessageAt ?? null)
      } catch (unknownError) {
        if (!active) {
          return
        }
        const message = unknownError instanceof Error ? unknownError.message : 'Ошибка загрузки feed'
        setFeedConnected(false)
        setFeedLastError(message)
      } finally {
        if (active) {
          setFeedLoading(false)
        }
      }
    }

    void loadFeed()
    const timer = window.setInterval(() => {
      void loadFeed()
    }, 4000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [feedPassengerKey, feedTransportDate, feedCarrier])

  return (
    <div className="layout clean-layout">
      <main className="content single-column">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-header-row">
              <h2>МТТЕХ - расчет поездок</h2>
              <button
                className="action-button secondary theme-toggle"
                onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              >
                {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              </button>
            </div>
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

          <article className="card feed-card">
            <div className="result-controls">
              <h3>Лента событий</h3>
            </div>
            <div className="feed-filters">
              <input
                className="feed-input"
                placeholder="Ключ пассажира"
                value={feedPassengerKey}
                onChange={(event) => setFeedPassengerKey(event.target.value)}
              />
              <input
                className="feed-input"
                placeholder="Дата перевозки (ГГГГ-ММ-ДД)"
                value={feedTransportDate}
                onChange={(event) => setFeedTransportDate(event.target.value)}
              />
              <select
                className="feed-input"
                value={feedCarrier}
                onChange={(event) => setFeedCarrier(event.target.value)}
              >
                <option value="">Все перевозчики</option>
                <option value="metro">Метро</option>
                <option value="mck">МЦК</option>
                <option value="mgt">МГТ</option>
                <option value="cppk">ЦППК</option>
                <option value="mtppk">МТППК</option>
              </select>
            </div>
            <div className="feed-status">
              Последнее событие: {feedLastMessageAt ?? 'нет'} {feedLastError ? `| Ошибка: ${feedLastError}` : ''}
            </div>
            <div className="feed-table-wrap">
              <table className="charges-table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Пассажир</th>
                    <th>Перевозчик</th>
                    <th>Режим</th>
                    <th>Тип / статус</th>
                    <th>Зона</th>
                    <th>ID валидации</th>
                  </tr>
                </thead>
                <tbody>
                  {feedItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-feed-cell">
                        Событий пока нет (или фильтр слишком узкий).
                      </td>
                    </tr>
                  ) : (
                    feedItems.map((item) => (
                      <tr key={`${item.topic}-${item.partition}-${item.offset}-${item.validationId}`}>
                        <td>{item.eventTime}</td>
                        <td>{item.passengerKey}</td>
                        <td>{getCarrierLabel(item.carrier)}</td>
                        <td>{getModeLabel(item.mode)}</td>
                        <td>
                          {getEventTypeLabel(item.eventType)} / {getValidationStatusLabel(item.status)}
                        </td>
                        <td>{getZoneLabel(item.zone)}</td>
                        <td>{item.validationId}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

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
                          <strong>{getFareTypeLabel(trip.fareType)}</strong>
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
                          <strong>{getWarningTitle(warning.code)}</strong>
                          <p>{getWarningMessage(warning.code, warning.message)}</p>
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
                        <td>{getChargeTypeLabel(charge.chargeType)}</td>
                        <td>{getChargeReasonLabel(charge.reason)}</td>
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
