import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // login | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetState, setResetState] = useState({ status: 'idle', text: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/admin/assignments')
    })
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError('登入失敗，請確認帳號密碼是否正確。')
      return
    }
    navigate('/admin/assignments')
  }

  function openReset() {
    setResetEmail(email)
    setResetState({ status: 'idle', text: '' })
    setMode('reset')
  }

  async function handleReset(e) {
    e.preventDefault()
    setResetState({ status: 'sending', text: '' })
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/admin/login`,
    })
    if (err) {
      setResetState({ status: 'failed', text: `寄送失敗：${err.message || '請稍後再試'}` })
    } else {
      setResetState({ status: 'sent', text: '重設信已寄出，請至信箱查看' })
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <div className="paper">
        <div className="masthead">
          <h1>{mode === 'login' ? '教師後台登入' : '忘記密碼'}</h1>
        </div>
        {mode === 'login' ? (
          <form className="section" onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>密碼</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button
                type="button"
                className="ghost"
                style={{ padding: '2px 0', fontSize: '0.82rem', marginTop: 6 }}
                onClick={openReset}
              >
                忘記密碼？
              </button>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? '登入中...' : '登入'}
            </button>
            <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/">回學生首頁</Link>
            </p>
          </form>
        ) : (
          <form className="section" onSubmit={handleReset}>
            <p className="muted" style={{ marginTop: 0 }}>輸入登入用的 Email，我們會寄一封重設密碼的信給你。</p>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            {resetState.text && (
              <p style={{ color: resetState.status === 'sent' ? 'var(--pass)' : 'var(--danger)', fontSize: '0.9rem' }}>
                {resetState.text}
              </p>
            )}
            <button type="submit" disabled={resetState.status === 'sending' || !resetEmail.trim()} style={{ width: '100%' }}>
              {resetState.status === 'sending' ? '寄送中...' : '寄送重設信'}
            </button>
            <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" className="ghost" onClick={() => setMode('login')}>返回登入</button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
