import { useEffect, useMemo, useRef, useState } from 'react'
import { todayStr, localDateStr } from '../lib/date'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Heatmap from '../components/Heatmap'
import { computeCycleInsights, periodRanges } from '../lib/cycle'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Muito mal' },
  { value: 2, emoji: '🙁', label: 'Mal' },
  { value: 3, emoji: '😐', label: 'Neutra' },
  { value: 4, emoji: '🙂', label: 'Bem' },
  { value: 5, emoji: '😄', label: 'Ótima' },
]

const NOTE_CATEGORIES = [
  { value: 'gosta', label: 'Ela gosta' },
  { value: 'presente', label: 'Ideia de presente' },
  { value: 'memoria', label: 'Memória' },
  { value: 'outro', label: 'Outro' },
]

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function fmt(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const TABS = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'calendario', label: 'Calendário' },
  { key: 'registros', label: 'Ciclo & Intimidade' },
  { key: 'humor', label: 'Humor' },
  { key: 'datas', label: 'Datas & Anotações' },
]

const CAL_WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const CAL_MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function Marriage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('visao')
  const contentRef = useRef(null)
  const [calMonthCursor, setCalMonthCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [calSelectedDate, setCalSelectedDate] = useState(todayStr())

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [tab])

  const [intimacyLogs, setIntimacyLogs] = useState([])
  const [cycleLogs, setCycleLogs] = useState([])
  const [moods, setMoods] = useState([])
  const [dates, setDates] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  const [intimacyNote, setIntimacyNote] = useState('')
  const [intimacyDate, setIntimacyDate] = useState(todayStr())
  const [usedProtection, setUsedProtection] = useState(true)

  const [cycleDate, setCycleDate] = useState(todayStr())
  const [cyclePeriodLength, setCyclePeriodLength] = useState(5)
  const [cycleSymptoms, setCycleSymptoms] = useState('')
  const [cycleNote, setCycleNote] = useState('')

  const [moodDate, setMoodDate] = useState(todayStr())
  const [moodValue, setMoodValue] = useState(3)
  const [moodNote, setMoodNote] = useState('')

  const [dateTitle, setDateTitle] = useState('')
  const [dateValue, setDateValue] = useState('')
  const [dateRecurring, setDateRecurring] = useState(true)
  const [dateNote, setDateNote] = useState('')

  const [noteCategory, setNoteCategory] = useState('gosta')
  const [noteContent, setNoteContent] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: intimacy }, { data: cycles }, { data: moodData }, { data: dateData }, { data: noteData }] =
      await Promise.all([
        supabase.from('intimacy_logs').select('*').order('occurred_at', { ascending: false }).limit(500),
        supabase.from('cycle_logs').select('*').order('cycle_start', { ascending: false }).limit(24),
        supabase.from('wife_moods').select('*').order('mood_date', { ascending: false }).limit(60),
        supabase.from('important_dates').select('*').order('date', { ascending: true }),
        supabase.from('wife_notes').select('*').order('created_at', { ascending: false }),
      ])

    setIntimacyLogs(intimacy ?? [])
    setCycleLogs(cycles ?? [])
    setMoods(moodData ?? [])
    setDates(dateData ?? [])
    setNotes(noteData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addIntimacy(e) {
    e.preventDefault()
    await supabase.from('intimacy_logs').insert({
      user_id: user.id,
      occurred_at: intimacyDate,
      used_protection: usedProtection,
      note: intimacyNote.trim() || null,
    })
    setIntimacyNote('')
    setIntimacyDate(todayStr())
    setUsedProtection(true)
    load()
  }

  async function removeIntimacy(id) {
    await supabase.from('intimacy_logs').delete().eq('id', id)
    load()
  }

  async function addCycle(e) {
    e.preventDefault()
    await supabase.from('cycle_logs').insert({
      user_id: user.id,
      cycle_start: cycleDate,
      period_length: cyclePeriodLength,
      symptoms: cycleSymptoms.trim() || null,
      note: cycleNote.trim() || null,
    })
    setCycleSymptoms('')
    setCycleNote('')
    setCycleDate(todayStr())
    setCyclePeriodLength(5)
    load()
  }

  async function removeCycle(id) {
    await supabase.from('cycle_logs').delete().eq('id', id)
    load()
  }

  async function addMood(e) {
    e.preventDefault()
    await supabase.from('wife_moods').upsert(
      {
        user_id: user.id,
        mood_date: moodDate,
        mood: moodValue,
        note: moodNote.trim() || null,
      },
      { onConflict: 'user_id,mood_date' }
    )
    setMoodNote('')
    setMoodDate(todayStr())
    setMoodValue(3)
    load()
  }

  async function removeMood(id) {
    await supabase.from('wife_moods').delete().eq('id', id)
    load()
  }

  async function addDate(e) {
    e.preventDefault()
    if (!dateTitle.trim() || !dateValue) return
    await supabase.from('important_dates').insert({
      user_id: user.id,
      title: dateTitle.trim(),
      date: dateValue,
      recurring: dateRecurring,
      note: dateNote.trim() || null,
    })
    setDateTitle('')
    setDateValue('')
    setDateNote('')
    setDateRecurring(true)
    load()
  }

  async function removeDate(id) {
    await supabase.from('important_dates').delete().eq('id', id)
    load()
  }

  async function addNote(e) {
    e.preventDefault()
    if (!noteContent.trim()) return
    await supabase.from('wife_notes').insert({
      user_id: user.id,
      category: noteCategory,
      content: noteContent.trim(),
    })
    setNoteContent('')
    load()
  }

  async function removeNote(id) {
    await supabase.from('wife_notes').delete().eq('id', id)
    load()
  }

  // ---- Cálculos: ciclo ----
  const cycleInsights = useMemo(() => computeCycleInsights(cycleLogs), [cycleLogs])
  const cycleRanges = useMemo(() => periodRanges(cycleLogs), [cycleLogs])

  function calInRange(dateStr, range) {
    return range && dateStr >= range.start && dateStr <= range.end
  }

  function calPeriodOn(dateStr) {
    if (cycleRanges.some((r) => calInRange(dateStr, r))) return 'registrado'
    if (cycleInsights && calInRange(dateStr, cycleInsights.predictedNext)) return 'previsto'
    return null
  }

  function calFertileOn(dateStr) {
    return !!(cycleInsights && calInRange(dateStr, cycleInsights.fertileWindow))
  }

  function calIntimacyOn(dateStr) {
    return intimacyLogs.some((i) => i.occurred_at === dateStr)
  }

  const calGrid = useMemo(() => {
    const gridStart = new Date(calMonthCursor)
    gridStart.setDate(gridStart.getDate() - gridStart.getDay())
    const cells = []
    const cursor = new Date(gridStart)
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return cells
  }, [calMonthCursor])

  // ---- Cálculos: estatísticas de intimidade ----
  const stats = useMemo(() => {
    if (intimacyLogs.length === 0) return null
    const datesSorted = [...intimacyLogs].map((l) => l.occurred_at).sort()
    const first = datesSorted[0]
    const totalWeeks = Math.max(1, daysBetween(first, todayStr()) / 7)
    const totalMonths = Math.max(1, daysBetween(first, todayStr()) / 30.44)
    const avgPerWeek = (intimacyLogs.length / totalWeeks).toFixed(1)
    const avgPerMonth = (intimacyLogs.length / totalMonths).toFixed(1)

    let longestGap = 0
    for (let i = 1; i < datesSorted.length; i++) {
      longestGap = Math.max(longestGap, daysBetween(datesSorted[i - 1], datesSorted[i]))
    }
    const daysSinceLast = daysBetween(datesSorted[datesSorted.length - 1], todayStr())

    const withProtection = intimacyLogs.filter((l) => l.used_protection === true).length
    const withoutProtection = intimacyLogs.filter((l) => l.used_protection === false).length

    return { avgPerWeek, avgPerMonth, longestGap, daysSinceLast, withProtection, withoutProtection, total: intimacyLogs.length }
  }, [intimacyLogs])

  const monthlyChartData = useMemo(() => {
    const now = new Date()
    const buckets = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      buckets[key] = { label: `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, count: 0 }
    }
    for (const log of intimacyLogs) {
      const d = new Date(log.occurred_at + 'T00:00:00')
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (buckets[key]) buckets[key].count++
    }
    return Object.values(buckets)
  }, [intimacyLogs])

  const heatmapData = useMemo(() => {
    const map = {}
    for (const log of intimacyLogs) {
      map[log.occurred_at] = (map[log.occurred_at] ?? 0) + 1
    }
    return map
  }, [intimacyLogs])

  const moodChartData = useMemo(() => {
    return [...moods]
      .sort((a, b) => new Date(a.mood_date) - new Date(b.mood_date))
      .slice(-30)
      .map((m) => ({ date: fmt(m.mood_date).slice(0, 5), mood: m.mood }))
  }, [moods])

  const upcomingDates = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return [...dates]
      .map((d) => {
        const original = new Date(d.date + 'T00:00:00')
        let next = new Date(original)
        if (d.recurring) {
          next.setFullYear(now.getFullYear())
          if (next < now) next.setFullYear(now.getFullYear() + 1)
        }
        const daysUntil = Math.round((next - now) / 86400000)
        return { ...d, next, daysUntil }
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }, [dates])

  return (
    <div className="h-full flex flex-col overflow-y-hidden">
      <div className="shrink-0 space-y-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Casamento</h1>
          <p className="text-sm text-slate-500">Registro manual e privado — só você alimenta esses dados.</p>
        </div>

        <div className="-mx-4 px-4 bg-slate-50 flex gap-1 border-b border-slate-200 text-sm overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 border-b-2 whitespace-nowrap ${
                tab === t.key
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto safe-scroll pt-4 space-y-6">
      {tab === 'visao' && (
        <div className="space-y-6">
          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : !stats ? (
            <p className="text-sm text-slate-400">Sem registros de intimidade ainda — adicione na aba "Ciclo & Intimidade".</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Média/semana</p>
                  <p className="text-xl font-semibold text-slate-900">{stats.avgPerWeek}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Média/mês</p>
                  <p className="text-xl font-semibold text-slate-900">{stats.avgPerMonth}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Maior intervalo</p>
                  <p className="text-xl font-semibold text-slate-900">{stats.longestGap}d</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Desde o último</p>
                  <p className="text-xl font-semibold text-slate-900">{stats.daysSinceLast}d</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Frequência por mês (últimos 12 meses)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyChartData}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Últimas 16 semanas</p>
                <Heatmap data={heatmapData} weeks={16} />
              </div>

              {(stats.withProtection > 0 || stats.withoutProtection > 0) && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-700 mb-1">Proteção</p>
                  <p>
                    Com proteção: <span className="font-semibold">{stats.withProtection}</span> · Sem proteção:{' '}
                    <span className="font-semibold">{stats.withoutProtection}</span>
                  </p>
                </div>
              )}

              {cycleInsights && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                  <p className="text-xs text-slate-400">Estimativa de ciclo</p>
                  <p className="text-sm text-slate-700">
                    Duração média: <span className="font-semibold">{cycleInsights.avgCycleLength} dias</span> · Próximo
                    período: <span className="font-semibold">{fmt(cycleInsights.predictedNext.start)} a {fmt(cycleInsights.predictedNext.end)}</span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Janela fértil estimada:{' '}
                    <span className="font-semibold">
                      {fmt(cycleInsights.fertileWindow.start)} a {fmt(cycleInsights.fertileWindow.end)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 pt-1">Veja as faixas completas na Agenda.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'calendario' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCalMonthCursor(new Date(calMonthCursor.getFullYear(), calMonthCursor.getMonth() - 1, 1))}
                className="text-slate-400 hover:text-slate-800 px-2"
              >
                ‹
              </button>
              <p className="text-sm font-medium text-slate-800">
                {CAL_MONTH_LABELS[calMonthCursor.getMonth()]} {calMonthCursor.getFullYear()}
              </p>
              <button
                onClick={() => setCalMonthCursor(new Date(calMonthCursor.getFullYear(), calMonthCursor.getMonth() + 1, 1))}
                className="text-slate-400 hover:text-slate-800 px-2"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
              {CAL_WEEKDAY_LABELS.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calGrid.map((date) => {
                const dateStr = localDateStr(date)
                const inMonth = date.getMonth() === calMonthCursor.getMonth()
                const isToday = dateStr === todayStr()
                const isSelected = dateStr === calSelectedDate
                const periodStatus = calPeriodOn(dateStr)
                const fertile = calFertileOn(dateStr)
                const intimacy = calIntimacyOn(dateStr)

                let bg = 'bg-transparent'
                let textColor = inMonth ? 'text-slate-700' : 'text-slate-300'
                if (periodStatus === 'registrado') {
                  bg = 'bg-pink-500'
                  textColor = 'text-white'
                } else if (periodStatus === 'previsto') {
                  bg = 'bg-pink-100'
                  textColor = 'text-pink-700'
                } else if (fertile) {
                  bg = 'bg-purple-100'
                  textColor = 'text-purple-700'
                }

                return (
                  <button
                    key={dateStr}
                    onClick={() => setCalSelectedDate(dateStr)}
                    className={`relative aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 border ${bg} ${textColor} ${
                      isSelected
                        ? 'border-slate-900 ring-2 ring-slate-900'
                        : isToday
                        ? 'border-slate-500'
                        : 'border-transparent'
                    }`}
                  >
                    <span>{date.getDate()}</span>
                    {intimacy && <span className="absolute bottom-0.5 text-[10px] leading-none">❤️</span>}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-500" /> Período registrado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-100 border border-pink-300" /> Período previsto</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-300" /> Janela fértil</span>
              <span className="flex items-center gap-1">❤️ Intimidade</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-slate-800">{fmt(calSelectedDate)}</p>
            {calPeriodOn(calSelectedDate) === 'registrado' && (
              <p className="text-xs text-pink-700 bg-pink-50 rounded-lg px-2 py-1">🩸 Dia de período registrado</p>
            )}
            {calPeriodOn(calSelectedDate) === 'previsto' && (
              <p className="text-xs text-pink-700 bg-pink-50 rounded-lg px-2 py-1">🩸 Dia de período previsto (estimativa)</p>
            )}
            {calFertileOn(calSelectedDate) && (
              <p className="text-xs text-purple-700 bg-purple-50 rounded-lg px-2 py-1">🌸 Janela fértil estimada</p>
            )}
            {calIntimacyOn(calSelectedDate) && (
              <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1">❤️ Atividade íntima registrada</p>
            )}
            {!calPeriodOn(calSelectedDate) && !calFertileOn(calSelectedDate) && !calIntimacyOn(calSelectedDate) && (
              <p className="text-xs text-slate-400">Nenhum registro nesse dia.</p>
            )}
          </div>

          {!cycleInsights && (
            <p className="text-xs text-slate-400">
              Registre pelo menos 2 ciclos em "Ciclo & Intimidade" pra ver a previsão de período e janela fértil aqui.
            </p>
          )}
        </div>
      )}

      {tab === 'registros' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-700">Ciclo da esposa</h2>
            <form onSubmit={addCycle} className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={cycleDate}
                  onChange={(e) => setCycleDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={cycleSymptoms}
                  onChange={(e) => setCycleSymptoms(e.target.value)}
                  placeholder="Sintomas (opcional)"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <label htmlFor="periodLength">Duração do período (dias)</label>
                <input
                  id="periodLength"
                  type="number"
                  min={1}
                  max={14}
                  value={cyclePeriodLength}
                  onChange={(e) => setCyclePeriodLength(Number(e.target.value) || 5)}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              <input
                value={cycleNote}
                onChange={(e) => setCycleNote(e.target.value)}
                placeholder="Nota (opcional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
                Registrar início de ciclo
              </button>
            </form>
            {loading ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : cycleLogs.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
            ) : (
              <ul className="space-y-1">
                {cycleLogs.map((c) => (
                  <li
                    key={c.id}
                    className="text-xs text-slate-600 flex justify-between items-start bg-white border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{fmt(c.cycle_start)} · {c.period_length ?? 5}d de período</p>
                      {c.symptoms && <p className="text-slate-400">{c.symptoms}</p>}
                      {c.note && <p className="text-slate-400">{c.note}</p>}
                    </div>
                    <button onClick={() => removeCycle(c.id)} className="text-slate-300 hover:text-red-500">
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-700">Atividade íntima</h2>
            <form onSubmit={addIntimacy} className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
              <input
                type="date"
                value={intimacyDate}
                onChange={(e) => setIntimacyDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setUsedProtection(true)}
                  className={`flex-1 px-3 py-1.5 rounded-full border ${
                    usedProtection ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-300 text-slate-500'
                  }`}
                >
                  Com proteção
                </button>
                <button
                  type="button"
                  onClick={() => setUsedProtection(false)}
                  className={`flex-1 px-3 py-1.5 rounded-full border ${
                    !usedProtection ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-300 text-slate-500'
                  }`}
                >
                  Sem proteção
                </button>
              </div>
              <input
                value={intimacyNote}
                onChange={(e) => setIntimacyNote(e.target.value)}
                placeholder="Nota (opcional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
                Registrar
              </button>
            </form>
            {loading ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : intimacyLogs.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
            ) : (
              <ul className="space-y-1 max-h-96 overflow-y-auto overscroll-contain">
                {intimacyLogs.slice(0, 30).map((i) => (
                  <li
                    key={i.id}
                    className="text-xs text-slate-600 flex justify-between items-start bg-white border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">
                        {fmt(i.occurred_at)}{' '}
                        <span className="text-slate-400 font-normal">
                          {i.used_protection === null ? '' : i.used_protection ? '· com proteção' : '· sem proteção'}
                        </span>
                      </p>
                      {i.note && <p className="text-slate-400">{i.note}</p>}
                    </div>
                    <button onClick={() => removeIntimacy(i.id)} className="text-slate-300 hover:text-red-500">
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'humor' && (
        <div className="space-y-4">
          <form onSubmit={addMood} className="space-y-3 bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex gap-2">
              <input
                type="date"
                value={moodDate}
                onChange={(e) => setMoodDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value)}
                placeholder="Nota (opcional)"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-between">
              {MOODS.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => setMoodValue(m.value)}
                  title={m.label}
                  className={`flex-1 text-2xl py-2 rounded-lg border ${
                    moodValue === m.value ? 'border-slate-900 bg-slate-100' : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
            <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
              Registrar humor de hoje
            </button>
          </form>

          {moodChartData.length >= 2 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Tendência (últimos registros)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={moodChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[1, 5]} allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                  <Tooltip />
                  <Line type="monotone" dataKey="mood" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : moods.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
          ) : (
            <ul className="space-y-1">
              {moods.map((m) => (
                <li
                  key={m.id}
                  className="text-xs text-slate-600 flex justify-between items-start bg-white border border-slate-200 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="font-medium">
                      {fmt(m.mood_date)} · {MOODS.find((x) => x.value === m.mood)?.emoji}{' '}
                      {MOODS.find((x) => x.value === m.mood)?.label}
                    </p>
                    {m.note && <p className="text-slate-400">{m.note}</p>}
                  </div>
                  <button onClick={() => removeMood(m.id)} className="text-slate-300 hover:text-red-500">
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'datas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-700">Datas importantes</h2>
            <form onSubmit={addDate} className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
              <input
                value={dateTitle}
                onChange={(e) => setDateTitle(e.target.value)}
                placeholder="Título (ex: Aniversário dela)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={dateRecurring} onChange={(e) => setDateRecurring(e.target.checked)} />
                Repete todo ano
              </label>
              <input
                value={dateNote}
                onChange={(e) => setDateNote(e.target.value)}
                placeholder="Nota (opcional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
                Adicionar
              </button>
            </form>
            {upcomingDates.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma data cadastrada.</p>
            ) : (
              <ul className="space-y-1">
                {upcomingDates.map((d) => (
                  <li
                    key={d.id}
                    className="text-xs text-slate-600 flex justify-between items-start bg-white border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-slate-400">
                        {d.daysUntil === 0 ? 'Hoje!' : d.daysUntil < 0 ? `${fmt(d.date)}` : `Faltam ${d.daysUntil} dias`}
                      </p>
                      {d.note && <p className="text-slate-400">{d.note}</p>}
                    </div>
                    <button onClick={() => removeDate(d.id)} className="text-slate-300 hover:text-red-500">
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-700">Anotações</h2>
            <form onSubmit={addNote} className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
              <div className="flex flex-wrap gap-1">
                {NOTE_CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c.value}
                    onClick={() => setNoteCategory(c.value)}
                    className={`px-3 py-1.5 rounded-full text-xs border ${
                      noteCategory === c.value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-300 text-slate-500'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Escreva aqui..."
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
                Salvar anotação
              </button>
            </form>
            {notes.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma anotação ainda.</p>
            ) : (
              <ul className="space-y-1 max-h-96 overflow-y-auto overscroll-contain">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="text-xs text-slate-600 flex justify-between items-start bg-white border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-slate-400">{NOTE_CATEGORIES.find((c) => c.value === n.category)?.label}</p>
                      <p className="font-medium text-slate-700">{n.content}</p>
                    </div>
                    <button onClick={() => removeNote(n.id)} className="text-slate-300 hover:text-red-500 shrink-0 ml-2">
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      </div>
    </div>
  )
}
