export const XP_PER_CHECKIN = 10

const LEVEL_TITLES = [
  'Iniciante',
  'Em movimento',
  'Consistente',
  'Disciplinado',
  'Exemplar',
  'Imparável',
  'Mestre dos hábitos',
]

export function levelForXp(xp) {
  let level = 1
  let xpForNext = 100
  let remaining = xp
  while (remaining >= xpForNext) {
    remaining -= xpForNext
    level++
    xpForNext = Math.round(100 * Math.pow(level, 1.15))
  }
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
  return { level, title, xpIntoLevel: remaining, xpForNext, progress: remaining / xpForNext }
}
