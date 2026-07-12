import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Habits from './pages/Habits'
import Marriage from './pages/Marriage'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? null : user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="habitos" element={<Habits />} />
        <Route path="casamento" element={<Marriage />} />
        <Route path="dopamina" element={<Navigate to="/habitos" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
