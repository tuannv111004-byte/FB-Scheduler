import type {
  PosterLabGenre,
  PosterLabImportSort,
  PosterLabTmdbCandidate,
  PosterLabTmdbGenre,
} from './types'

export const posterLabSortOptions: Array<{ value: PosterLabImportSort; label: string }> = [
  { value: 'popularity.desc', label: 'Popularity' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'primary_release_date.desc', label: 'Newest Release' },
  { value: 'revenue.desc', label: 'Revenue' },
]

export function mapTmdbGenreToPosterLab(genreNames: string[]): PosterLabGenre {
  const normalized = genreNames.map((name) => name.trim().toLowerCase())

  if (normalized.includes('action') || normalized.includes('adventure')) return 'action'
  if (normalized.includes('horror')) return 'horror'
  if (normalized.includes('science fiction')) return 'sci_fi'
  if (normalized.includes('fantasy')) return 'fantasy'
  if (normalized.includes('thriller')) return 'thriller'
  if (normalized.includes('drama')) return 'drama'
  if (normalized.includes('romance')) return 'romance'
  if (normalized.includes('comedy')) return 'comedy'
  if (normalized.includes('mystery')) return 'mystery'
  if (normalized.includes('crime')) return 'crime'
  if (normalized.includes('animation') || normalized.includes('family')) return 'animation'

  return 'other'
}

export function buildTmdbCandidate(input: {
  movieId: number
  title: string
  franchiseName?: string
  genreIds: number[]
  genreMap: Map<number, string>
  releaseDate?: string
  overview?: string
  posterPath?: string | null
  backdropPath?: string | null
  categoryLabel: string
}): PosterLabTmdbCandidate {
  const genreNames = input.genreIds.map((genreId) => input.genreMap.get(genreId)).filter(Boolean) as string[]
  const franchiseName = (input.franchiseName || input.title).replace(/\s+Collection$/i, '').trim()

  return {
    franchiseName,
    latestOfficialTitle: input.title,
    genre: mapTmdbGenreToPosterLab(genreNames),
    notes: '',
    tmdbMovieId: input.movieId,
    tmdbGenreIds: input.genreIds,
    tmdbGenreNames: genreNames,
    releaseDate: input.releaseDate,
    overview: input.overview,
    posterPath: input.posterPath ?? undefined,
    backdropPath: input.backdropPath ?? undefined,
    sourceCategory: input.categoryLabel,
  }
}

export function createGenreMap(genres: PosterLabTmdbGenre[]) {
  return new Map(genres.map((genre) => [genre.id, genre.name]))
}
