import { useState } from 'react'
import { supabase } from '../../supabaseClient.js'
import { THEMES, applyTheme, useSettings } from '../../lib/settings.jsx'

async function saveSetting(key, value) {
  const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}

export default function AppearancePage() {
  const { settings, setSetting } = useSettings()
  const [savingTheme, setSavingTheme] = useState(false)
  const [themeError, setThemeError] = useState('')

  const [bgInput, setBgInput] = useState(settings.bg_image_url || '')
  const [savingBg, setSavingBg] = useState(false)
  const [bgError, setBgError] = useState('')
  const [bgNote, setBgNote] = useState('')

  async function chooseTheme(preset) {
    if (preset === settings.theme_preset) return
    setThemeError('')
    setSavingTheme(true)
    try {
      await saveSetting('theme_preset', preset)
      setSetting('theme_preset', preset)
      applyTheme(preset)
    } catch (err) {
      setThemeError(`儲存失敗：${err.message}`)
    } finally {
      setSavingTheme(false)
    }
  }

  async function saveBg() {
    setSavingBg(true)
    setBgError('')
    setBgNote('')
    try {
      await saveSetting('bg_image_url', bgInput.trim())
      setSetting('bg_image_url', bgInput.trim())
      setBgNote('已儲存')
    } catch (err) {
      setBgError(`儲存失敗：${err.message}`)
    } finally {
      setSavingBg(false)
    }
  }

  async function clearBg() {
    setBgInput('')
    setSavingBg(true)
    try {
      await saveSetting('bg_image_url', '')
      setSetting('bg_image_url', '')
      setBgNote('已恢復預設（無背景圖）')
    } catch (err) {
      setBgError(`儲存失敗：${err.message}`)
    } finally {
      setSavingBg(false)
    }
  }

  return (
    <div className="paper section">
      <h2>外觀設定</h2>
      <p className="muted">調整學生首頁看到的主題色跟背景，設定後會立即套用。</p>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: '1rem' }}>主題色</h3>
        <p className="muted" style={{ marginTop: 0 }}>影響按鈕、連結、選中題目的邊框顏色。</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {Object.entries(THEMES).map(([preset, theme]) => {
            const active = settings.theme_preset === preset
            return (
              <button
                key={preset}
                type="button"
                disabled={savingTheme}
                onClick={() => chooseTheme(preset)}
                className={active ? '' : 'secondary'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: theme.accent,
                    border: '1px solid rgba(0,0,0,0.15)',
                    flexShrink: 0,
                  }}
                />
                {theme.label}{active ? '（使用中）' : ''}
              </button>
            )
          })}
        </div>
        {themeError && <p className="error-text">{themeError}</p>}
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: '1rem' }}>首頁背景圖片</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          貼上圖片網址即可（例如放在 Google Drive、Imgur 等地方的公開圖片連結）。建議選擇畫面偏亮、線條乾淨的圖片，
          我們會自動加上一層淡淡的紙色漸層，確保文字仍然清楚好讀，維持測驗該有的正式感。留空則使用預設的素色紙張背景。
        </p>
        <div className="field">
          <label>圖片網址</label>
          <input
            type="url"
            value={bgInput}
            onChange={(e) => setBgInput(e.target.value)}
            placeholder="https://..."
          />
        </div>
        {bgInput && (
          <div
            style={{
              width: '100%',
              aspectRatio: '16/6',
              backgroundImage: `url("${bgInput}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid var(--rule)',
              marginBottom: 12,
            }}
          />
        )}
        {bgError && <p className="error-text">{bgError}</p>}
        {bgNote && <p style={{ color: 'var(--pass)', fontSize: '0.9rem' }}>{bgNote}</p>}
        <button onClick={saveBg} disabled={savingBg}>{savingBg ? '儲存中...' : '儲存背景'}</button>{' '}
        <button className="ghost" onClick={clearBg} disabled={savingBg || !settings.bg_image_url}>恢復預設</button>
      </div>
    </div>
  )
}
