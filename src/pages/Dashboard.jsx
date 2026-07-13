import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import Heatmap from '../components/Heatmap'
import { XP_PER_CHECKIN, levelForXp } from '../lib/gamification'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function isScheduledToday(habit) {
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(new Date().getDay())
}

function startOfWeek(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

export default function Dashboard() {
  const [build, setBuild] = useState({ done: 0, total: 0 })
  const [avoid, setAvoid] = useState({ done: 0, total: 0 })
  const [heatmapData, setHeatmapData] = useState({})
  const [weeklyData, setWeeklyData] = useState([])
  const [xp, setXp] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - 16 * 7)

      const [{ data: habits }, { data: logs }] = await Promise.all([
        supabase.from('habits').select('*').eq('archived', false),
        supabase
          .from('habit_logs')
          .select('habit_id, log_date')
          .gte('log_date', since.toISOString().slice(0, 10)),
      ])

      const todayLogs = (logs ?? []).filter((l) => l.log_date === todayStr())
      const doneIds = new Set(todayLogs.map((l) => l.habit_id))
      const todayHabits = (habits ?? []).filter(isScheduledToday)
      const buildHabits = todayHabits.filter((h) => h.habit_type !== 'avoid')
      const avoidHabits = todayHabits.filter((h) => h.habit_type === 'avoid')

      setBuild({ done: buildHabits.filter((h) => doneIds.has(h.id)).length, total: buildHabits.length })
      setAvoid({ done: avoidHabits.filter((h) => doneIds.has(h.id)).length, total: avoidHabits.length })

      const heatmap = {}
      for (const log of logs ?? []) {
        heatmap[log.log_date] = (heatmap[log.log_date] ?? 0) + 1
      }
      setHeatmapData(heatmap)

      // agrupa por semana (últimas 8)
      const weekBuckets = {}
      for (const log of logs ?? []) {
        const weekStart = startOfWeek(new Date(log.log_date + 'T00:00:00')).toISOString().slice(0, 10)
        weekBuckets[weekStart] = (weekBuckets[weekStart] ?? 0) + 1
      }
      const weeks = []
      const cursor = startOfWeek(new Date())
      for (let i = 7; i >= 0; i--) {
        const d = new Date(cursor)
        d.setDate(d.getDate() - i * 7)
        const key = d.toISOString().slice(0, 10)
        weeks.push({
          label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          count: weekBuckets[key] ?? 0,
        })
      }
      setWeeklyData(weeks)

      setXp((logs ?? []).length * XP_PER_CHECKIN)
      setLoading(false)
    }
    load()
  }, [])

  const levelInfo = useMemo(() => levelForXp(xp), [xp])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Painel de hoje</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-800">
            Nível {levelInfo.level} · {levelInfo.title}
          </p>
          <p className="text-xs text-slate-400">
            {levelInfo.xpIntoLevel}/{levelInfo.xpForNext} XP
          </p>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, levelInfo.progress * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/habitos" className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300">
          <p className="text-xs text-slate-400 mb-1">Hábitos a fazer</p>
          <p className="text-2xl font-semibold text-slate-900">
            {build.done}/{build.total}
          </p>
          <p className="text-xs text-slate-500 mt-1">cumpridos hoje</p>
        </Link>

        <Link to="/habitos" className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300">
          <p className="text-xs text-slate-400 mb-1">Hábitos a evitar</p>
          <p className="text-2xl font-semibold text-slate-900">
            {avoid.done}/{avoid.total}
          </p>
          <p className="text-xs text-slate-500 mt-1">resistidos hoje</p>
        </Link>
      </div>

      {!loading && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Consistência (últimas 16 semanas)</p>
            <Heatmap data={heatmapData} weeks={16} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Check-ins por semana</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
