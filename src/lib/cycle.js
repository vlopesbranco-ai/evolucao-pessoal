import { localDateStr } from './date'

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

// Faixa de dias do período: usa fim real (cycle_end) quando já registrado,
// senão cai para a estimativa baseada em period_length.
export function periodRange(cycleLog) {
  if (cycleLog.cycle_end) {
    return { start: cycleLog.cycle_start, end: cycleLog.cycle_end }
  }
  const length = cycleLog.period_length ?? 5
  return { start: cycleLog.cycle_start, end: addDays(cycleLog.cycle_start, length - 1) }
}

export function periodRanges(cycleLogs) {
  return (cycleLogs ?? []).map(periodRange)
}

// Estimativas: duração média do ciclo, próximo período previsto e janela fértil
export function computeCycleInsights(cycleLogs) {
  if (!cycleLogs || cycleLogs.length < 2) return null

  const sorted = [...cycleLogs].sort((a, b) => new Date(a.cycle_start) - new Date(b.cycle_start))
  const diffs = []
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(daysBetween(sorted[i - 1].cycle_start, sorted[i].cycle_start))
  }
  const avgCycleLength = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)

  const last = sorted[sorted.length - 1]

  // Duração do próximo período: preferir a média das durações REAIS já
  // registradas (cycle_end - cycle_start + 1). Se nenhum registro tem
  // cycle_end ainda, cai para period_length do último registro (ou 5).
  const realLengths = sorted
    .filter((log) => log.cycle_end)
    .map((log) => daysBetween(log.cycle_start, log.cycle_end) + 1)
  const periodLength =
    realLengths.length > 0
      ? Math.round(realLengths.reduce((a, b) => a + b, 0) / realLengths.length)
      : last.period_length ?? 5

  const predictedStart = addDays(last.cycle_start, avgCycleLength)
  const predictedEnd = addDays(predictedStart, periodLength - 1)

  const ovulation = addDays(predictedStart, -14)
  const fertileStart = addDays(ovulation, -5)
  const fertileEnd = addDays(ovulation, 1)

  return {
    avgCycleLength,
    predictedNext: { start: predictedStart, end: predictedEnd },
    fertileWindow: { start: fertileStart, end: fertileEnd },
  }
}
