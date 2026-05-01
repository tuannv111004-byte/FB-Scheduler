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
  total_pages?: number
}

type TmdbMovieDetailsResponse = TmdbDiscoverMovieResult & {
  belongs_to_collection?: {
    id: number
    name: string
    poster_path?: string | null
    backdrop_path?: string | null
  } | null
}

type TmdbCollectionResponse = {
  id: number
  name: string
  poster_path?: string | null
  backdrop_path?: string | null
  parts?: TmdbDiscoverMovieResult[]
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

function getReleaseTime(movie: TmdbDiscoverMovieResult) {
  if (!movie.release_date) {
    return 0
  }

  const time = Date.parse(movie.release_date)
  return Number.isFinite(time) ? time : 0
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
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
    const pageCount = clamp(Number(body.pageCount) || 1, 1, 500)
    const maxResults = clamp(Number(body.maxResults) || 40, 1, 10000)
    const minVoteCount = clamp(Number(body.minVoteCount) || 100, 0, 100000)
    const sortBy = allowedSorts.has(body.sortBy as PosterLabImportSort)
      ? (body.sortBy as PosterLabImportSort)
      : 'popularity.desc'
    const genreId = typeof body.genreId === 'number' ? body.genreId : undefined
    const genreName = typeof body.genreName === 'string' ? body.genreName.trim() : ''
    const includeExisting = body.includeExisting === true
    const includeStandalone = body.includeStandalone !== false
    const existingTmdbMovieIds = new Set(
      Array.isArray(body.existingTmdbMovieIds)
        ? body.existingTmdbMovieIds.filter((value): value is number => Number.isInteger(value))
        : []
    )
    const scanPageLimit = includeExisting ? pageCount : clamp(pageCount * 5, pageCount, 500)

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
    const today = getTodayIsoDate()
    let scannedPages = 0
    let skippedExisting = 0
    let skippedSingles = 0
    const seenCollectionIds = new Set<number>()
    const collectionCache = new Map<number, TmdbCollectionResponse>()

    for (let page = 1; page <= scanPageLimit; page += 1) {
      const params = new URLSearchParams({
        include_adult: 'false',
        include_video: 'false',
        language: 'en-US',
        page: String(page),
        sort_by: sortBy,
        'primary_release_date.lte': today,
        'vote_count.gte': String(minVoteCount),
      })

      if (genreId) {
        params.set('with_genres', String(genreId))
      }

      const response = (await tmdbFetch('/discover/movie', params)) as TmdbDiscoverResponse
      const results = response.results ?? []
      scannedPages = page

      for (const movie of results) {
        if (!movie.title || seenMovieIds.has(movie.id)) {
          continue
        }

        seenMovieIds.add(movie.id)

        const details = (await tmdbFetch(
          `/movie/${movie.id}`,
          new URLSearchParams({ language: 'en-US' })
        )) as TmdbMovieDetailsResponse

        const collectionInfo = details.belongs_to_collection
        if (!collectionInfo?.id) {
          if (!includeStandalone) {
            skippedSingles += 1
            continue
          }

          if (!includeExisting && existingTmdbMovieIds.has(movie.id)) {
            skippedExisting += 1
            continue
          }

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
              categoryLabel: `${categoryLabel} Standalone`,
            })
          )

          if (discovered.length >= maxResults) {
            break
          }

          continue
        }

        if (seenCollectionIds.has(collectionInfo.id)) {
          continue
        }

        let collection = collectionCache.get(collectionInfo.id)
        if (!collection) {
          collection = (await tmdbFetch(
            `/collection/${collectionInfo.id}`,
            new URLSearchParams({ language: 'en-US' })
          )) as TmdbCollectionResponse
          collectionCache.set(collectionInfo.id, collection)
        }

        const latestMovie = (collection.parts ?? [])
          .filter((part) => part.title && part.release_date && part.release_date <= today && getReleaseTime(part) > 0)
          .sort((a, b) => getReleaseTime(b) - getReleaseTime(a))[0]

        if (!latestMovie) {
          skippedSingles += 1
          continue
        }

        seenCollectionIds.add(collectionInfo.id)

        if (!includeExisting && existingTmdbMovieIds.has(latestMovie.id)) {
          skippedExisting += 1
          continue
        }

        discovered.push(
          buildTmdbCandidate({
            movieId: latestMovie.id,
            title: latestMovie.title,
            franchiseName: collection.name || collectionInfo.name,
            genreIds: latestMovie.genre_ids?.length ? latestMovie.genre_ids : movie.genre_ids ?? [],
            genreMap,
            releaseDate: latestMovie.release_date,
            overview: latestMovie.overview,
            posterPath: latestMovie.poster_path ?? collection.poster_path ?? collectionInfo.poster_path,
            backdropPath: latestMovie.backdrop_path ?? collection.backdrop_path ?? collectionInfo.backdrop_path,
            categoryLabel: `${categoryLabel} Franchise`,
          })
        )

        if (discovered.length >= maxResults) {
          break
        }
      }

      if (discovered.length >= maxResults) {
        break
      }

      if (response.total_pages && page >= response.total_pages) {
        break
      }
    }

    return NextResponse.json({
      candidates: discovered,
      meta: {
        categoryLabel,
        pageCount,
        scannedPages,
        maxResults,
        sortBy,
        minVoteCount,
        skippedExisting,
        skippedSingles,
        includeExisting,
        includeStandalone,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to crawl TMDb movies.' },
      { status: 500 }
    )
  }
}
