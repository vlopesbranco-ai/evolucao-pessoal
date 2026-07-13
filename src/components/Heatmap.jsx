import { localDateStr } from '../lib/date'

// Calendário estilo "contribuições" (GitHub). data: { 'YYYY-MM-DD': count }
const DEFAULT_COLORS = ['bg-slate-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600', 'bg-emerald-800']

export default function Heatmap({ data, weeks = 16, colors = DEFAULT_COLORS, maxValue }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  // alinha ao sábado da semana atual (fim de semana)
  end.setDate(end.getDate() + (6 - end.getDay()))
  const start = new Date(end)
  start.setDate(start.getDate() - (weeks * 7 - 1))

  const max = maxValue ?? Math.max(1, ...Object.values(data))

  const cols = []
  let cursor = new Date(start)
  for (let w = 0; w < weeks; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const dateStr = localDateStr(cursor)
      const count = data[dateStr] ?? 0
      const isFuture = cursor > today
      const bucket = count === 0 ? 0 : Math.min(colors.length - 1, Math.ceil((count / max) * (colors.length - 1)))
      days.push({ dateStr, count, isFuture, colorClass: colors[bucket] })
      cursor.setDate(cursor.getDate() + 1)
    }
    cols.push(days)
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {cols.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day) => (
            <div
              key={day.dateStr}
              title={`${day.dateStr}: ${day.count}`}
              className={`w-3 h-3 rounded-sm ${day.isFuture ? 'bg-transparent' : day.colorClass}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
