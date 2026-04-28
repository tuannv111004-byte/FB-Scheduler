"use client"

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'postops:desktop-sidebar-hidden'
const BODY_CLASS = 'sidebar-hidden'
const CHANGE_EVENT = 'postops-sidebar-change'

function readHiddenState() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

function applyHiddenState(hidden: boolean) {
  if (typeof document === 'undefined') return
  document.body.classList.toggle(BODY_CLASS, hidden)
}

function emitChange(hidden: boolean) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: hidden }))
}

export function useDesktopSidebar() {
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    const hidden = readHiddenState()
    setIsHidden(hidden)
    applyHiddenState(hidden)

    const handleChange = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>
      const nextValue = typeof customEvent.detail === 'boolean' ? customEvent.detail : readHiddenState()
      setIsHidden(nextValue)
      applyHiddenState(nextValue)
    }

    window.addEventListener(CHANGE_EVENT, handleChange)
    window.addEventListener('storage', handleChange)

    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [])

  const setHidden = useCallback((hidden: boolean) => {
    setIsHidden(hidden)
    window.localStorage.setItem(STORAGE_KEY, String(hidden))
    applyHiddenState(hidden)
    emitChange(hidden)
  }, [])

  const hideSidebar = useCallback(() => setHidden(true), [setHidden])
  const showSidebar = useCallback(() => setHidden(false), [setHidden])
  const toggleSidebar = useCallback(() => setHidden(!readHiddenState()), [setHidden])

  return {
    isHidden,
    hideSidebar,
    showSidebar,
    toggleSidebar,
  }
}
