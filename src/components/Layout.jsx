import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  { to: '/', label: 'Painel', end: true },
  { to: '/habitos', label: 'Hábitos' },
  { to: '/dopamina', label: 'Dopamina' },
]

export default function Layout() {
  const { signOut, user } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-slate-900">Evolução Pessoal</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 hidden sm:inline">{user?.email}</span>
            <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-800">
              Sair
            </button>
          </div>
        </div>
        <nav className="max-w-4xl mx-auto px-4 flex gap-1 text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-2 border-b-2 ${
                  isActive
                    ? 'border-slate-900 text-slate-900 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
