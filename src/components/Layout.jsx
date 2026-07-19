import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  { to: '/', label: 'Painel', end: true },
  { to: '/habitos', label: 'Hábitos' },
  { to: '/casamento', label: 'Casamento' },
  { to: '/calendario', label: 'Calendário' },
  { to: '/conteudo', label: 'Quero ver' },
]

export default function Layout() {
  const { signOut, user } = useAuth()

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header
        className="shrink-0 border-b border-slate-200 bg-white"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-slate-900">Evolução Pessoal</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 hidden sm:inline">{user?.email}</span>
            <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-800">
              Sair
            </button>
          </div>
        </div>
        <nav className="max-w-4xl mx-auto px-4 flex gap-1 text-sm overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-2 border-b-2 whitespace-nowrap ${
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
      <main
        className="safe-scroll flex-1 max-w-4xl w-full mx-auto px-4 py-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <Outlet />
      </main>
    </div>
  )
}
