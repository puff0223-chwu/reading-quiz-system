import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'

// 主題色預設 — 都在「正式考卷」的色調範圍內挑選，避免變成花俏電玩風
export const THEMES = {
  crimson: { label: '硃紅（預設）', accent: '#7a2e2e' },
  indigo: { label: '靛藍', accent: '#2f4560' },
  forest: { label: '墨綠', accent: '#2f5d3a' },
  ochre: { label: '赭黃', accent: '#92600f' },
  graphite: { label: '石墨', accent: '#3a3733' },
}

export const DEFAULT_SETTINGS = {
  theme_preset: 'crimson',
  bg_image_url: '',
}

const CACHE_KEY = 'reading-quiz-settings-cache'

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

export function applyTheme(preset) {
  const theme = THEMES[preset] || THEMES.crimson
  document.documentElement.style.setProperty('--accent', theme.accent)
  document.documentElement.style.setProperty('--accent-rgb', hexToRgb(theme.accent))
}

function readCache() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function writeCache(settings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings))
  } catch {
    // 沒有 localStorage 也沒關係，只是下次沒辦法預先套用
  }
}

const SettingsContext = createContext({ settings: DEFAULT_SETTINGS, setSetting: () => {} })

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readCache)

  useEffect(() => {
    applyTheme(settings.theme_preset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme_preset])

  useEffect(() => {
    let active = true
    supabase
      .from('settings')
      .select('key, value')
      .then(({ data, error }) => {
        if (!active || error || !data) return
        const loaded = Object.fromEntries(data.map((row) => [row.key, row.value]))
        setSettings((prev) => {
          const next = { ...prev, ...loaded }
          writeCache(next)
          return next
        })
      })
    return () => {
      active = false
    }
  }, [])

  function setSetting(key, value) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      writeCache(next)
      return next
    })
  }

  const value = useMemo(() => ({ settings, setSetting }), [settings])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}
