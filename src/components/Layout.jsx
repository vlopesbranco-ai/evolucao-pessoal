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
        className="shrink-0 bg-white border-b border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center text-xs font-semibold">
              E
            </span>
            <span className="font-semibold text-slate-900 tracking-tight">Evolução Pessoal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-slate-800 active:bg-slate-100 transition-colors p-2 rounded-lg hover:bg-slate-100"
              aria-label="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main ref={mainRef} className="safe-scroll flex-1 min-h-0 max-w-4xl w-full mx-auto px-4 py-5">
        <Outlet />
      </main>

      <nav
        className="shrink-0 bg-white border-t border-slate-200 shadow-[0_-1px_3px_rgba(15,23,42,0.05)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-4xl mx-auto grid grid-cols-5 px-1">
          {links.map((l) => {
            const Icon = l.icon
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className="flex items-center justify-center py-1.5"
              >
                {({ isActive }) => (
                  <span
                    className={`w-full flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[11px] transition-colors ${
                      isActive ? 'bg-brand-50 text-brand-600' : 'text-slate-400 active:bg-slate-100'
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                    <span className={isActive ? 'font-medium' : ''}>{l.label}</span>
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
