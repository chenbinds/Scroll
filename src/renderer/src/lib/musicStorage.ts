import type { MusicTrack } from '../stores/musicStore'
import { BUILTIN_GENERATORS, mergePlaylist } from '../stores/musicStore'

export interface PersistedMusicState {
  version: 1
  userTracks: MusicTrack[]
  volume: number
  currentTrackId: string | null
  showMiniPlayer: boolean
}

const STORAGE_KEY = 'music_state'

const DEFAULT_STATE: PersistedMusicState = {
  version: 1,
  userTracks: [],
  volume: 0.5,
  currentTrackId: null,
  showMiniPlayer: false
}

export async function loadMusicState(): Promise<PersistedMusicState> {
  const raw = await window.scrollAPI.storage.get(STORAGE_KEY, null)
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE
  const data = raw as Partial<PersistedMusicState>
  if (data.version !== 1) return DEFAULT_STATE

  const userTracks = Array.isArray(data.userTracks)
    ? data.userTracks.filter(isPersistableTrack)
    : []

  return {
    version: 1,
    userTracks,
    volume: typeof data.volume === 'number' ? clamp(data.volume, 0, 1) : 0.5,
    currentTrackId: typeof data.currentTrackId === 'string' ? data.currentTrackId : null,
    showMiniPlayer: Boolean(data.showMiniPlayer)
  }
}

export async function saveMusicState(state: Omit<PersistedMusicState, 'version'>): Promise<void> {
  await window.scrollAPI.storage.set(STORAGE_KEY, { version: 1, ...state })
}

function isPersistableTrack(t: unknown): t is MusicTrack {
  if (!t || typeof t !== 'object') return false
  const track = t as MusicTrack
  return (
    (track.source === 'local' || track.source === 'url') &&
    typeof track.id === 'string' &&
    typeof track.title === 'string' &&
    typeof track.artist === 'string' &&
    typeof track.src === 'string' &&
    track.src.length > 0
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function playlistFromPersisted(userTracks: MusicTrack[]): MusicTrack[] {
  return mergePlaylist(userTracks)
}

export function indexForTrackId(playlist: MusicTrack[], trackId: string | null): number {
  if (!trackId) return -1
  return playlist.findIndex((t) => t.id === trackId)
}

export function userTracksFromPlaylist(playlist: MusicTrack[]): MusicTrack[] {
  const builtinIds = new Set(BUILTIN_GENERATORS.map((t) => t.id))
  return playlist.filter((t) => t.source !== 'generator' && !builtinIds.has(t.id))
}

export async function findMissingLocalTrackIds(tracks: MusicTrack[]): Promise<string[]> {
  const missing: string[] = []
  for (const track of tracks) {
    if (track.source !== 'local') continue
    const exists = await window.scrollAPI.pathExists(track.src)
    if (!exists) missing.push(track.id)
  }
  return missing
}
