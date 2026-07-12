import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const WEEKDAYS = [
  { value: 0, label: 'D' },
  { value: 1, label: 'S' },
  { value: 2, label: 'T' },
  { value: 3, label: 'Q' },
  { value: 4, label: 'Q' },
  { value: 5, label: 'S' },
  { value: 6, label: 'S' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function isScheduledToday(habit) {
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(new Date().getDay())
}

function isScheduledOn(habit, date) {
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(date.getDay())
}

function emptyForm() {
  return { name: '', category: '', habit_type: 'build', days_of_week: [] }
}

export default function Habits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logsToday, setLogsToday] = useState(new Set())
  const [streaks, setStreaks] = useState({})
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm())
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
      if (!dates.has(todayStr()) && isScheduledToday(habit)) cursor.setDate(cursor.getDate() - 1)
      // limite de segurança: no máximo 400 dias pra trás
      for (let i = 0; i < 400; i++) {
        const dateStr = cursor.toISOString().slice(0, 10)
        if (isScheduledOn(habit, cursor)) {
          if (dates.has(dateStr)) {
            streak++
          } else {
            break
          }
        }
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

  function toggleDay(days, value) {
    return days.includes(value) ? days.filter((d) => d !== value) : [...days, value].sort()
  }

  async function addHabit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    await supabase.from('habits').insert({
      user_id: user.id,
      name: form.name.trim(),
      category: form.category.trim() || null,
      habit_type: form.habit_type,
      days_of_week: form.days_of_week.length ? form.days_of_week : null,
    })
    setForm(emptyForm())
    load()
  }

  function startEdit(habit) {
    setEditingId(habit.id)
    setEditForm({
      name: habit.name,
      category: habit.category ?? '',
      habit_type: habit.habit_type ?? 'build',
      days_of_week: habit.days_of_week ?? [],
    })
  }

  async function saveEdit(habitId) {
    if (!editForm.name.trim()) return
    await supabase
      .from('habits')
      .update({
        name: editForm.name.trim(),
        category: editForm.category.trim() || null,
        habit_type: editForm.habit_type,
        days_of_week: editForm.days_of_week.length ? editForm.days_of_week : null,
      })
      .eq('id', habitId)
    setEditingId(null)
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

  function DaysPicker({ value, onChange }) {
    return (
      <div className="flex gap-1">
        {WEEKDAYS.map((d) => (
          <button
            type="button"
            key={d.value}
            onClick={() => onChange(toggleDay(value, d.value))}
            className={`w-7 h-7 rounded-full text-xs border ${
              value.includes(d.value)
                ? 'bg-slate-900 text-white border-slate-900'
                : 'border-slate-300 text-slate-500 hover:border-slate-400'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
    )
  }

  function daysLabel(habit) {
    if (!habit.days_of_week || habit.days_of_week.length === 0) return 'todo dia'
    return habit.days_of_week.map((d) => WEEKDAYS[d].label).join(' ')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Hábitos</h1>
        <p className="text-sm text-slate-500">Hábitos pra construir e hábitos pra evitar, no mesmo lugar.</p>
      </div>

      <form onSubmit={addHabit} className="space-y-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome (ex: Meditar 10min, Não abrir Instagram antes das 10h)"
            className="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Categoria (opcional)"
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setForm({ ...form, habit_type: 'build' })}
              className={`px-3 py-1.5 rounded-full border ${
                form.habit_type === 'build'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'border-slate-300 text-slate-500'
              }`}
            >
              Fazer
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, habit_type: 'avoid' })}
              className={`px-3 py-1.5 rounded-full border ${
                form.habit_type === 'avoid'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-slate-300 text-slate-500'
              }`}
            >
              Evitar
            </button>
          </div>
          <DaysPicker value={form.days_of_week} onChange={(v) => setForm({ ...form, days_of_week: v })} />
          <button className="ml-auto rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">
            Adicionar
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : habits.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum hábito ainda. Adicione o primeiro acima.</p>
      ) : (
        <ul className="space-y-2">
          {habits.map((habit) => {
            const done = logsToday.has(habit.id)
            const scheduledToday = isScheduledToday(habit)
            const isEditing = editingId === habit.id

            if (isEditing) {
              return (
                <li key={habit.id} className="bg-white border border-slate-300 rounded-xl p-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      placeholder="Categoria"
                      className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, habit_type: 'build' })}
                        className={`px-3 py-1.5 rounded-full border ${
                          editForm.habit_type === 'build'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'border-slate-300 text-slate-500'
                        }`}
                      >
                        Fazer
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, habit_type: 'avoid' })}
                        className={`px-3 py-1.5 rounded-full border ${
                          editForm.habit_type === 'avoid'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'border-slate-300 text-slate-500'
                        }`}
                      >
                        Evitar
                      </button>
                    </div>
                    <DaysPicker
                      value={editForm.days_of_week}
                      onChange={(v) => setEditForm({ ...editForm, days_of_week: v })}
                    />
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-slate-500 px-3 py-2 hover:text-slate-800"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveEdit(habit.id)}
                        className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-medium hover:bg-slate-800"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </li>
              )
            }

            return (
              <li
                key={habit.id}
                className={`flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 ${
                  !scheduledToday ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => scheduledToday && toggleToday(habit)}
                    disabled={!scheduledToday}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0 ${
                      done
                        ? habit.habit_type === 'avoid'
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 text-transparent hover:border-slate-400'
                    } ${!scheduledToday ? 'cursor-not-allowed' : ''}`}
                  >
                    ✓
                  </button>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {habit.habit_type === 'avoid' ? '🚫 ' : ''}
                      {habit.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {habit.category ? `${habit.category} · ` : ''}
                      {daysLabel(habit)}
                      {!scheduledToday ? ' · não é hoje' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">🔥 {streaks[habit.id] ?? 0}d</span>
                  <button
                    onClick={() => startEdit(habit)}
                    className="text-xs text-slate-400 hover:text-slate-800"
                  >
                    editar
                  </button>
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
