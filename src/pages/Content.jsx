import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { todayStr, localDateStr } from '../lib/date'

const CONTENT_TYPES = [
  { value: 'video', label: 'Vídeo', emoji: '🎬' },
  { value: 'rede_social', label: 'Rede social', emoji: '📱' },
  { value: 'artigo', label: 'Artigo', emoji: '📰' },
  { value: 'livro', label: 'Livro', emoji: '📚' },
  { value: 'podcast', label: 'Podcast', emoji: '🎧' },
  { value: 'curso', label: 'Curso', emoji: '🎓' },
  { value: 'noticias', label: 'Notícias', emoji: '🗞️' },
  { value: 'outro', label: 'Outro', emoji: '📌' },
]

function typeInfo(value) {
  return CONTENT_TYPES.find((t) => t.value === value) ?? CONTENT_TYPES[CONTENT_TYPES.length - 1]
}

function toTimestamp(dateStr) {
  return `${dateStr}T12:00:00`
}

function fmt(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function Content() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const [date, setDate] = useState(todayStr())
  const [contentType, setContentType] = useState('video')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [duration, setDuration] = useState('')
  const [quality, setQuality] = useState('valuable')
  const [note, setNote] = useState('')

  async function load() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const { data } = await supabase
      .from('content_logs')
      .select('*')
      .gte('consumed_at', toTimestamp(localDateStr(since)))
      .order('consumed_at', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addLog(e) {
    e.preventDefault()
    if (!title.trim()) return
    await supabase.from('content_logs').insert({
      user_id: user.id,
      content_type: contentType,
      title: title.trim(),
      source: source.trim() || null,
      duration_minutes: duration ? Number(duration) : null,
      quality,
      consumed_at: toTimestamp(date),
      note: note.trim() || null,
    })
    setTitle('')
    setSource('')
    setDuration('')
    setNote('')
    load()
  }

  async function removeLog(id) {
    await supabase.from('content_logs').delete().eq('id', id)
    load()
  }

  const dayOf = (log) => localDateStr(new Date(log.consumed_at))

  const stats = useMemo(() => {
    if (logs.length === 0) return null
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = localDateStr(weekAgo)
    const weekLogs = logs.filter((l) => dayOf(l) >= weekAgoStr)

    const totalMinutesWeek = weekLogs.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0)
    const valuableMinutes = weekLogs.filter((l) => l.quality === 'valuable').reduce((s, l) => s + (l.duration_minutes ?? 0), 0)
    const junkMinutes = weekLogs.filter((l) => l.quality === 'junk').reduce((s, l) => s + (l.duration_minutes ?? 0), 0)
    const pctValuable = totalMinutesWeek > 0 ? Math.round((valuableMinutes / totalMinutesWeek) * 100) : null

    return { itemsWeek: weekLogs.length, totalMinutesWeek, valuableMinutes, junkMinutes, pctValuable }
  }, [logs])

  const dailyChartData = useMemo(() => {
    const buckets = {}
    const today = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = localDateStr(d)
      buckets[key] = { label: fmt(key), valioso: 0, raso: 0 }
    }
    for (const log of logs) {
      const key = dayOf(log)
      if (!buckets[key]) continue
      const minutes = log.duration_minutes ?? 0
      if (log.quality === 'valuable') buckets[key].valioso += minutes
      else if (log.quality === 'junk') buckets[key].raso += minutes
    }
    return Object.values(buckets)
  }, [logs])

  const byType = useMemo(() => {
    const totals = {}
    for (const log of logs) {
      const key = log.content_type ?? 'outro'
      totals[key] = (totals[key] ?? 0) + (log.duration_minutes ?? 0)
    }
    return Object.entries(totals)
      .map(([type, minutes]) => ({ type, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [logs])

  const maxTypeMinutes = Math.max(1, ...byType.map((t) => t.minutes))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Consumo de conteúdo</h1>
        <p className="text-sm text-slate-500">O que você andou assistindo, lendo e ouvindo.</p>
      </div>

      <form onSubmit={addLog} className="space-y-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (ex: nome do vídeo, livro, artigo)"
            className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Fonte (opcional)"
            className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Minutos"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {CONTENT_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setContentType(t.value)}
              className={`px-2.5 py-1 rounded-full text-xs border ${
                contentType === t.value ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-500'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => setQuality('valuable')}
            className={`flex-1 px-3 py-1.5 rounded-full border ${
              quality === 'valuable' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-300 text-slate-500'
            }`}
          >
            Valioso
          </button>
          <button
            type="button"
            onClick={() => setQuality('junk')}
            className={`flex-1 px-3 py-1.5 rounded-full border ${
              quality === 'junk' ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-300 text-slate-500'
            }`}
          >
            Raso
          </button>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
          Registrar
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : !stats ? (
        <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400">Itens (7 dias)</p>
              <p className="text-xl font-semibold text-slate-900">{stats.itemsWeek}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400">Minutos (7 dias)</p>
              <p className="text-xl font-semibold text-slate-900">{stats.totalMinutesWeek}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400">% valioso</p>
              <p className="text-xl font-semibold text-slate-900">{stats.pctValuable ?? '—'}%</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400">Raso vs valioso</p>
              <p className="text-sm font-semibold text-slate-900">
                {stats.junkMinutes}min <span className="text-slate-400">/</span> {stats.valuableMinutes}min
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Minutos por dia (últimas 2 semanas)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyChartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="valioso" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="raso" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Por tipo (últimos 90 dias)</p>
            <div className="space-y-2">
              {byType.map(({ type, minutes }) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-28 shrink-0">
                    {typeInfo(type).emoji} {typeInfo(type).label}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-700 rounded-full"
                      style={{ width: `${(minutes / maxTypeMinutes) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-14 text-right">{minutes}min</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Registros recentes</p>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
        ) : (
          <ul className="space-y-1 max-h-96 overflow-y-auto">
            {logs.slice(0, 40).map((log) => (
              <li
                key={log.id}
                className="text-xs text-slate-600 flex justify-between items-start bg-white border border-slate-200 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {typeInfo(log.content_type).emoji} {log.title}{' '}
                    <span className={log.quality === 'junk' ? 'text-amber-500' : 'text-emerald-500'}>
                      {log.quality === 'junk' ? '· raso' : '· valioso'}
                    </span>
                  </p>
                  <p className="text-slate-400">
                    {fmt(dayOf(log))}
                    {log.source ? ` · ${log.source}` : ''}
                    {log.duration_minutes ? ` · ${log.duration_minutes}min` : ''}
                  </p>
                  {log.note && <p className="text-slate-400">{log.note}</p>}
                </div>
                <button onClick={() => removeLog(log.id)} className="text-slate-300 hover:text-red-500 shrink-0 ml-2">
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
