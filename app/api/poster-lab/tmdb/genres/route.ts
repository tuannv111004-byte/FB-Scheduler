import { NextResponse } from 'next/server'
import type { PosterLabTmdbGenre } from '@/lib/types'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'

type TmdbGenreResponse = {
  genres?: Array<{
    id: number
    name: string
  }>
}

function getTmdbToken() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) {
    throw new Error('TMDB_READ_ACCESS_TOKEN is missing.')
  }
  return token
}

export async function GET() {
  try {
    const token = getTmdbToken()
    const response = await fetch(`${TMDB_API_BASE}/genre/movie/list?language=en`, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { message: `TMDb genre request failed: ${response.status} ${text}` },
        { status: response.status }
      )
    }

    const data = (await response.json()) as TmdbGenreResponse
    const genres: PosterLabTmdbGenre[] = (data.genres ?? []).map((genre) => ({
      id: genre.id,
      name: genre.name,
    }))

    return NextResponse.json({ genres })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to load TMDb genres.' },
      { status: 500 }
    )
  }
}
