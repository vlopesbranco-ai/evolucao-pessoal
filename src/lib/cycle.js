import { localDateStr } from './date'

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

// Faixa de dias do período registrado (início até início + duração - 1)
export function periodRange(cycleLog) {
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
  const periodLength = last.period_length ?? 5
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
