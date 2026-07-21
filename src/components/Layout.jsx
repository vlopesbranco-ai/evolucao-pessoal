import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, ListChecks, Heart, CalendarDays, Bookmark, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const links = [
  { to: '/', label: 'Painel', end: true, icon: Home },
  { to: '/habitos', label: 'Hábitos', icon: ListChecks },
  { to: '/casamento', label: 'Casamento', icon: Heart },
  { to: '/calendario', label: 'Agenda', icon: CalendarDays },
  { to: '/conteudo', label: 'Quero ver', icon: Bookmark },
]

export default function Layout() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const mainRef = useRef(null)

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      <header
        className="shrink-0 bg-white/95 backdrop-blur border-b border-slate-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <span className="font-semibold text-slate-900 tracking-tight">Evolução Pessoal</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-slate-800 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
              aria-label="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main ref={mainRef} className="safe-scroll flex-1 min-h-0 max-w-4xl w-full mx-auto px-4 py-5">
        <Outlet />
      </main>

      <nav
        className="shrink-0 bg-white/95 backdrop-blur border-t border-slate-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-4xl mx-auto grid grid-cols-5">
          {links.map((l) => {
            const Icon = l.icon
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors ${
                    isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                    <span className={isActive ? 'font-medium' : ''}>{l.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
