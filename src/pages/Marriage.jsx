import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

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

export default function Marriage() {
  const { user } = useAuth()
  const [intimacyLogs, setIntimacyLogs] = useState([])
  const [cycleLogs, setCycleLogs] = useState([])
  const [intimacyNote, setIntimacyNote] = useState('')
  const [intimacyDate, setIntimacyDate] = useState(todayStr())
  const [usedProtection, setUsedProtection] = useState(true)
  const [cycleDate, setCycleDate] = useState(todayStr())
  const [cycleSymptoms, setCycleSymptoms] = useState('')
  const [cycleNote, setCycleNote] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: intimacy } = await supabase
      .from('intimacy_logs')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(30)

    const { data: cycles } = await supabase
      .from('cycle_logs')
      .select('*')
      .order('cycle_start', { ascending: false })
      .limit(12)

    setIntimacyLogs(intimacy ?? [])
    setCycleLogs(cycles ?? [])
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

  // Estimativa de duração média do ciclo e próxima janela fértil
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Casamento</h1>
        <p className="text-sm text-slate-500">Registro manual e privado — só você alimenta esses dados.</p>
      </div>

      {cycleLogs.length >= 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400">Estimativa (baseada nos últimos ciclos)</p>
          <p className="text-sm text-slate-700">
            Duração média do ciclo: <span className="font-semibold">{avgCycleLength} dias</span>
          </p>
          <p className="text-sm text-slate-700">
            Próximo ciclo previsto: <span className="font-semibold">{fmt(predictedNext)}</span>
          </p>
          <p className="text-sm text-slate-700">
            Janela fértil estimada:{' '}
            <span className="font-semibold">
              {fmt(fertileWindow.start)} a {fmt(fertileWindow.end)}
            </span>
          </p>
          <p className="text-xs text-slate-400 mt-1">Estimativa aproximada, não é método contraceptivo.</p>
        </div>
      )}

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
                  usedProtection
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                Com proteção
              </button>
              <button
                type="button"
                onClick={() => setUsedProtection(false)}
                className={`flex-1 px-3 py-1.5 rounded-full border ${
                  !usedProtection
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-slate-300 text-slate-500'
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
            <ul className="space-y-1">
              {intimacyLogs.map((i) => (
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
    </div>
  )
}
