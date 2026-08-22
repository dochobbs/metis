import { Navigate, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase, isAuthRequired, isSupabaseConfigured } from './lib/supabase'
import NavBar from './components/NavBar'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ToolEmbed from './pages/ToolEmbed'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    // Skip auth if Supabase isn't configured
    if (!isSupabaseConfigured()) {
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const authRequired = isAuthRequired()
  const renderDashboard = () => {
    if (authRequired && !session) {
      return <Navigate to="/login" replace />
    }

    return <Dashboard session={session} />
  }

  const renderToolEmbed = () => {
    if (authRequired && !session) {
      return <Navigate to="/login" replace />
    }

    return <ToolEmbed session={session} />
  }

  return (
    <div className="min-h-screen">
      <NavBar session={session} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={renderDashboard()} />
          <Route path="/login" element={<Login />} />
          <Route path="/tool/:toolId" element={renderToolEmbed()} />
        </Routes>
      </main>
    </div>
  )
}

export default App
