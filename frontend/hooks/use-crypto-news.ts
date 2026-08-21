'use client'

import { useEffect, useState } from 'react'

export interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
}

export function useCryptoNews() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/news`)
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        setItems(data.items ?? [])
        setError(false)
      } catch {
        setError(true)
      }
    }

    fetchNews()
    const id = setInterval(fetchNews, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  return { items, error }
}
