import { Link, useNavigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { FlaskConical } from 'lucide-react'

interface NavBarProps {
  session: Session | null
}

export default function NavBar({ session }: NavBarProps) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <FlaskConical className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-semibold text-gray-900">Metis</span>
            </Link>
            <span className="ml-4 text-sm text-gray-500">MedEd Platform</span>
          </div>

          {/* Auth section */}
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <span className="text-sm text-gray-600">
                  {session.user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
