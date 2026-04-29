# moscow-fare-calculator

Production-like сервис расчёта тарифа для общественного транспорта Московской агломерации.

Проект реализует **stateless**-функцию расчёта:

```ts
calculateFare(request, tariffConfig): FareCalculationResult
```

Функция получает уже сгруппированный внешней системой список валидаций одного пассажира за транспортные сутки и синхронно возвращает результат расчёта.

## Что делает проект

- рассчитывает поездки и начисления для способов оплаты:
  - `bank_card`
  - `sbp`
  - `virtual_troika`
  - `face_pay`
- фильтрует `declined` события, дубликаты и unsupported CPPK-типы
- учитывает транспортные сутки (граница в `04:00`)
- строит детерминированные пересадочные окна
- применяет бесплатные пересадки `metro <-> mgt`, `metro <-> mck` в зоне `moscow`
- учитывает особенности ЦППК/МТППК, пары entry/exit и автодополнение
- начисляет доплату при выезде в область
- возвращает объяснимый расчёт: `trips`, `charges`, `warnings`, `totalAmountKopecks`, `tariffVersion`

## Архитектура

Single-package TypeScript проект с логическими слоями:

- `fare-core`: `src/core + src/domain + src/rules + src/schemas`
- `fare-api`: `src/api`
- `fare-worker`: `src/kafka`

### Ключевой принцип

`fare-core` не зависит от:

- Kafka
- Express
- файловой системы
- БД / Redis
- внешних API

Тарифы и справочники передаются в расчёт извне.

## Структура

- `config/tariffs/*` — тарифные JSON-конфиги
- `data/*` — справочники
- `examples/*` — готовые примеры входных запросов
- `src/core/*` — чистые функции расчёта
- `src/rules/*` — предметные правила
- `src/api/*` — HTTP API
- `src/kafka/*` — Kafka worker и topics
- `src/tests/*` — тесты правил и сценариев

## Поддержанные правила

- окно пересадки: `transferWindowMinutes` (по умолчанию 90)
- транспортные сутки: с `04:00:00.000` до `03:59:59.999`
- бесплатные пересадки из `tariffConfig.freeTransfers`
- запрет дублирования звеньев (`metro->metro`, `mck->mck`, ограничения MCD)
- ограничение MGT: максимум 2 звена в окне
- нормализация `cppkValidationType`:
  - `0` -> entry
  - `1` -> exit
  - `2` -> warning и фильтрация
  - `3/5/6` -> carrier synthetic
  - `4` -> warning `UNSUPPORTED_CPPK_TRAIN_SURCHARGE_7000`
- автодополнение MCD-пар через `data/mcd-entry-exit-rules.json` + fallback
- region surcharge при `moscow -> moscow_region`
- бесплатное `metro` после `region -> moscow` поездки в окне

## Быстрый старт

```bash
npm install
npm run typecheck
npm test
```

## Запуск API

```bash
npm run dev:api
```

- `POST /api/v1/fare/calculate`
- `GET /health`

Проверка:

```bash
curl -X POST http://localhost:3000/api/v1/fare/calculate \
  -H "Content-Type: application/json" \
  --data @examples/request-region-exit.json
```

## Запуск Kafka/Redpanda

```bash
docker compose up -d
npm run dev:worker
```

Worker читает `fare.passenger-day.ready.v1` и пишет:

- успех -> `fare.calculation.result.v1`
- Zod validation error -> `fare.calculation.dlq.v1`
- runtime error -> `fare.calculation.failed.v1`

Kafka key:

```text
passengerKey:transportDate
```

## Пример запроса

```json
{
  "requestId": "req-region-exit-1",
  "passengerKey": "pax-5",
  "transportDate": "2026-04-28",
  "paymentMethod": "bank_card",
  "validations": [
    {
      "validationId": "v1",
      "eventTime": "2026-04-28T08:00:00+03:00",
      "status": "accepted",
      "eventType": "entry",
      "mode": "metro",
      "carrier": "metro",
      "zone": "moscow"
    }
  ]
}
```

## Пример результата

```json
{
  "requestId": "req-region-exit-1",
  "passengerKey": "pax-5",
  "transportDate": "2026-04-28",
  "tariffVersion": "moscow-test",
  "paymentMethod": "bank_card",
  "currency": "RUB",
  "totalAmountKopecks": 11000,
  "trips": [],
  "charges": [],
  "warnings": []
}
```

## Ограничения и открытые вопросы

- Реализован deterministic window-based подход без глобальной оптимизации минимальной стоимости между окнами.
- Модель намеренно упрощена и не претендует на полную идентичность реальному промышленному биллингу Москвы.
- DP-операции и CPPK surcharge type `4` не тарифицируются автоматически, только сигнализируются предупреждениями.
- Для автодополнения MCD-пар при отсутствии полного справочника используется детерминированный fallback.

## Assumptions

1. Проект реализован как single-package TypeScript project, не monorepo.
2. `fare-core` — это логический слой `src/core + src/domain + src/rules + src/schemas`.
3. Реализован deterministic window-based алгоритм, без оптимизации минимальной стоимости.
4. Тарифы `moscow-test` являются тестовыми и не претендуют на полное соответствие реальным тарифам.
5. Операции ДП и доплата 7000 не тарифицируются автоматически, а возвращаются как warnings.
6. Автозакрытие МЦД-пар выполняется детерминированно через справочник или fallback-правило.
