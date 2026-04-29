function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  return `${year}-${month}-${day}`
}

export function getTransportDay(eventTime: string): string {
  const date = new Date(eventTime)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid eventTime: ${eventTime}`)
  }

  const adjusted = new Date(date.getTime() - 4 * 60 * 60 * 1000)
  return formatLocalDate(adjusted)
}

export function isSameTransportDay(a: string, b: string): boolean {
  return getTransportDay(a) === getTransportDay(b)
}
