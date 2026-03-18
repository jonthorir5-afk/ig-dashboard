import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Lock, Mail, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp, enterDemoMode } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (isSignUp) {
      const { error } = await signUp(email, password, { display_name: displayName })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Account created! Check your email to confirm, or sign in if email confirmation is disabled.')
        setIsSignUp(false)
      }
    } else {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="flex-center" style={{ marginBottom: '16px', color: 'var(--accent-primary)' }}>
            <Lock size={48} />
          </div>
          <h2 className="text-gradient" style={{ marginBottom: '8px' }}>Command Center</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isSignUp && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width: '100%', padding: '12px 12px 12px 36px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                style={{
                  width: '100%', padding: '12px 40px 12px 36px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: '0.875rem'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
          {success && <p style={{ color: 'var(--accent-success)', fontSize: '0.8rem', margin: 0 }}>{success}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '0.9rem' }}
          >
            {loading ? 'Please wait...' : (
              <>
                {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          </div>

          <button
            onClick={enterDemoMode}
            className="btn"
            style={{
              width: '100%', justifyContent: 'center', padding: '12px',
              fontSize: '0.875rem', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)', color: 'var(--text-primary)',
              cursor: 'pointer', borderRadius: '8px', marginBottom: '16px'
            }}
          >
            Try Demo with Sample Data
          </button>

          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}
