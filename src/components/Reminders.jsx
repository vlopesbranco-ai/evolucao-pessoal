import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  pushSupported,
  isIOS,
  isStandalone,
  getSubscription,
  enablePush,
  disablePush,
  showTestNotification,
} from '../lib/push'

const RECURRENCE_LABELS = { none: 'uma vez', daily: 'todo dia', weekly: 'toda semana', monthly: 'todo mês' }

function defaultWhen() {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtWhen(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function Reminders() {
  const { user } = useAuth()
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState(defaultWhen())
  const [recurrence, setRecurrence] = useState('none')
  const [pushOn, setPushOn] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase.from('reminders').select('*').order('remind_at', { ascending: true })
    setReminders(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    getSubscription()
      .then((s) => setPushOn(!!s && Notification.permission === 'granted'))
      .catch(() => {})
  }, [])

  async function addReminder(e) {
    e.preventDefault()
    if (!title.trim() || !when) return
    await supabase.from('reminders').insert({
      user_id: user.id,
      title: title.trim(),
      remind_at: new Date(when).toISOString(),
      recurrence,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    })
    setTitle('')
    setWhen(defaultWhen())
    setRecurrence('none')
    load()
  }

  async function removeReminder(id) {
    await supabase.from('reminders').delete().eq('id', id)
    load()
  }

  async function togglePush() {
    setBusy(true)
    setPushMsg('')
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        await enablePush(user.id)
        setPushOn(true)
      }
    } catch (err) {
      setPushMsg(err.message || 'Não foi possível ativar as notificações.')
    }
    setBusy(false)
  }

  const supported = pushSupported()
  const needsInstall = isIOS() && !isStandalone()
  const upcoming = reminders.filter((r) => r.active)
  const past = reminders.filter((r) => !r.active)

  return (
    <div className="bg-white border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Lembretes</p>

      <div className="border border-slate-200 p-3 space-y-2">
        {needsInstall ? (
          <p className="text-xs text-amber-700">
            No iPhone, as notificações só funcionam com o app instalado: toque em Compartilhar, depois em
            "Adicionar à Tela de Início", e abra o app por esse ícone.
          </p>
        ) : !supported ? (
          <p className="text-xs text-slate-500">Este navegador não suporta notificações push.</p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Notificações neste aparelho:{' '}
              <span className={pushOn ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                {pushOn ? 'ativas' : 'desativadas'}
              </span>
            </p>
            <div className="flex gap-2 shrink-0">
              {pushOn && (
                <button
                  type="button"
                  onClick={() => showTestNotification().catch(() => {})}
                  className="text-xs border border-slate-300 text-slate-600 px-2 py-1 hover:bg-slate-50"
                >
                  Testar
                </button>
              )}
              <button
                type="button"
                onClick={togglePush}
                disabled={busy}
                className={`text-xs px-3 py-1 font-medium ${
                  pushOn ? 'border border-slate-300 text-slate-600' : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {pushOn ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        )}
        {pushMsg && <p className="text-xs text-red-600">{pushMsg}</p>}
      </div>

      <form onSubmit={addReminder} className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lembrar de... (ex: ligar pro dentista)"
          className="w-full border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full min-w-0 border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value)}
          className="w-full border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {k === 'none' ? 'Não repetir' : `Repetir ${v}`}
            </option>
          ))}
        </select>
        <button className="w-full bg-brand-600 text-white py-2 text-sm font-medium hover:bg-brand-700">
          Adicionar lembrete
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-slate-400">Carregando...</p>
      ) : reminders.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum lembrete ainda.</p>
      ) : (
        <ul className="space-y-1">
          {[...upcoming, ...past].map((r) => (
            <li
              key={r.id}
              className={`flex items-start justify-between gap-2 text-xs border border-slate-200 px-3 py-2 ${
                r.active ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{r.title}</p>
                <p className="text-slate-400">
                  {r.active ? fmtWhen(r.remind_at) : `enviado em ${fmtWhen(r.last_sent_at ?? r.remind_at)}`}
                  {r.recurrence !== 'none' && ` · ${RECURRENCE_LABELS[r.recurrence]}`}
                </p>
              </div>
              <button onClick={() => removeReminder(r.id)} className="text-slate-300 hover:text-red-500 shrink-0">
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
