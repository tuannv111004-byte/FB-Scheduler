import { NextResponse } from 'next/server'
import { buildTmdbCandidate, createGenreMap } from '@/lib/poster-lab'
import type { PosterLabImportSort, PosterLabTmdbCandidate, PosterLabTmdbDiscoverRequest } from '@/lib/types'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const allowedSorts = new Set<PosterLabImportSort>([
  'popularity.desc',
  'vote_average.desc',
  'primary_release_date.desc',
  'revenue.desc',
])

type TmdbDiscoverMovieResult = {
  id: number
  title: string
  genre_ids: number[]
  release_date?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
}

type TmdbDiscoverResponse = {
  results?: TmdbDiscoverMovieResult[]
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

async function tmdbFetch(pathname: string, searchParams: URLSearchParams) {
  const token = getTmdbToken()
  const response = await fetch(`${TMDB_API_BASE}${pathname}?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`TMDb request failed: ${response.status} ${text}`)
  }

  return response.json()
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<PosterLabTmdbDiscoverRequest>
    const pageCount = clamp(Number(body.pageCount) || 1, 1, 10)
    const maxResults = clamp(Number(body.maxResults) || 40, 1, 200)
    const minVoteCount = clamp(Number(body.minVoteCount) || 100, 0, 100000)
    const sortBy = allowedSorts.has(body.sortBy as PosterLabImportSort)
      ? (body.sortBy as PosterLabImportSort)
      : 'popularity.desc'
    const genreId = typeof body.genreId === 'number' ? body.genreId : undefined
    const genreName = typeof body.genreName === 'string' ? body.genreName.trim() : ''

    const genreData = (await tmdbFetch(
      '/genre/movie/list',
      new URLSearchParams({ language: 'en' })
    )) as TmdbGenreResponse

    const genreMap = createGenreMap(
      (genreData.genres ?? []).map((genre) => ({ id: genre.id, name: genre.name }))
    )

    const discovered: PosterLabTmdbCandidate[] = []
    const seenMovieIds = new Set<number>()
    const categoryLabel = genreName || (genreId ? genreMap.get(genreId) ?? `Genre ${genreId}` : 'Mixed')

    for (let page = 1; page <= pageCount; page += 1) {
      const params = new URLSearchParams({
        include_adult: 'false',
        include_video: 'false',
        language: 'en-US',
        page: String(page),
        sort_by: sortBy,
        'vote_count.gte': String(minVoteCount),
      })

      if (genreId) {
        params.set('with_genres', String(genreId))
      }

      const response = (await tmdbFetch('/discover/movie', params)) as TmdbDiscoverResponse
      const results = response.results ?? []

      for (const movie of results) {
        if (!movie.title || seenMovieIds.has(movie.id)) {
          continue
        }

        seenMovieIds.add(movie.id)
        discovered.push(
          buildTmdbCandidate({
            movieId: movie.id,
            title: movie.title,
            genreIds: movie.genre_ids ?? [],
            genreMap,
            releaseDate: movie.release_date,
            overview: movie.overview,
            posterPath: movie.poster_path,
            backdropPath: movie.backdrop_path,
            categoryLabel,
          })
        )

        if (discovered.length >= maxResults) {
          break
        }
      }

      if (discovered.length >= maxResults) {
        break
      }
    }

    return NextResponse.json({
      candidates: discovered,
      meta: {
        categoryLabel,
        pageCount,
        maxResults,
        sortBy,
        minVoteCount,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to crawl TMDb movies.' },
      { status: 500 }
    )
  }
}
