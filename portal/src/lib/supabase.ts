import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseAnonKey !== ''
}

export const isAuthRequired = () => {
  return import.meta.env.VITE_REQUIRE_AUTH === 'true' || isSupabaseConfigured()
}

// Create a mock client if not configured to prevent crashes
const createSupabaseClient = (): SupabaseClient => {
  if (isSupabaseConfigured()) {
    return createClient(supabaseUrl, supabaseAnonKey)
  }
  // Return a minimal mock that won't crash
  return createClient('https://placeholder.supabase.co', 'placeholder-key')
}

export const supabase = createSupabaseClient()
