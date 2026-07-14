import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { todayStr, localDateStr } from '../lib/date'

const WEEKDAYS = [
  { value: 0, label: 'D' },
  { value: 1, label: 'S' },
  { value: 2, label: 'T' },
  { value: 3, label: 'Q' },
  { value: 4, label: 'Q' },
  { value: 5, label: 'S' },
  { value: 6, label: 'S' },
]

const SUGGESTED_CATEGORIES = ['Saúde', 'Alimentação', 'Trabalho', 'Casamento', 'Filha', 'Financeiro', 'Estudo', 'Pessoal']

function isFlexible(habit) {
  return !!habit.times_per_week
}

function isScheduledToday(habit) {
  if (isFlexible(habit)) return true
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(new Date().getDay())
}

function isScheduledOn(habit, date) {
  if (isFlexible(habit)) return true
  if (!habit.days_of_week || habit.days_of_week.length === 0) return true
  return habit.days_of_week.includes(date.getDay())
}

function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function emptyForm() {
  return { name: '', category: '', habit_type: 'build', scheduleMode: 'daily', days_of_week: [], times_per_week: 3 }
}

function habitToForm(habit) {
  const scheduleMode = habit.times_per_week ? 'weekly' : habit.days_of_week?.length ? 'days' : 'daily'
  return {
    name: habit.name,
    category: habit.category ?? '',
    habit_type: habit.habit_type ?? 'build',
    scheduleMode,
    days_of_week: habit.days_of_week ?? [],
    times_per_week: habit.times_per_week ?? 3,
  }
}

function formToPayload(form) {
  return {
    name: form.name.trim(),
    category: form.category.trim() || null,
    habit_type: form.habit_type,
    days_of_week: form.scheduleMode === 'days' && form.days_of_week.length ? form.days_of_week : null,
    times_per_week: form.scheduleMode === 'weekly' ? form.times_per_week : null,
  }
}

