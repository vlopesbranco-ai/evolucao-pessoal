import { useEffect, useMemo, useState } from 'react'
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

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

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
  { key: 'registros', label: 'Ciclo & Intimidade' },
  { key: 'humor', label: 'Humor' },
  { key: 'datas', label: 'Datas & Anotações' },
]

export default function Marriage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('visao')

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
      symptoms: cycleSymptoms.trim() || null,
      note: cycleNote.trim() || null,
    })
    setCycleSymptoms('')
    setCycleNote('')
    setCycleDate(todayStr())
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
  let avgCycleLength = null
  let predictedNext = null
  let fertileWindow = null
  if (cycleLogs.length >= 2) {
    const sorted = [...cycleLogs].sort((a, b) => new Date(a.cycle_start) - new Date(b.cycle_start))
    const diffs = []
    for (let i = 1; i < sorted.length; i++) {
      diffs.push(daysBetween(sorted[i - 1].cycle_start, sorted[i].cycle_start))
    }
    avgCycleLength = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
    const lastStart = sorted[sorted.length - 1].cycle_start
    const next = new Date(lastStart + 'T00:00:00')
    next.setDate(next.getDate() + avgCycleLength)
    predictedNext = next.toISOString().slice(0, 10)

    const ovulation = new Date(next)
    ovulation.setDate(ovulation.getDate() - 14)
    const fertileStart = new Date(ovulation)
    fertileStart.setDate(fertileStart.getDate() - 5)
    const fertileEnd = new Date(ovulation)
    fertileEnd.setDate(fertileEnd.getDate() + 1)
    fertileWindow = {
      start: fertileStart.toISOString().slice(0, 10),
      end: fertileEnd.toISOString().slice(0, 10),
    }
  }

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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Casamento</h1>
        <p className="text-sm text-slate-500">Registro manual e privado — só você alimenta esses dados.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 text-sm overflow-x-auto">
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

              {cycleLogs.length >= 2 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                  <p className="text-xs text-slate-400">Estimativa de ciclo</p>
                  <p className="text-sm text-slate-700">
                    Duração média: <span className="font-semibold">{avgCycleLength} dias</span> · Próximo ciclo:{' '}
                    <span className="font-semibold">{fmt(predictedNext)}</span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Janela fértil estimada:{' '}
                    <span className="font-semibold">
                      {fmt(fertileWindow.start)} a {fmt(fertileWindow.end)}
                    </span>
                  </p>
                </div>
              )}
            </>
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
                      <p className="font-medium">{fmt(c.cycle_start)}</p>
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
              <ul className="space-y-1 max-h-96 overflow-y-auto">
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
              <ul className="space-y-1 max-h-96 overflow-y-auto">
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
  )
}
