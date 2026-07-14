import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { todayStr, localDateStr } from '../lib/date'
import { EVENT_CATEGORIES, categoryInfo } from '../lib/eventCategories'

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]


function fmt(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [addMode, setAddMode] = useState('task') // 'task' | 'event'

  const [tasks, setTasks] = useState([])
  const [importantDates, setImportantDates] = useState([])
  const [events, setEvents] = useState([])
  const [intimacyLogs, setIntimacyLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const [taskTitle, setTaskTitle] = useState('')
  const [taskNote, setTaskNote] = useState('')

  const [eventTitle, setEventTitle] = useState('')
  const [eventCategory, setEventCategory] = useState('encontro')
  const [eventEnd, setEventEnd] = useState('')
  const [eventNote, setEventNote] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: taskData }, { data: dateData }, { data: eventData }, { data: intimacyData }] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('important_dates').select('*'),
      supabase.from('calendar_events').select('*').order('start_date', { ascending: false }),
      supabase.from('intimacy_logs').select('id, occurred_at').limit(1000),
    ])
    setTasks(taskData ?? [])
    setImportantDates(dateData ?? [])
    setEvents(eventData ?? [])
    setIntimacyLogs(intimacyData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addTask(e) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    await supabase.from('tasks').insert({
      user_id: user.id,
      title: taskTitle.trim(),
      due_date: selectedDate,
      note: taskNote.trim() || null,
    })
    setTaskTitle('')
    setTaskNote('')
    load()
  }

  async function toggleTask(task) {
    await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)
    load()
  }

  async function removeTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    load()
  }

  async function addEvent(e) {
    e.preventDefault()
    if (!eventTitle.trim()) return
    await supabase.from('calendar_events').insert({
      user_id: user.id,
      title: eventTitle.trim(),
      category: eventCategory,
      start_date: selectedDate,
      end_date: eventEnd || null,
      note: eventNote.trim() || null,
    })
    setEventTitle('')
    setEventEnd('')
    setEventNote('')
    setEventCategory('encontro')
    load()
  }

  async function removeEvent(id) {
    await supabase.from('calendar_events').delete().eq('id', id)
    load()
  }

  function importantDatesOn(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return importantDates.filter((imp) => {
      const [iy, im, id_] = imp.date.split('-').map(Number)
      if (imp.recurring) return im === m && id_ === d
      return iy === y && im === m && id_ === d
    })
  }

  function tasksOn(dateStr) {
    return tasks.filter((t) => t.due_date === dateStr)
  }

  function eventsOn(dateStr) {
    return events.filter((ev) => {
      const end = ev.end_date || ev.start_date
      return dateStr >= ev.start_date && dateStr <= end
    })
  }

  function intimacyOn(dateStr) {
    return intimacyLogs.filter((i) => i.occurred_at === dateStr)
  }

  const grid = useMemo(() => {
    const firstOfMonth = monthCursor
    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(gridStart.getDate() - gridStart.getDay())
    const cells = []
    const cursor = new Date(gridStart)
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return cells
  }, [monthCursor])

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.done)
        .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
        .slice(0, 8),
    [tasks]
  )

  const selectedTasks = tasksOn(selectedDate)
  const selectedImportant = importantDatesOn(selectedDate)
  const selectedEvents = eventsOn(selectedDate)
  const selectedIntimacy = intimacyOn(selectedDate)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Calendário</h1>
        <p className="text-sm text-slate-500">Tarefas, eventos, datas importantes e intimidade, tudo num lugar só.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
              className="text-slate-400 hover:text-slate-800 px-2"
            >
              ‹
            </button>
            <p className="text-sm font-medium text-slate-800">
              {MONTH_LABELS[monthCursor.getMonth()]} {monthCursor.getFullYear()}
            </p>
            <button
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
              className="text-slate-400 hover:text-slate-800 px-2"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
            {WEEKDAY_LABELS.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((date) => {
              const dateStr = localDateStr(date)
              const inMonth = date.getMonth() === monthCursor.getMonth()
              const isToday = dateStr === todayStr()
              const isSelected = dateStr === selectedDate
              const dayTasks = tasksOn(dateStr)
              const dayImportant = importantDatesOn(dateStr)
              const dayEvents = eventsOn(dateStr)
              const dayIntimacy = intimacyOn(dateStr)
              const eventCategoriesToday = [...new Set(dayEvents.map((e) => e.category))]

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 border ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : isToday
                      ? 'border-slate-900 text-slate-900'
                      : inMonth
                      ? 'border-transparent text-slate-700 hover:bg-slate-50'
                      : 'border-transparent text-slate-300'
                  }`}
                >
                  <span>{date.getDate()}</span>
                  <span className="flex gap-0.5 flex-wrap justify-center max-w-[24px]">
                    {dayTasks.length > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-sky-500'}`} />
                    )}
                    {eventCategoriesToday.map((cat) => (
                      <span
                        key={cat}
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : categoryInfo(cat).dot}`}
                      />
                    ))}
                    {dayImportant.length > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                    )}
                    {dayIntimacy.length > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-600'}`} />
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Tarefa</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Data importante</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> Intimidade</span>
            {EVENT_CATEGORIES.map((c) => (
              <span key={c.value} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} /> {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-800">{fmt(selectedDate)}</p>

            {selectedImportant.length > 0 && (
              <ul className="space-y-1">
                {selectedImportant.map((imp) => (
                  <li key={imp.id} className="text-xs text-rose-600 bg-rose-50 rounded-lg px-2 py-1">
                    🎉 {imp.title}
                  </li>
                ))}
              </ul>
            )}

            {selectedIntimacy.length > 0 && (
              <Link
                to="/casamento"
                className="block text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1 hover:bg-red-100"
              >
                ❤️ Atividade íntima registrada (ver em Casamento)
              </Link>
            )}

            {selectedEvents.length > 0 && (
              <ul className="space-y-1">
                {selectedEvents.map((ev) => {
                  const info = categoryInfo(ev.category)
                  return (
                    <li key={ev.id} className={`flex items-start justify-between gap-2 text-xs rounded-lg px-2 py-1.5 ${info.bg}`}>
                      <div className={info.text}>
                        <span>
                          {info.emoji} {ev.title}
                        </span>
                        {ev.end_date && ev.end_date !== ev.start_date && (
                          <span className="block opacity-70">
                            {fmt(ev.start_date)} a {fmt(ev.end_date)}
                          </span>
                        )}
                        {ev.note && <span className="block opacity-70">{ev.note}</span>}
                      </div>
                      <button onClick={() => removeEvent(ev.id)} className="text-slate-300 hover:text-red-500">
                        ×
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {selectedTasks.length > 0 && (
              <ul className="space-y-1">
                {selectedTasks.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2 text-xs bg-sky-50 rounded-lg px-2 py-1.5">
                    <label className="flex items-start gap-2 flex-1">
                      <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} className="mt-0.5" />
                      <span className={t.done ? 'line-through text-slate-400' : 'text-sky-700'}>
                        {t.title}
                        {t.note && <span className="block text-slate-400">{t.note}</span>}
                      </span>
                    </label>
                    <button onClick={() => removeTask(t.id)} className="text-slate-300 hover:text-red-500">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-1 text-xs pt-2 border-t border-slate-100">
              <button
                onClick={() => setAddMode('task')}
                className={`flex-1 py-1.5 rounded-lg border ${
                  addMode === 'task' ? 'bg-sky-500 text-white border-sky-500' : 'border-slate-300 text-slate-500'
                }`}
              >
                + Tarefa
              </button>
              <button
                onClick={() => setAddMode('event')}
                className={`flex-1 py-1.5 rounded-lg border ${
                  addMode === 'event' ? 'bg-violet-500 text-white border-violet-500' : 'border-slate-300 text-slate-500'
                }`}
              >
                + Evento
              </button>
            </div>

            {addMode === 'task' ? (
              <form onSubmit={addTask} className="space-y-2">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Nova tarefa nesse dia"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={taskNote}
                  onChange={(e) => setTaskNote(e.target.value)}
                  placeholder="Nota (opcional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
                  Adicionar tarefa
                </button>
              </form>
            ) : (
              <form onSubmit={addEvent} className="space-y-2">
                <input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Nome do evento"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-1">
                  {EVENT_CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setEventCategory(c.value)}
                      className={`px-2.5 py-1 rounded-full text-xs border ${
                        eventCategory === c.value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-300 text-slate-500'
                      }`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-slate-400">Termina em (opcional, pra férias/viagens)</label>
                  <input
                    type="date"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    min={selectedDate}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1"
                  />
                </div>
                <textarea
                  value={eventNote}
                  onChange={(e) => setEventNote(e.target.value)}
                  placeholder="Anotação (opcional)"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
                  Adicionar evento
                </button>
              </form>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-800 mb-2">Próximas tarefas</p>
            {loading ? (
              <p className="text-xs text-slate-400">Carregando...</p>
            ) : upcomingTasks.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma tarefa pendente.</p>
            ) : (
              <ul className="space-y-1">
                {upcomingTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-xs text-slate-600">
                    <span>{t.title}</span>
                    <span className="text-slate-400">{t.due_date ? fmt(t.due_date) : 'sem data'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
