import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { todayStr } from '../lib/date'

const QUEUE_CATEGORIES = [
  { value: 'filme', label: 'Filme', emoji: '🎬' },
  { value: 'serie', label: 'Série', emoji: '📺' },
  { value: 'documentario', label: 'Documentário', emoji: '🎥' },
  { value: 'livro', label: 'Livro', emoji: '📚' },
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

function categoryInfo(value) {
  return QUEUE_CATEGORIES.find((c) => c.value === value) ?? QUEUE_CATEGORIES[QUEUE_CATEGORIES.length - 1]
}

export default function Watchlist() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWatched, setShowWatched] = useState(false)

  const [tab, setTab] = useState('fila') // 'fila' | 'podcasts'

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('filme')
  const [note, setNote] = useState('')

  const [podcastTitle, setPodcastTitle] = useState('')
  const [podcastWeekday, setPodcastWeekday] = useState(5)
  const [podcastNote, setPodcastNote] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('watchlist_items').select('*').order('created_at', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addQueueItem(e) {
    e.preventDefault()
    if (!title.trim()) return
    await supabase.from('watchlist_items').insert({
      user_id: user.id,
      title: title.trim(),
      category,
      note: note.trim() || null,
    })
    setTitle('')
    setNote('')
    load()
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
    load()
  }

  async function toggleWatched(item) {
    await supabase
      .from('watchlist_items')
      .update({ watched: !item.watched, watched_at: !item.watched ? todayStr() : null })
      .eq('id', item.id)
    load()
  }

  async function removeItem(id) {
    await supabase.from('watchlist_items').delete().eq('id', id)
    load()
  }

  const queueItems = useMemo(
    () => items.filter((i) => i.category !== 'podcast' && (showWatched || !i.watched)),
    [items, showWatched]
  )
  const podcasts = useMemo(() => items.filter((i) => i.category === 'podcast'), [items])

  const todayWeekday = new Date().getDay()
  const releasingToday = podcasts.filter((p) => p.release_weekday === todayWeekday)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Quero assistir / ouvir</h1>
        <p className="text-sm text-slate-500">Fila de filmes, séries e documentários, e seus podcasts favoritos.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 text-sm">
        <button
          onClick={() => setTab('fila')}
          className={`px-3 py-2 border-b-2 ${
            tab === 'fila' ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500'
          }`}
        >
          Fila
        </button>
        <button
          onClick={() => setTab('podcasts')}
          className={`px-3 py-2 border-b-2 ${
            tab === 'podcasts' ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500'
          }`}
        >
          Podcasts
        </button>
      </div>

      {tab === 'fila' && (
        <div className="space-y-4">
          <form onSubmit={addQueueItem} className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do filme, série, documentário, livro..."
                className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Onde assistir / nota (opcional)"
                className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {QUEUE_CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${
                    category === c.value ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-500'
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

          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : queueItems.length === 0 ? (
            <p className="text-sm text-slate-400">Nada na fila. Adicione algo acima.</p>
          ) : (
            <ul className="space-y-2">
              {queueItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3"
                >
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
                        {categoryInfo(item.category).emoji} {item.title}
                      </p>
                      {item.note && <p className="text-xs text-slate-400">{item.note}</p>}
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-xs text-slate-300 hover:text-red-500">
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'podcasts' && (
        <div className="space-y-4">
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

          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : podcasts.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum podcast cadastrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {[...podcasts]
                .sort((a, b) => a.release_weekday - b.release_weekday)
                .map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">🎧 {p.title}</p>
                      <p className="text-xs text-slate-400">
                        Lança toda {WEEKDAYS.find((d) => d.value === p.release_weekday)?.label}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <button onClick={() => removeItem(p.id)} className="text-xs text-slate-300 hover:text-red-500">
                      remover
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