export default function Habits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logsToday, setLogsToday] = useState(new Set())
  const [streaks, setStreaks] = useState({})
  const [weeklyProgress, setWeeklyProgress] = useState({})
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('Todas')

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

    const weekStart = localDateStr(startOfWeek(new Date()))
    const weekEnd = localDateStr(new Date(startOfWeek(new Date()).getTime() + 6 * 86400000))

    const streakMap = {}
    const weeklyMap = {}
    for (const habit of habitsData ?? []) {
      const dates = byHabit[habit.id] ?? new Set()

      if (isFlexible(habit)) {
        let count = 0
        for (const d of dates) {
          if (d >= weekStart && d <= weekEnd) count++
        }
        weeklyMap[habit.id] = count
        continue
      }

      let streak = 0
      let cursor = new Date()
      if (!dates.has(todayStr()) && isScheduledToday(habit)) cursor.setDate(cursor.getDate() - 1)
      for (let i = 0; i < 400; i++) {
        const dateStr = localDateStr(cursor)
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
    setWeeklyProgress(weeklyMap)
    setLoading(false)
  }

  useEffect(() => {
    load()
    function msUntilNextMidnight() {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
      return next - now
    }
    let timeoutId
    function scheduleReload() {
      timeoutId = setTimeout(() => {
        load()
        scheduleReload()
      }, msUntilNextMidnight())
    }
    scheduleReload()
    return () => clearTimeout(timeoutId)
  }, [])

  function toggleDay(days, value) {
    return days.includes(value) ? days.filter((d) => d !== value) : [...days, value].sort()
  }

  async function addHabit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    await supabase.from('habits').insert({ user_id: user.id, ...formToPayload(form) })
    setForm(emptyForm())
    load()
  }

  function startEdit(habit) {
    setEditingId(habit.id)
    setEditForm(habitToForm(habit))
  }

  async function saveEdit(habitId) {
    if (!editForm.name.trim()) return
    await supabase.from('habits').update(formToPayload(editForm)).eq('id', habitId)
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

  function SchedulePicker({ f, setF }) {
    return (
      <div className="space-y-2">
        <div className="flex gap-1 text-xs">
          {[
            { value: 'daily', label: 'Todo dia' },
            { value: 'days', label: 'Dias específicos' },
            { value: 'weekly', label: 'X vezes/semana' },
          ].map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setF({ ...f, scheduleMode: opt.value })}
              className={`px-3 py-1.5 rounded-full border ${
                f.scheduleMode === opt.value
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-300 text-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {f.scheduleMode === 'days' && (
          <DaysPicker value={f.days_of_week} onChange={(v) => setF({ ...f, days_of_week: v })} />
        )}
        {f.scheduleMode === 'weekly' && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button
              type="button"
              onClick={() => setF({ ...f, times_per_week: Math.max(1, f.times_per_week - 1) })}
              className="w-7 h-7 rounded-full border border-slate-300 hover:border-slate-400"
            >
              −
            </button>
            <span className="w-16 text-center">{f.times_per_week}x / semana</span>
            <button
              type="button"
              onClick={() => setF({ ...f, times_per_week: Math.min(7, f.times_per_week + 1) })}
              className="w-7 h-7 rounded-full border border-slate-300 hover:border-slate-400"
            >
              +
            </button>
            <span className="text-slate-400">sem dias fixos — marque quando fizer</span>
          </div>
        )}
      </div>
    )
  }

  function CategoryChips({ value, onChange }) {
    return (
      <div className="flex flex-wrap gap-1">
        {SUGGESTED_CATEGORIES.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => onChange(c)}
            className={`px-2.5 py-1 rounded-full text-xs border ${
              value === c ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-500 hover:border-slate-400'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    )
  }

  function daysLabel(habit) {
    if (isFlexible(habit)) return `${habit.times_per_week}x/semana`
    if (!habit.days_of_week || habit.days_of_week.length === 0) return 'todo dia'
    return habit.days_of_week.map((d) => WEEKDAYS[d].label).join(' ')
  }

  const categories = useMemo(() => {
    const set = new Set(habits.map((h) => h.category?.trim()).filter(Boolean))
    return ['Todas', ...Array.from(set).sort(), 'Sem categoria']
  }, [habits])

  const filteredHabits = useMemo(() => {
    if (categoryFilter === 'Todas') return habits
    if (categoryFilter === 'Sem categoria') return habits.filter((h) => !h.category)
    return habits.filter((h) => h.category === categoryFilter)
  }, [habits, categoryFilter])

  const grouped = useMemo(() => {
    const groups = {}
    for (const habit of filteredHabits) {
      const key = habit.category?.trim() || 'Sem categoria'
      if (!groups[key]) groups[key] = []
      groups[key].push(habit)
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Sem categoria') return 1
      if (b === 'Sem categoria') return -1
      return a.localeCompare(b)
    })
  }, [filteredHabits])

  function renderHabitRow(habit) {
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
          <CategoryChips value={editForm.category} onChange={(c) => setEditForm({ ...editForm, category: c })} />
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, habit_type: 'build' })}
              className={`px-3 py-1.5 rounded-full border ${
                editForm.habit_type === 'build' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-300 text-slate-500'
              }`}
            >
              Fazer
            </button>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, habit_type: 'avoid' })}
              className={`px-3 py-1.5 rounded-full border ${
                editForm.habit_type === 'avoid' ? 'bg-red-500 text-white border-red-500' : 'border-slate-300 text-slate-500'
              }`}
            >
              Evitar
            </button>
          </div>
          <SchedulePicker f={editForm} setF={setEditForm} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingId(null)} className="text-xs text-slate-500 px-3 py-2 hover:text-slate-800">
              Cancelar
            </button>
            <button
              onClick={() => saveEdit(habit.id)}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-medium hover:bg-slate-800"
            >
              Salvar
            </button>
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
              {daysLabel(habit)}
              {!scheduledToday ? ' · não é hoje' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isFlexible(habit) ? (
            <span className="text-xs text-slate-500">
              {weeklyProgress[habit.id] ?? 0}/{habit.times_per_week} esta semana
            </span>
          ) : (
            <span className="text-xs text-slate-500">🔥 {streaks[habit.id] ?? 0}d</span>
          )}
          <button onClick={() => startEdit(habit)} className="text-xs text-slate-400 hover:text-slate-800">
            editar
          </button>
          <button onClick={() => archive(habit)} className="text-xs text-slate-300 hover:text-red-500">
            arquivar
          </button>
        </div>
      </li>
    )
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
            placeholder="Nome (ex: Meditar 10min, Academia)"
            className="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Categoria (opcional)"
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <CategoryChips value={form.category} onChange={(c) => setForm({ ...form, category: c })} />
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => setForm({ ...form, habit_type: 'build' })}
            className={`px-3 py-1.5 rounded-full border ${
              form.habit_type === 'build' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-300 text-slate-500'
            }`}
          >
            Fazer
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, habit_type: 'avoid' })}
            className={`px-3 py-1.5 rounded-full border ${
              form.habit_type === 'avoid' ? 'bg-red-500 text-white border-red-500' : 'border-slate-300 text-slate-500'
            }`}
          >
            Evitar
          </button>
        </div>
        <SchedulePicker f={form} setF={setForm} />
        <button className="w-full rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">
          Adicionar
        </button>
      </form>

      {categories.length > 2 && (
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                categoryFilter === c
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-300 text-slate-500 hover:border-slate-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : habits.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum hábito ainda. Adicione o primeiro acima.</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-2">
              {categoryFilter === 'Todas' && (
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{category}</p>
              )}
              <ul className="space-y-2">{items.map(renderHabitRow)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
