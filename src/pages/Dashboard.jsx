import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Dashboard() {
  const [habitsTotal, setHabitsTotal] = useState(0)
  const [habitsDone, setHabitsDone] = useState(0)
  const [urgesToday, setUrgesToday] = useState({ resisted: 0, total: 0 })

  useEffect(() => {
    async function load() {
      const { data: habits } = await supabase.from('habits').select('id').eq('archived', false)
      const { data: logs } = await supabase.from('habit_logs').select('habit_id').eq('log_date', todayStr())
      const { data: urges } = await supabase
        .from('urge_logs')
        .select('resisted')
        .gte('occurred_at', `${todayStr()}T00:00:00`)

      setHabitsTotal(habits?.length ?? 0)
      setHabitsDone(logs?.length ?? 0)
      setUrgesToday({
        resisted: (urges ?? []).filter((u) => u.resisted).length,
        total: urges?.length ?? 0,
      })
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
          <p className="text-xs text-slate-400 mb-1">Hábitos</p>
          <p className="text-2xl font-semibold text-slate-900">
            {habitsDone}/{habitsTotal}
          </p>
          <p className="text-xs text-slate-500 mt-1">cumpridos hoje</p>
        </Link>

        <Link to="/dopamina" className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300">
          <p className="text-xs text-slate-400 mb-1">Dopamina fácil</p>
          <p className="text-2xl font-semibold text-slate-900">
            {urgesToday.resisted}/{urgesToday.total}
          </p>
          <p className="text-xs text-slate-500 mt-1">impulsos resistidos hoje</p>
        </Link>
      </div>
    </div>
  )
}
