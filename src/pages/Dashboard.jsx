import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import Heatmap from '../components/Heatmap'
import { XP_PER_CHECKIN, levelForXp } from '../lib/gamification'
import { todayStr, localDateStr, effectiveDueDate, daysLate } from '../lib/date'
import { categoryInfo } from '../lib/eventCategories'

function isScheduledToday(habit) {
  return isScheduledOnWeekday(habit, new Date().getDay())
}

function isScheduledOnWeekday(habit, weekday) {
  if (habit.times_per_week) return true
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(weekday)
}

// Sequência atual de dias seguidos cumprindo o hábito (só faz sentido pra
// hábitos com dia fixo — os flexíveis (Nx/semana) não entram nessa conta).
function computeStreak(habit, doneDates) {
  if (habit.times_per_week) return 0
  let streak = 0
  const cursor = new Date()
  if (!doneDates.has(todayStr()) && isScheduledToday(habit)) cursor.setDate(cursor.getDate() - 1)
  for (let i = 0; i < 112; i++) {
    const weekday = cursor.getDay()
    if (isScheduledOnWeekday(habit, weekday)) {
      const dateStr = localDateStr(cursor)
      if (doneDates.has(dateStr)) streak++
      else break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// % de cumprimento do hábito nos últimos 30 dias (considerando só os dias em
// que ele estava programado).
function habitConsistency30d(habit, doneDates) {
  let total = 0
  let done = 0
  const cursor = new Date()
  for (let i = 0; i < 30; i++) {
    if (isScheduledOnWeekday(habit, cursor.getDay())) {
      total++
      if (doneDates.has(localDateStr(cursor))) done++
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : null }
}

function startOfWeek(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function fmtShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Marcador de conclusão dos hábitos do dia: começa vermelho (poucos feitos) e
// vai passando por amarelo até chegar em verde conforme os check-ins avançam.
function pctBucket(done, total) {
  if (!total) return null
  const pct = (done / total) * 100
  if (pct < 50) return { dot: 'bg-red-500', ring: 'ring-red-100', badge: 'bg-red-50 text-red-600' }
  if (pct < 80) return { dot: 'bg-amber-500', ring: 'ring-amber-100', badge: 'bg-amber-50 text-amber-600' }
  return { dot: 'bg-emerald-500', ring: 'ring-emerald-100', badge: 'bg-emerald-50 text-emerald-600' }
}

export default function Dashboard() {
  const [build, setBuild] = useState({ done: 0, total: 0 })
  const [avoid, setAvoid] = useState({ done: 0, total: 0 })
  const [heatmapData, setHeatmapData] = useState({})
  const [weeklyData, setWeeklyData] = useState([])
  const [xp, setXp] = useState(0)
  const [weekTasks, setWeekTasks] = useState([])
  const [weekEvents, setWeekEvents] = useState([])
  const [habitConsistency, setHabitConsistency] = useState([])
  const [longestStreak, setLongestStreak] = useState(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - 16 * 7)

      const weekStartDate = startOfWeek(new Date())
      const weekEndDate = new Date(weekStartDate)
      weekEndDate.setDate(weekEndDate.getDate() + 6)
      const weekStartStr = localDateStr(weekStartDate)
      const weekEndStr = localDateStr(weekEndDate)

      const [{ data: habits }, { data: logs }, { data: taskData }, { data: eventData }, { data: overdueData }] =
        await Promise.all([
          supabase.from('habits').select('*').eq('archived', false),
          supabase
            .from('habit_logs')
            .select('habit_id, log_date')
            .gte('log_date', localDateStr(since)),
          // Pega tudo até o fim da semana; tarefas atrasadas (due_date antigo, não
          // concluídas) são filtradas abaixo e reaparecem como se fossem de hoje.
          supabase
            .from('tasks')
            .select('*')
            .lte('due_date', weekEndStr)
            .order('due_date', { ascending: true }),
          supabase.from('calendar_events').select('*'),
          // Todas as tarefas atrasadas (não só as desta semana) pro KPI de Relatórios.
          supabase.from('tasks').select('id, due_date').eq('done', false).lt('due_date', todayStr()),
        ])

      const todayLogs = (logs ?? []).filter((l) => l.log_date === todayStr())
      const doneIds = new Set(todayLogs.map((l) => l.habit_id))
      const todayHabits = (habits ?? []).filter(isScheduledToday)
      const buildHabits = todayHabits.filter((h) => h.habit_type !== 'avoid')
      const avoidHabits = todayHabits.filter((h) => h.habit_type === 'avoid')

      setBuild({ done: buildHabits.filter((h) => doneIds.has(h.id)).length, total: buildHabits.length })
      setAvoid({ done: avoidHabits.filter((h) => doneIds.has(h.id)).length, total: avoidHabits.length })

      // Consistência por dia: % de hábitos cumpridos em relação aos que
      // estavam programados naquele dia (não uma contagem bruta).
      const habitIds = new Set((habits ?? []).map((h) => h.id))
      const doneByDate = {}
      const doneDatesByHabit = {}
      for (const log of logs ?? []) {
        if (!habitIds.has(log.habit_id)) continue
        doneByDate[log.log_date] = (doneByDate[log.log_date] ?? 0) + 1
        if (!doneDatesByHabit[log.habit_id]) doneDatesByHabit[log.habit_id] = new Set()
        doneDatesByHabit[log.habit_id].add(log.log_date)
      }

      // Relatórios: consistência de cada hábito nos últimos 30 dias + maior
      // sequência ativa entre os hábitos de dia fixo.
      const consistency = (habits ?? [])
        .map((h) => ({ id: h.id, name: h.name, type: h.habit_type, ...habitConsistency30d(h, doneDatesByHabit[h.id] ?? new Set()) }))
        .filter((c) => c.total > 0)
        .sort((a, b) => b.pct - a.pct)
      setHabitConsistency(consistency)

      let bestStreak = null
      for (const h of habits ?? []) {
        const streak = computeStreak(h, doneDatesByHabit[h.id] ?? new Set())
        if (streak > 0 && (!bestStreak || streak > bestStreak.days)) {
          bestStreak = { name: h.name, days: streak }
        }
      }
      setLongestStreak(bestStreak)
      setOverdueCount((overdueData ?? []).length)
      const heatmap = {}
      const dayCursor = new Date(since)
      const todayForHeatmap = new Date()
      todayForHeatmap.setHours(0, 0, 0, 0)
      while (dayCursor <= todayForHeatmap) {
        const dateStr = localDateStr(dayCursor)
        const weekday = dayCursor.getDay()
        const total = (habits ?? []).filter((h) => isScheduledOnWeekday(h, weekday)).length
        heatmap[dateStr] = { completed: doneByDate[dateStr] ?? 0, total }
        dayCursor.setDate(dayCursor.getDate() + 1)
      }
      setHeatmapData(heatmap)

      const weekBuckets = {}
      for (const log of logs ?? []) {
        const ws = localDateStr(startOfWeek(new Date(log.log_date + 'T00:00:00')))
        weekBuckets[ws] = (weekBuckets[ws] ?? 0) + 1
      }
      const weeks = []
      const cursor = startOfWeek(new Date())
      for (let i = 7; i >= 0; i--) {
        const d = new Date(cursor)
        d.setDate(d.getDate() - i * 7)
        const key = localDateStr(d)
        weeks.push({
          label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          count: weekBuckets[key] ?? 0,
        })
      }
      setWeeklyData(weeks)
      setXp((logs ?? []).length * XP_PER_CHECKIN)

      const relevantTasks = (taskData ?? []).filter((t) => t.due_date >= weekStartStr || !t.done)
      setWeekTasks(relevantTasks)
      const eventsThisWeek = (eventData ?? []).filter((ev) => {
        const end = ev.end_date || ev.start_date
        return end >= weekStartStr && ev.start_date <= weekEndStr
      })
      setWeekEvents(eventsThisWeek)

      setLoading(false)
    }
    load()
  }, [])

  const levelInfo = useMemo(() => levelForXp(xp), [xp])

  const weekItems = useMemo(() => {
    const items = [
      ...weekTasks.map((t) => ({
        type: 'task',
        date: effectiveDueDate(t),
        title: t.title,
        done: t.done,
        late: daysLate(t),
      })),
      ...weekEvents.map((ev) => ({ type: 'event', date: ev.start_date, title: ev.title, category: ev.category })),
    ]
    return items.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  }, [weekTasks, weekEvents])

  const monthStats = useMemo(() => {
    const prefix = todayStr().slice(0, 7)
    let completed = 0
    let total = 0
    for (const [date, v] of Object.entries(heatmapData)) {
      if (!date.startsWith(prefix)) continue
      completed += v.completed
      total += v.total
    }
    return { completed, total, pct: total ? Math.round((completed / total) * 100) : null }
  }, [heatmapData])

  const monthLabel = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { month: 'long' }),
    []
  )

  const insights = useMemo(() => {
    const lines = []
    if (monthStats.total > 0) {
      lines.push(
        `Você cumpriu ${monthStats.pct}% dos hábitos programados em ${monthLabel}, num total de ${monthStats.completed} check-ins.`
      )
    }
    if (habitConsistency.length >= 2) {
      const best = habitConsistency[0]
      const worst = habitConsistency[habitConsistency.length - 1]
      if (best.id !== worst.id) {
        lines.push(`Nos últimos 30 dias, "${best.name}" foi o mais consistente (${best.pct}%) e "${worst.name}" o que mais ficou pra trás (${worst.pct}%).`)
      }
    } else if (habitConsistency.length === 1) {
      lines.push(`Nos últimos 30 dias, "${habitConsistency[0].name}" teve ${habitConsistency[0].pct}% de consistência.`)
    }
    if (longestStreak) {
      lines.push(`Sua maior sequência ativa é "${longestStreak.name}", há ${longestStreak.days} dia${longestStreak.days === 1 ? '' : 's'} seguidos.`)
    } else if (overdueCount > 0) {
      lines.push(`Você tem ${overdueCount} tarefa${overdueCount === 1 ? '' : 's'} atrasada${overdueCount === 1 ? '' : 's'} — nenhuma sequência de hábito ativa no momento.`)
    } else {
      lines.push('Nenhuma sequência de hábito ativa no momento — hoje é um bom dia pra começar uma.')
    }
    return lines.slice(0, 3)
  }, [monthStats, monthLabel, habitConsistency, longestStreak, overdueCount])

  const buildBucket = pctBucket(build.done, build.total)
  const avoidBucket = pctBucket(avoid.done, avoid.total)

  return (
    <div className="h-full overflow-y-auto safe-scroll py-5 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Painel de hoje</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="bg-white border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-800">
            Nível {levelInfo.level} · {levelInfo.title}
          </p>
          <p className="text-xs text-slate-400">
            {levelInfo.xpIntoLevel}/{levelInfo.xpForNext} XP
          </p>
        </div>
        <div className="w-full h-2 bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, levelInfo.progress * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/habitos"
          className={`block bg-white border border-slate-200 p-5 hover:border-slate-300 ${
            buildBucket ? `ring-2 ${buildBucket.ring}` : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-400">Hábitos a fazer</p>
            {buildBucket && <span className={`w-2.5 h-2.5 ${buildBucket.dot}`} />}
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {build.done}/{build.total}
          </p>
          <p className="text-xs text-slate-500 mt-1">cumpridos hoje</p>
        </Link>

        <Link
          to="/habitos"
          className={`block bg-white border border-slate-200 p-5 hover:border-slate-300 ${
            avoidBucket ? `ring-2 ${avoidBucket.ring}` : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-400">Hábitos a evitar</p>
            {avoidBucket && <span className={`w-2.5 h-2.5 ${avoidBucket.dot}`} />}
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {avoid.done}/{avoid.total}
          </p>
          <p className="text-xs text-slate-500 mt-1">resistidos hoje</p>
        </Link>
      </div>

      <div className="bg-white border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Essa semana</p>
          <Link to="/calendario" className="text-xs text-slate-400 hover:text-slate-700">
            ver calendário
          </Link>
        </div>
        {loading ? (
          <p className="text-xs text-slate-400">Carregando...</p>
        ) : weekItems.length === 0 ? (
          <p className="text-xs text-slate-400">Nada marcado pra essa semana.</p>
        ) : (
          <ul className="space-y-1">
            {weekItems.map((item, i) => {
              const isLate = item.type === 'task' && item.late > 0
              return (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 ${
                        item.type === 'task' ? (isLate ? 'bg-red-500' : 'bg-sky-500') : categoryInfo(item.category).dot
                      }`}
                    />
                    <span className={item.done ? 'line-through text-slate-400' : isLate ? 'text-red-700' : 'text-slate-700'}>
                      {item.title}
                      {isLate && (
                        <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium align-middle">
                          atrasada {item.late}d
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-slate-400">{item.date ? fmtShort(item.date) : ''}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!loading && (
        <>
          <div className="bg-white border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-3">Consistência (últimas 16 semanas)</p>
            <Heatmap data={heatmapData} weeks={16} mode="percentage" />
            <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-red-400 inline-block"/> {'<'}50%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-amber-400 inline-block"/> 50–80%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-emerald-500 inline-block"/> {'>'}80%
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-3">Check-ins por semana</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                <Tooltip />
                <Bar dataKey="count" fill="#c22e17" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t-2 border-slate-900 pt-5 space-y-4">
            <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Relatórios</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 p-3">
                <p className="text-xs text-slate-400">Consistência do mês</p>
                <p className="text-xl font-semibold text-slate-900">
                  {monthStats.pct === null ? '—' : `${monthStats.pct}%`}
                </p>
              </div>
              <div className="bg-white border border-slate-200 p-3">
                <p className="text-xs text-slate-400">Check-ins no mês</p>
                <p className="text-xl font-semibold text-slate-900">{monthStats.completed}</p>
              </div>
              <div className="bg-white border border-slate-200 p-3">
                <p className="text-xs text-slate-400">Maior sequência ativa</p>
                <p className="text-xl font-semibold text-slate-900">{longestStreak ? `${longestStreak.days}d` : '—'}</p>
                {longestStreak && <p className="text-xs text-slate-400 truncate">{longestStreak.name}</p>}
              </div>
              <div className="bg-white border border-slate-200 p-3">
                <p className="text-xs text-slate-400">Tarefas atrasadas</p>
                <p className={`text-xl font-semibold ${overdueCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overdueCount}</p>
              </div>
            </div>

            {habitConsistency.length > 0 && (
              <div className="bg-white border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-3">Consistência por hábito (últimos 30 dias)</p>
                <ul className="space-y-2">
                  {habitConsistency.map((h) => (
                    <li key={h.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 truncate">{h.name}</span>
                        <span className="text-slate-400 shrink-0 ml-2">
                          {h.done}/{h.total} · {h.pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full ${h.pct < 50 ? 'bg-red-500' : h.pct < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${h.pct}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.length > 0 && (
              <div className="bg-white border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-3">Três leituras</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  {insights.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-brand-600 font-semibold">{i + 1}.</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
