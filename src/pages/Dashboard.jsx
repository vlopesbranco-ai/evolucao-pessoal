import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function isScheduledToday(habit) {
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(new Date().getDay())
}

export default function Dashboard() {
  const [build, setBuild] = useState({ done: 0, total: 0 })
  const [avoid, setAvoid] = useState({ done: 0, total: 0 })

  useEffect(() => {
    async function load() {
      const { data: habits } = await supabase.from('habits').select('*').eq('archived', false)
      const { data: logs } = await supabase.from('habit_logs').select('habit_id').eq('log_date', todayStr())
      const doneIds = new Set((logs ?? []).map((l) => l.habit_id))

      const todayHabits = (habits ?? []).filter(isScheduledToday)
      const buildHabits = todayHabits.filter((h) => h.habit_type !== 'avoid')
      const avoidHabits = todayHabits.filter((h) => h.habit_type === 'avoid')

      setBuild({ done: buildHabits.filter((h) => doneIds.has(h.id)).length, total: buildHabits.length })
      setAvoid({ done: avoidHabits.filter((h) => doneIds.has(h.id)).length, total: avoidHabits.length })
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Painel de hoje</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
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
    </div>
  )
}
