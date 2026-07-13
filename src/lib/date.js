// Sempre usar data LOCAL (não UTC) — toISOString() usa UTC e causa bugs de
// virada de dia perto da meia-noite em fusos negativos (ex: Brasil).
export function localDateStr(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayStr() {
  return localDateStr(new Date())
}
