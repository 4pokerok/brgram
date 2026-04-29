export function minutesBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  return Math.floor((b - a) / 60000)
}

export function isInsideTransferWindow(
  windowStart: string,
  eventTime: string,
  transferWindowMinutes: number
): boolean {
  return minutesBetween(windowStart, eventTime) <= transferWindowMinutes
}
