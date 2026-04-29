import { CalculationWarning } from '../domain/result.js'
import { ValidationEvent } from '../domain/validation.js'
import { WarningCode } from '../domain/warningCodes.js'
import { canMergeConsecutiveEvents, isDuplicatedLinkBreak } from '../rules/consecutiveCarrierRule.js'
import { isInsideTransferWindow } from '../rules/transferWindowRule.js'
import { isTransportDayBoundary } from '../rules/transportDayBoundaryRule.js'

type BuildTripWindowsResult = {
  windows: ValidationEvent[][]
  warnings: CalculationWarning[]
}

export function buildTripWindows(
  validations: ValidationEvent[],
  transferWindowMinutes: number
): BuildTripWindowsResult {
  if (validations.length === 0) {
    return { windows: [], warnings: [] }
  }

  const warnings: CalculationWarning[] = []
  const windows: ValidationEvent[][] = []

  let currentWindow: ValidationEvent[] = [validations[0]]

  for (let i = 1; i < validations.length; i += 1) {
    const current = validations[i]
    const prev = currentWindow[currentWindow.length - 1]
    const windowStart = currentWindow[0]

    let startNewWindow = false

    if (isTransportDayBoundary(prev, current)) {
      warnings.push({
        code: WarningCode.TRANSPORT_DAY_BOUNDARY_SPLIT,
        message: 'Transfer window was split because a new transport day started.',
        validationId: current.validationId
      })
      startNewWindow = true
    }

    if (!startNewWindow && !isInsideTransferWindow(windowStart.eventTime, current.eventTime, transferWindowMinutes)) {
      startNewWindow = true
    }

    if (
      !startNewWindow &&
      !canMergeConsecutiveEvents(prev, current, {
        currentWindowEvents: currentWindow
      })
    ) {
      if (
        isDuplicatedLinkBreak(prev, current, {
          currentWindowEvents: currentWindow
        })
      ) {
        warnings.push({
          code: WarningCode.DUPLICATED_LINK_STARTED_NEW_WINDOW,
          message: 'Duplicated transport link started a new transfer window.',
          validationId: current.validationId
        })
      }
      startNewWindow = true
    }

    if (startNewWindow) {
      windows.push(currentWindow)
      currentWindow = [current]
      continue
    }

    currentWindow.push(current)
  }

  windows.push(currentWindow)

  return {
    windows,
    warnings
  }
}
