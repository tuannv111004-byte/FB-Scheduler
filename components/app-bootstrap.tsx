"use client"

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'

export function AppBootstrap() {
  const initializeApp = useAppStore((state) => state.initializeApp)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    void initializeApp()
  }, [initializeApp])

  return null
}
