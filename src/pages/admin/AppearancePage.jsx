import { useRef, useState } from 'react'
import { supabase } from '../../supabaseClient.js'
import { BACKGROUND_BUCKET, removeByUrl, uploadImage } from '../../lib/storage.js'
import { THEMES, applyTheme, useSettings } from '../../lib/settings.jsx'

async function saveSetting(key, value) {
  const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}

export default function AppearancePage() {
  const { settings, setSetting } = useSettings()
  const [savingTheme, setSavingTheme] = useState(false)
  const [themeError, setThemeError] = useState('')

  const fileInput = useRef(null)
  const [uploading, setUploading] = useState(false)
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

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setBgError('')
    setBgNote('')
    const oldUrl = settings.bg_image_url
    try {
      const url = await uploadImage(BACKGROUND_BUCKET, file, 'home-')
      await saveSetting('bg_image_url', url)
      setSetting('bg_image_url', url)
      setBgNote('已更新背景')
      if (oldUrl) removeByUrl(BACKGROUND_BUCKET, oldUrl)
    } catch (err) {
      setBgError(`上傳失敗：${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function clearBg() {
    const oldUrl = settings.bg_image_url
    setUploading(true)
    setBgError('')
    try {
      await saveSetting('bg_image_url', '')
      setSetting('bg_image_url', '')
      setBgNote('已恢復預設（無背景圖）')
      if (oldUrl) removeByUrl(BACKGROUND_BUCKET, oldUrl)
    } catch (err) {
      setBgError(`儲存失敗：${err.message}`)
    } finally {
      setUploading(false)
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
          上傳一張圖片（8 MB 以內）作為首頁背景，建議選擇畫面偏亮、線條乾淨的圖片，
          我們會自動加上一層淡淡的紙色漸層，確保文字仍然清楚好讀，維持測驗該有的正式感。
        </p>
        {settings.bg_image_url && (
          <div
            style={{
              width: '100%',
              aspectRatio: '16/6',
              backgroundImage: `url("${settings.bg_image_url}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid var(--rule)',
              marginBottom: 12,
            }}
          />
        )}
        {bgError && <p className="error-text">{bgError}</p>}
        {bgNote && <p style={{ color: 'var(--pass)', fontSize: '0.9rem' }}>{bgNote}</p>}
        <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? '處理中...' : settings.bg_image_url ? '更換圖片' : '上傳圖片'}
        </button>{' '}
        <button className="ghost" onClick={clearBg} disabled={uploading || !settings.bg_image_url}>恢復預設</button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            handleUpload(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
