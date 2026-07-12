import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Habits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logsToday, setLogsToday] = useState(new Set())
  const [streaks, setStreaks] = useState({})
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: habitsData } = await supabase
      .from('habits')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: true })

    const { data: logsData } = await supabase
      .from('habit_logs')
      .select('habit_id, log_date')
      .order('log_date', { ascending: false })

    setHabits(habitsData ?? [])

    const todaySet = new Set(
      (logsData ?? []).filter((l) => l.log_date === todayStr()).map((l) => l.habit_id)
    )
    setLogsToday(todaySet)

    // streak simples: dias consecutivos até hoje/ontem
    const byHabit = {}
    for (const log of logsData ?? []) {
      if (!byHabit[log.habit_id]) byHabit[log.habit_id] = new Set()
      byHabit[log.habit_id].add(log.log_date)
    }
    const streakMap = {}
    for (const habit of habitsData ?? []) {
      const dates = byHabit[habit.id] ?? new Set()
      let streak = 0
      let cursor = new Date()
      // se não fez check-in hoje ainda, começa a contar de ontem
      if (!dates.has(todayStr())) cursor.setDate(cursor.getDate() - 1)
      while (dates.has(cursor.toISOString().slice(0, 10))) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      }
      streakMap[habit.id] = streak
    }
    setStreaks(streakMap)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addHabit(e) {
    e.preventDefault()
    if (!newName.trim()) return
    await supabase.from('habits').insert({
      user_id: user.id,
      name: newName.trim(),
      category: newCategory.trim() || null,
    })
    setNewName('')
    setNewCategory('')
    load()
  }

  async function toggleToday(habit) {
    const done = logsToday.has(habit.id)
    if (done) {
      await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('log_date', todayStr())
    } else {
      await supabase.from('habit_logs').insert({
        habit_id: habit.id,
        user_id: user.id,
        log_date: todayStr(),
      })
    }
    load()
  }

  async function archive(habit) {
    await supabase.from('habits').update({ archived: true }).eq('id', habit.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Hábitos</h1>
        <p className="text-sm text-slate-500">Marque o que você cumpriu hoje.</p>
      </div>

      <form onSubmit={addHabit} className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Novo hábito (ex: Meditar 10min)"
          className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Categoria (opcional)"
          className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">
          Adicionar
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : habits.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum hábito ainda. Adicione o primeiro acima.</p>
      ) : (
        <ul className="space-y-2">
          {habits.map((habit) => {
            const done = logsToday.has(habit.id)
            return (
              <li
                key={habit.id}
                className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleToday(habit)}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                      done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 text-transparent hover:border-slate-400'
                    }`}
                  >
                    ✓
                  </button>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{habit.name}</p>
                    {habit.category && <p className="text-xs text-slate-400">{habit.category}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">🔥 {streaks[habit.id] ?? 0}d</span>
                  <button
                    onClick={() => archive(habit)}
                    className="text-xs text-slate-300 hover:text-red-500"
                  >
                    arquivar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
