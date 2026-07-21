import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { todayStr } from '../lib/date'

// Categorias selecionáveis no formulário (reduzidas a pedido)
const CONTENT_TYPES = [
  { value: 'filme', label: 'Filme', emoji: '🎬' },
  { value: 'serie', label: 'Série', emoji: '📺' },
  { value: 'livro', label: 'Livro', emoji: '📚' },
  { value: 'audiobook', label: 'Audiobook', emoji: '🎧' },
]

// Mantém o mapeamento de categorias antigas só pra exibir itens já cadastrados antes da mudança
const LEGACY_CONTENT_TYPES = [
  { value: 'documentario', label: 'Documentário', emoji: '🎥' },
  { value: 'video', label: 'Vídeo', emoji: '▶️' },
  { value: 'rede_social', label: 'Rede social', emoji: '📱' },
  { value: 'artigo', label: 'Artigo', emoji: '📰' },
  { value: 'curso', label: 'Curso', emoji: '🎓' },
  { value: 'noticias', label: 'Notícias', emoji: '🗞️' },
  { value: 'outro', label: 'Outro', emoji: '📌' },
]

const ALL_CONTENT_TYPES = [...CONTENT_TYPES, ...LEGACY_CONTENT_TYPES]

const GENRES = [
  { value: 'acao', label: 'Ação' },
  { value: 'aventura', label: 'Aventura' },
  { value: 'comedia', label: 'Comédia' },
  { value: 'drama', label: 'Drama' },
  { value: 'terror', label: 'Terror' },
  { value: 'suspense', label: 'Suspense' },
  { value: 'romance', label: 'Romance' },
  { value: 'ficcao_cientifica', label: 'Ficção científica' },
  { value: 'fantasia', label: 'Fantasia' },
  { value: 'documentario', label: 'Documentário' },
  { value: 'animacao', label: 'Animação' },
  { value: 'familia', label: 'Família' },
  { value: 'crime', label: 'Crime/Policial' },
  { value: 'biografia', label: 'Biografia' },
  { value: 'outro', label: 'Outro' },
]

function genreLabel(value) {
  return GENRES.find((g) => g.value === value)?.label ?? null
}

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
  return ALL_CONTENT_TYPES.find((t) => t.value === value) ?? { value, label: 'Outro', emoji: '📌' }
}

export default function Content() {
  const { user } = useAuth()

  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWatched, setShowWatched] = useState(false)
  const [suggestion, setSuggestion] = useState(null)

  const [queueTitle, setQueueTitle] = useState('')
  const [queueCategory, setQueueCategory] = useState('filme')
  const [queueGenre, setQueueGenre] = useState('')
  const [queueNote, setQueueNote] = useState('')

  const [podcastTitle, setPodcastTitle] = useState('')
  const [podcastWeekday, setPodcastWeekday] = useState(5)
  const [podcastNote, setPodcastNote] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('watchlist_items').select('*').order('created_at', { ascending: true })
    setWatchlist(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addQueueItem(e) {
    e.preventDefault()
    if (!queueTitle.trim()) return
    await supabase.from('watchlist_items').insert({
      user_id: user.id,
      title: queueTitle.trim(),
      category: queueCategory,
      genre: queueGenre || null,
      note: queueNote.trim() || null,
    })
    setQueueTitle('')
    setQueueGenre('')
    setQueueNote('')
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

  async function removeWatchlistItem(id) {
    await supabase.from('watchlist_items').delete().eq('id', id)
    load()
  }

  const queueItems = useMemo(
    () => watchlist.filter((i) => i.category !== 'podcast' && (showWatched || !i.watched)),
    [watchlist, showWatched]
  )
  const podcasts = useMemo(() => watchlist.filter((i) => i.category === 'podcast'), [watchlist])
  const todayWeekday = new Date().getDay()
  const releasingToday = podcasts.filter((p) => p.release_weekday === todayWeekday)

  function pickSuggestion() {
    const pending = watchlist.filter((i) => i.category !== 'podcast' && !i.watched)
    if (pending.length === 0) {
      setSuggestion(null)
      return
    }
    setSuggestion(pending[Math.floor(Math.random() * pending.length)])
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Quero ver / ler</h1>
        <p className="text-sm text-slate-500">Sua fila de filmes, séries, livros e afins, e seus podcasts.</p>
      </div>

      {/* ---------- Fila: quero ver/ler ---------- */}
      <section className="space-y-3">
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
          <div className="flex gap-2">
            <select
              value={queueCategory}
              onChange={(e) => setQueueCategory(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {CONTENT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
            <select
              value={queueGenre}
              onChange={(e) => setQueueGenre(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Sem gênero</option>
              {GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <button className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800">
            Adicionar à fila
          </button>
        </form>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={showWatched} onChange={(e) => setShowWatched(e.target.checked)} />
            Mostrar já vistos/lidos
          </label>
          <button
            onClick={pickSuggestion}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-300 text-slate-600 hover:border-slate-400"
          >
            🎲 Sugerir algo
          </button>
        </div>

        {suggestion && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-700">
            {typeInfo(suggestion.category).emoji} Que tal: <span className="font-medium">{suggestion.title}</span>
            {suggestion.genre && ` (${genreLabel(suggestion.genre)})`}?
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : queueItems.length === 0 ? (
          <p className="text-sm text-slate-400">Nada na fila. Adicione algo acima.</p>
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
                      {item.genre && <span className="text-xs font-normal text-slate-400"> · {genreLabel(item.genre)}</span>}
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

        {loading ? (
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
