import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isDemoMode, enableDemoMode, disableDemoMode, mockDemoUser, mockDemoProfile } from '../lib/mockData'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    // If demo mode is active, skip Supabase auth
    if (isDemoMode()) {
      setUser(mockDemoUser)
      setProfile(mockDemoProfile)
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    let subscription
    try {
      const result = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      })
      subscription = result.data.subscription
    } catch {
      setLoading(false)
    }

    return () => subscription?.unsubscribe()
  }, [])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password, metadata = {}) =>
    supabase.auth.signUp({ email, password, options: { data: metadata } })

  const enterDemoMode = () => {
    enableDemoMode()
    setUser(mockDemoUser)
    setProfile(mockDemoProfile)
  }

  const signOut = () => {
    if (isDemoMode()) {
      disableDemoMode()
      setUser(null)
      setProfile(null)
      return
    }
    return supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const canManage = isAdmin || isManager

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signUp, signOut, enterDemoMode,
      isAdmin, isManager, canManage
    }}>
      {children}
    </AuthContext.Provider>
  )
}
