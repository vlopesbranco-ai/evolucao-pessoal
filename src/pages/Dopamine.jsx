import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Dopamine() {
  const { user } = useAuth()
  const [triggers, setTriggers] = useState([])
  const [logs, setLogs] = useState([])
  const [newTrigger, setNewTrigger] = useState('')
  const [selectedTrigger, setSelectedTrigger] = useState('')
  const [intensity, setIntensity] = useState(3)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: triggerData } = await supabase
      .from('dopamine_triggers')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: true })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: logData } = await supabase
      .from('urge_logs')
      .select('*, dopamine_triggers(name)')
      .gte('occurred_at', sevenDaysAgo.toISOString())
      .order('occurred_at', { ascending: false })

    setTriggers(triggerData ?? [])
    setLogs(logData ?? [])
    if (!selectedTrigger && triggerData?.length) setSelectedTrigger(triggerData[0].id)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addTrigger(e) {
    e.preventDefault()
    if (!newTrigger.trim()) return
    await supabase.from('dopamine_triggers').insert({ user_id: user.id, name: newTrigger.trim() })
    setNewTrigger('')
    load()
  }

  async function logUrge(resisted) {
    if (!selectedTrigger) return
    await supabase.from('urge_logs').insert({
      user_id: user.id,
      trigger_id: selectedTrigger,
      resisted,
      intensity,
      note: note.trim() || null,
    })
    setNote('')
    load()
  }

  const resistedCount = logs.filter((l) => l.resisted).length
  const totalCount = logs.length
  const rate = totalCount ? Math.round((resistedCount / totalCount) * 100) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Dopamina fácil</h1>
        <p className="text-sm text-slate-500">Registre o impulso assim que ele aparecer.</p>
      </div>

      <form onSubmit={addTrigger} className="flex gap-2 bg-white border border-slate-200 rounded-xl p-3">
        <input
          value={newTrigger}
          onChange={(e) => setNewTrigger(e.target.value)}
          placeholder="Novo gatilho (ex: Instagram, doces)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">
          Adicionar
        </button>
      </form>

      {triggers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {triggers.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrigger(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs border ${
                  selectedTrigger === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-500">Intensidade da vontade</label>
            <input
              type="range"
              min={1}
              max={5}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-40"
            />
            <span className="text-xs text-slate-600">{intensity}/5</span>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => logUrge(true)}
              className="flex-1 rounded-lg bg-emerald-500 text-white py-2 text-sm font-medium hover:bg-emerald-600"
            >
              Resisti
            </button>
            <button
              onClick={() => logUrge(false)}
              className="flex-1 rounded-lg bg-red-500 text-white py-2 text-sm font-medium hover:bg-red-600"
            >
              Cedi
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-slate-700 mb-2">Últimos 7 dias</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : totalCount === 0 ? (
          <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-2">
              Taxa de resistência: <span className="font-semibold">{rate}%</span> ({resistedCount}/{totalCount})
            </p>
            <ul className="space-y-1">
              {logs.slice(0, 15).map((l) => (
                <li key={l.id} className="text-xs text-slate-500 flex justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <span>
                    {l.resisted ? '✅' : '⚠️'} {l.dopamine_triggers?.name ?? 'gatilho'} · intensidade {l.intensity}
                  </span>
                  <span>{new Date(l.occurred_at).toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
