import { localDateStr } from './date'

// Parametros baseados na literatura:
// - Janela fertil = 6 dias, os 5 anteriores a ovulacao + o dia da ovulacao
//   (Wilcox et al., NEJM 1995; BMJ 2000). Depois da ovulacao a chance e ~0.
// - Pico de fertilidade = os 2 dias antes da ovulacao + o dia dela.
// - Fase lutea: media real ~12,4 dias (Bull et al., npj Digit Med 2019, 612 mil
//   ciclos), nao os 14 da regra classica. Usamos 13 (entre 12,4 e a media
//   classica ~13-14 de estudos com marcadores hormonais).
// - A ovulacao varia muito entre ciclos; so ~10% dos ciclos de 28 dias ovulam
//   exatamente 14 dias antes da menstruacao (Wilcox, BMJ 2000). Por isso a
//   estimativa carrega uma margem de incerteza calculada dos proprios ciclos.
const LUTEAL_DAYS = 13
const LUTEAL_SD = 2
const DEFAULT_CYCLE_SD = 4
const MAX_RECENT_CYCLES = 6

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
  const allDiffs = []
  for (let i = 1; i < sorted.length; i++) {
    allDiffs.push(daysBetween(sorted[i - 1].cycle_start, sorted[i].cycle_start))
  }
  // Usa so os ciclos mais recentes e ignora intervalos implausiveis (esquecimento
  // de registro, gravidez, etc.), a menos que nao sobre nenhum.
  const plausible = allDiffs.filter((d) => d >= 18 && d <= 60)
  const diffs = (plausible.length > 0 ? plausible : allDiffs).slice(-MAX_RECENT_CYCLES)
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const avgCycleLength = Math.round(mean)
  const cycleSd =
    diffs.length >= 3
      ? Math.sqrt(diffs.reduce((acc, d) => acc + (d - mean) ** 2, 0) / (diffs.length - 1))
      : DEFAULT_CYCLE_SD
  // Incerteza total (dias) = variacao do tamanho do ciclo + variacao da fase lutea
  const margin = Math.min(7, Math.max(2, Math.round(Math.sqrt(cycleSd ** 2 + LUTEAL_SD ** 2))))

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

  const ovulation = addDays(predictedStart, -LUTEAL_DAYS)
  const fertileStart = addDays(ovulation, -5)

  return {
    avgCycleLength,
    cycleSd: Math.round(cycleSd * 10) / 10,
    sampleSize: diffs.length,
    margin,
    ovulation,
    predictedNext: { start: predictedStart, end: predictedEnd },
    fertileWindow: { start: fertileStart, end: ovulation },
    peakWindow: { start: addDays(ovulation, -2), end: ovulation },
    fertileWindowWide: { start: addDays(fertileStart, -margin), end: addDays(ovulation, margin) },
  }
}
