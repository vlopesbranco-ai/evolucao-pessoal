import { localDateStr } from '../lib/date'

// Calendário estilo "contribuições" (GitHub).
// mode="count": data = { 'YYYY-MM-DD': number } — intensidade em tons de verde.
// mode="percentage": data = { 'YYYY-MM-DD': { completed, total } } — verde/amarelo/vermelho
//   conforme % de hábitos cumpridos no dia (<50% vermelho, 50–80% amarelo, >80% verde).
const DEFAULT_COLORS = ['bg-slate-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600', 'bg-emerald-800']

function percentageColorClass(pct) {
  if (pct < 50) return 'bg-red-400'
  if (pct < 80) return 'bg-amber-400'
  return 'bg-emerald-500'
}

export default function Heatmap({ data, weeks = 16, colors = DEFAULT_COLORS, maxValue, mode = 'count' }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  // alinha ao sábado da semana atual (fim de semana)
  end.setDate(end.getDate() + (6 - end.getDay()))
  const start = new Date(end)
  start.setDate(start.getDate() - (weeks * 7 - 1))

  const max = mode === 'percentage' ? null : maxValue ?? Math.max(1, ...Object.values(data))

  const cols = []
  let cursor = new Date(start)
  for (let w = 0; w < weeks; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const dateStr = localDateStr(cursor)
      const isFuture = cursor > today
      let colorClass
      let title

      if (mode === 'percentage') {
        const entry = data[dateStr]
        const total = entry?.total ?? 0
        const completed = entry?.completed ?? 0
        const hasData = total > 0
        const pct = hasData ? (completed / total) * 100 : null
        colorClass = hasData ? percentageColorClass(pct) : 'bg-slate-100'
        title = hasData ? `${dateStr}: ${completed}/${total} (${Math.round(pct)}%)` : `${dateStr}: sem hábitos programados`
      } else {
        const count = data[dateStr] ?? 0
        const bucket = count === 0 ? 0 : Math.min(colors.length - 1, Math.ceil((count / max) * (colors.length - 1)))
        colorClass = colors[bucket]
        title = `${dateStr}: ${count}`
      }

      days.push({ dateStr, isFuture, colorClass, title })
      cursor.setDate(cursor.getDate() + 1)
    }
    cols.push(days)
  }

  return (
    <div className="flex gap-1 safe-scroll-x pb-1">
      {cols.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day) => (
            <div
              key={day.dateStr}
              title={day.title}
              className={`w-3 h-3 rounded-sm ${day.isFuture ? 'bg-transparent' : day.colorClass}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
