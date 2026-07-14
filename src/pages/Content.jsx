import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { todayStr, localDateStr } from '../lib/date'

const CONTENT_TYPES = [
  { value: 'filme', label: 'Filme', emoji: '🎬' },
  { value: 'serie', label: 'Série', emoji: '📺' },
  { value: 'documentario', label: 'Documentário', emoji: '🎥' },
  { value: 'video', label: 'Vídeo', emoji: '▶️' },
  { value: 'audiobook', label: 'Audiobook', emoji: '🎧' },
  { value: 'livro', label: 'Livro', emoji: '📚' },
  { value: 'podcast', label: 'Podcast', emoji: '🎙️' },
  { value: 'rede_social', label: 'Rede social', emoji: '📱' },
  { value: 'artigo', label: 'Artigo', emoji: '📰' },
  { value: 'curso', label: 'Curso', emoji: '🎓' },
  { value: 'noticias', label: 'Notícias', emoji: '🗞️' },
  { value: 'outro', label: 'Outro', emoji: '📌' },
]

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
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

  // ---- consumo (já assistido/lido/ouvido) ----
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [date, setDate] = useState(todayStr())
  const [contentType, setContentType] = useState('filme')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [duration, setDuration] = useState('')
  const [note, setNote] = useState('')

  // ---- fila (quero ver/ouvir/ler) + podcasts ----
  const [watchlist, setWatchlist] = useState([])
  const [loadingWatchlist, setLoadingWatchlist] = useState(true)
  const [showWatched, setShowWatched] = useState(false)
  const [queueTitle, setQueueTitle] = useState('')
  const [queueCategory, setQueueCategory] = useState('filme')
  const [queueNote, setQueueNote] = useState('')
  const [podcastTitle, setPodcastTitle] = useState('')
  const [podcastWeekday, setPodcastWeekday] = useState(5)
  const [podcastNote, setPodcastNote] = useState('')

  async function loadLogs() {
    setLoadingLogs(true)
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const { data } = await supabase
      .from('content_logs')
      .select('*')
      .gte('consumed_at', toTimestamp(localDateStr(since)))
      .order('consumed_at', { ascending: false })
    setLogs(data ?? [])
    setLoadingLogs(false)
  }

  async function loadWatchlist() {
    setLoadingWatchlist(true)
    const { data } = await supabase.from('watchlist_items').select('*').order('created_at', { ascending: true })
    setWatchlist(data ?? [])
    setLoadingWatchlist(false)
  }

  useEffect(() => {
    loadLogs()
    loadWatchlist()
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
      consumed_at: toTimestamp(date),
      note: note.trim() || null,
    })
    setTitle('')
    setSource('')
    setDuration('')
    setNote('')
    loadLogs()
  }

  async function removeLog(id) {
    await supabase.from('content_logs').delete().eq('id', id)
    loadLogs()
  }

  async function addQueueItem(e) {
    e.preventDefault()
    if (!queueTitle.trim()) return
    await supabase.from('watchlist_items').insert({
      user_id: user.id,
      title: queueTitle.trim(),
      category: queueCategory,
      note: queueNote.trim() || null,
    })
    setQueueTitle('')
    setQueueNote('')
    loadWatchlist()
  }

  async function addPodcast(e) {
    e.preventDefault()
    if (!podcastTitle.trim()) return
    await supabase.from('watchlist_items').insert({
      user_id: user.id,
      title: podcastTitle.trim(),
      category: 'podcast',
      release_weekday: podcastWeekday,
      note: podcastNote.trim() || null,
    })
    setPodcastTitle('')
    setPodcastNote('')
    loadWatchlist()
  }

  async function toggleWatched(item) {
    await supabase
      .from('watchlist_items')
      .update({ watched: !item.watched, watched_at: !item.watched ? todayStr() : null })
      .eq('id', item.id)
    loadWatchlist()
  }

  async function removeWatchlistItem(id) {
    await supabase.from('watchlist_items').delete().eq('id', id)
    loadWatchlist()
  }

  const dayOf = (log) => localDateStr(new Date(log.consumed_at))

  const stats = useMemo(() => {
    if (logs.length === 0) return null
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = localDateStr(weekAgo)
    const weekLogs = logs.filter((l) => dayOf(l) >= weekAgoStr)
    const totalMinutesWeek = weekLogs.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0)
    return { itemsWeek: weekLogs.length, totalMinutesWeek }
  }, [logs])

  const dailyChartData = useMemo(() => {
    const buckets = {}
    const today = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = localDateStr(d)
      buckets[key] = { label: fmt(key), minutos: 0 }
    }
    for (const log of logs) {
      const key = dayOf(log)
      if (!buckets[key]) continue
      buckets[key].minutos += log.duration_minutes ?? 0
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

  const queueItems = useMemo(
    () => watchlist.filter((i) => i.category !== 'podcast' && (showWatched || !i.watched)),
    [watchlist, showWatched]
  )
  const podcasts = useMemo(() => watchlist.filter((i) => i.category === 'podcast'), [watchlist])
  const todayWeekday = new Date().getDay()
  const releasingToday = podcasts.filter((p) => p.release_weekday === todayWeekday)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Conteúdo</h1>
        <p className="text-sm text-slate-500">O que você consome, o que quer consumir, e seus podcasts.</p>
      </div>

      {/* ---------- Registrar consumo ---------- */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-slate-700">Registrar consumo</h2>
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
              placeholder="Título"
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

        {!loadingLogs && stats && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-xs text-slate-400">Itens (7 dias)</p>
                <p className="text-xl font-semibold text-slate-900">{stats.itemsWeek}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-xs text-slate-400">Minutos (7 dias)</p>
                <p className="text-xl font-semibold text-slate-900">{stats.totalMinutesWeek}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Minutos por dia (últimas 2 semanas)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyChartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="minutos" fill="#0f172a" radius={[4, 4, 0, 0]} />
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
                      <div className="h-full bg-slate-700 rounded-full" style={{ width: `${(minutes / maxTypeMinutes) * 100}%` }} />
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
            <ul className="space-y-1 max-h-72 overflow-y-auto">
              {logs.slice(0, 40).map((log) => (
                <li key={log.id} className="text-xs text-slate-600 flex justify-between items-start bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-800">
                      {typeInfo(log.content_type).emoji} {log.title}
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
      </section>

      {/* ---------- Fila: quero ver/ler ---------- */}
      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h2 className="text-sm font-medium text-slate-700">Quero ver / ler</h2>
        <form onSubmit={addQueueItem} className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={queueTitle}
              onChange={(e) => setQueueTitle(e.target.value)}
              placeholder="Nome do filme, série, livro..."
              className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={queueNote}
              onChange={(e) => setQueueNote(e.target.value)}
              placeholder="Onde assistir / nota (opcional)"
              className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {CONTENT_TYPES.filter((t) => t.value !== 'podcast').map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => setQueueCategory(c.value)}
                className={`px-2.5 py-1 rounded-full text-xs border ${
                  queueCategory === c.value ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-500'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
            Adicionar à fila
          </button>
        </form>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={showWatched} onChange={(e) => setShowWatched(e.target.checked)} />
          Mostrar já vistos/lidos
        </label>

        {loadingWatchlist ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : queueItems.length === 0 ? (
          <p className="text-sm text-slate-400">Nada na fila.</p>
        ) : (
          <ul className="space-y-2">
            {queueItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleWatched(item)}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0 ${
                      item.watched ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-slate-400'
                    }`}
                  >
                    ✓
                  </button>
                  <div>
                    <p className={`text-sm font-medium ${item.watched ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {typeInfo(item.category).emoji} {item.title}
                    </p>
                    {item.note && <p className="text-xs text-slate-400">{item.note}</p>}
                  </div>
                </div>
                <button onClick={() => removeWatchlistItem(item.id)} className="text-xs text-slate-300 hover:text-red-500">
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Podcasts ---------- */}
      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h2 className="text-sm font-medium text-slate-700">Podcasts</h2>
        <form onSubmit={addPodcast} className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={podcastTitle}
              onChange={(e) => setPodcastTitle(e.target.value)}
              placeholder="Nome do podcast"
              className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={podcastWeekday}
              onChange={(e) => setPodcastWeekday(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <input
            value={podcastNote}
            onChange={(e) => setPodcastNote(e.target.value)}
            placeholder="Nota (opcional, ex: onde ouvir)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
            Adicionar podcast
          </button>
        </form>

        {releasingToday.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
            🎧 Hoje tem episódio novo de: {releasingToday.map((p) => p.title).join(', ')}
          </div>
        )}

        {loadingWatchlist ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : podcasts.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum podcast cadastrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {[...podcasts]
              .sort((a, b) => a.release_weekday - b.release_weekday)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">🎙️ {p.title}</p>
                    <p className="text-xs text-slate-400">
                      Lança toda {WEEKDAYS.find((d) => d.value === p.release_weekday)?.label}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <button onClick={() => removeWatchlistItem(p.id)} className="text-xs text-slate-300 hover:text-red-500">
                    remover
                  </button>
                </li>
              ))}
          </ul>
        )}
        <p className="text-xs text-slate-400">Esses lançamentos também aparecem no Calendário.</p>
      </section>
    </div>
  )
}
