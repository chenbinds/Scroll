import { useRef, useEffect, useCallback, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, ListMusic, X, AlertTriangle } from 'lucide-react'
import { useMusicStore, type MusicTrack } from '../../stores/musicStore'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { startGenerator, stopGenerator, type GeneratorType } from '../../lib/audioGenerator'
import {
  loadMusicState,
  saveMusicState,
  playlistFromPersisted,
  indexForTrackId,
  userTracksFromPlaylist,
  findMissingLocalTrackIds
} from '../../lib/musicStorage'

const GEN_TRACK_KEYS: Record<string, string> = {
  'generator:whitenoise': 'track.whiteNoise',
  'generator:brownnoise': 'track.brownNoise',
  'generator:softpad': 'track.softPad',
  'generator:rain': 'track.rain'
}

function trackTitle(track: MusicTrack, t: (k: string) => string): string {
  if (track.source === 'generator') {
    return t(GEN_TRACK_KEYS[track.src] || 'track.softPad')
  }
  return track.title
}

function trackArtist(track: MusicTrack, t: (k: string) => string): string {
  if (track.source === 'generator') return 'Scroll'
  return track.artist
}

function trackSrcForAudio(track: MusicTrack): string {
  if (track.source === 'local') {
    return `file:///${track.src.replace(/\\/g, '/')}`
  }
  return track.src
}

function generatorTypeFromTrack(track: MusicTrack): GeneratorType {
  return track.src.replace('generator:', '') as GeneratorType
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export default function MusicPlayer() {
  const { t } = useI18n()
  const currentView = useAppStore((s) => s.currentView)
  const inReader = currentView === 'reader'
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeTrackIdRef = useRef<string | null>(null)

  const {
    playlist, currentIndex, isPlaying, volume, currentTime, isExpanded, showMiniPlayer,
    unavailableTrackIds, hydrated,
    togglePlay, nextTrack, prevTrack, setVolume, setCurrentTime, setDuration,
    setExpanded, setShowMiniPlayer, hydrate, markTrackUnavailable
  } = useMusicStore()

  const track: MusicTrack | null = playlist[currentIndex] || null
  const trackUnavailable = track ? unavailableTrackIds.includes(track.id) : false

  // Hydrate persisted playlist on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadMusicState()
      if (cancelled) return
      const merged = playlistFromPersisted(saved.userTracks)
      const missing = await findMissingLocalTrackIds(merged)
      if (cancelled) return
      let currentIndex = indexForTrackId(merged, saved.currentTrackId)
      if (currentIndex >= 0 && missing.includes(merged[currentIndex].id)) {
        currentIndex = -1
      }
      hydrate({
        playlist: merged,
        volume: saved.volume,
        currentIndex,
        showMiniPlayer: saved.showMiniPlayer && currentIndex >= 0,
        unavailableTrackIds: missing
      })
    })()
    return () => { cancelled = true }
  }, [hydrate])

  // Debounced persist
  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(() => {
      const st = useMusicStore.getState()
      const currentTrack = st.playlist[st.currentIndex]
      void saveMusicState({
        userTracks: userTracksFromPlaylist(st.playlist),
        volume: st.volume,
        currentTrackId: currentTrack?.id ?? null,
        showMiniPlayer: st.showMiniPlayer
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [playlist, volume, currentIndex, showMiniPlayer, hydrated])

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.volume = volume
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => nextTrack()
    const onError = () => {
      const id = activeTrackIdRef.current
      if (id) markTrackUnavailable(id)
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [nextTrack, setCurrentTime, setDuration, markTrackUnavailable, volume])

  // Stop previous source and load new track
  useEffect(() => {
    const audio = audioRef.current
    stopGenerator()

    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    activeTrackIdRef.current = track?.id ?? null

    if (!track || trackUnavailable) return

    if (track.source === 'generator') return

    if (audio) {
      audio.src = trackSrcForAudio(track)
      audio.load()
    }
  }, [track?.id, trackUnavailable])

  // Play / pause current track
  useEffect(() => {
    if (!track || trackUnavailable) {
      stopGenerator()
      audioRef.current?.pause()
      return
    }

    if (track.source === 'generator') {
      if (isPlaying) startGenerator(generatorTypeFromTrack(track), volume)
      else stopGenerator()
      return
    }

    const audio = audioRef.current
    if (!audio?.src) return
    if (isPlaying) audio.play().catch(() => markTrackUnavailable(track.id))
    else audio.pause()
  }, [track?.id, isPlaying, trackUnavailable, markTrackUnavailable])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    if (track?.source === 'generator' && isPlaying && !trackUnavailable) {
      stopGenerator()
      startGenerator(generatorTypeFromTrack(track), volume)
    }
  }, [volume, track?.id, track?.source, isPlaying, trackUnavailable])

  useEffect(() => {
    return () => {
      stopGenerator()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
      }
    }
  }, [])

  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }, [])

  const handleCloseMini = () => {
    stopGenerator()
    if (audioRef.current) audioRef.current.pause()
    useMusicStore.getState().pause()
    setShowMiniPlayer(false)
    setExpanded(false)
  }

  if (!showMiniPlayer) return null

  const miniBarClass = inReader
    ? 'h-12 chrome-surface chrome-border-t flex items-center px-4 gap-3'
    : 'h-12 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3'

  return (
    <>
      {!isExpanded && (
      <div
        data-music-player
        className="flex-shrink-0 w-full z-40"
      >
        <div className={`${miniBarClass} min-w-0`}>
          <button onClick={() => setExpanded(true)} className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity overflow-hidden">
            <Music size={14} className="text-scroll-500 flex-shrink-0" />
            <div className="min-w-0 overflow-hidden">
              <p className={`text-xs font-medium truncate ${inReader ? 'text-[var(--reader-text)]' : 'text-gray-700 dark:text-gray-300'}`}>
                {track ? trackTitle(track, t) : t('music.noTrack')}
                {trackUnavailable && (
                  <span className="ml-1 text-amber-500" title={t('music.unavailable')}>
                    <AlertTriangle size={10} className="inline" />
                  </span>
                )}
              </p>
              <p className={`text-[10px] truncate ${inReader ? 'chrome-muted' : 'text-gray-400 dark:text-gray-600'}`}>
                {track ? trackArtist(track, t) : '-'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={prevTrack} disabled={playlist.length === 0}
              className={`p-1 disabled:opacity-30 transition-colors ${inReader ? 'chrome-muted hover:text-[var(--reader-text)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <SkipBack size={16} />
            </button>
            <button onClick={togglePlay} disabled={!track || trackUnavailable}
              className="p-1.5 rounded-full bg-scroll-500 hover:bg-scroll-600 text-white disabled:opacity-30 transition-colors">
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={nextTrack} disabled={playlist.length === 0}
              className={`p-1 disabled:opacity-30 transition-colors ${inReader ? 'chrome-muted hover:text-[var(--reader-text)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <SkipForward size={16} />
            </button>
          </div>

          <div className={`hidden md:flex items-center gap-2 text-[10px] flex-shrink-0 ${inReader ? 'chrome-muted' : 'text-gray-400'}`}>
            {track?.source !== 'generator' && <span className="whitespace-nowrap tabular-nums">{formatTime(currentTime)}</span>}
            {track?.source === 'generator' && <span className="text-scroll-400 whitespace-nowrap">{t('music.live')}</span>}
          </div>

          <div className={`hidden sm:flex items-center gap-2 flex-shrink-0 ${inReader ? 'chrome-muted' : 'text-gray-400'}`}>
            <Volume2 size={12} className="flex-shrink-0" />
            <input type="range" min={0} max={1} step={0.05} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 min-w-[5rem] flex-shrink-0 accent-scroll-500" />
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => setExpanded(true)}
            className={`p-1 transition-colors ${inReader ? 'chrome-muted hover:text-[var(--reader-text)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
            <ListMusic size={16} />
          </button>
          <button onClick={handleCloseMini}
            className={`p-1 transition-colors ${inReader ? 'chrome-muted hover:text-[var(--reader-text)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
            <X size={16} />
          </button>
          </div>
        </div>
      </div>
      )}

      {isExpanded && <MusicPlaylistPanel onClose={() => setExpanded(false)} inReader={inReader} />}
    </>
  )
}

function MusicPlaylistPanel({ onClose, inReader }: { onClose: () => void; inReader: boolean }) {
  const { t } = useI18n()
  const { playlist, currentIndex, unavailableTrackIds, playTrack, removeTrack } = useMusicStore()
  const [addUrlOpen, setAddUrlOpen] = useState(false)

  const handleAddLocal = async () => {
    const paths = await window.scrollAPI.openMusicDialog()
    if (!paths || paths.length === 0) return
    const store = useMusicStore.getState()
    for (const path of paths) {
      const fileName = path.split(/[\\/]/).pop() || 'Unknown'
      store.addTrack({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: fileName.replace(/\.[^.]+$/, ''),
        artist: t('music.localFile'),
        source: 'local',
        src: path,
        genre: 'custom',
        license: t('music.userAdded')
      })
    }
  }

  const panelClass = inReader
    ? 'bg-[var(--reader-surface)] border-[var(--reader-border)]'
    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'

  return (
    <>
      <div data-music-player className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className={`rounded-xl shadow-2xl w-[480px] max-h-[70vh] border flex flex-col ${panelClass}`}>
          <div className={`flex items-center justify-between px-5 py-3 border-b ${inReader ? 'border-[var(--reader-border)]' : 'border-gray-200 dark:border-gray-800'}`}>
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${inReader ? 'text-[var(--reader-text)]' : 'text-gray-900 dark:text-gray-100'}`}>
              <Music size={16} className="text-scroll-500" />
              {t('music.playlist')}
            </h3>
            <button onClick={onClose} className={`p-1 rounded ${inReader ? 'hover:bg-[var(--reader-surface-raised)] text-[var(--reader-muted)]' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}`}>
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {playlist.length === 0 ? (
              <div className={`py-12 text-center text-sm ${inReader ? 'chrome-muted' : 'text-gray-400 dark:text-gray-600'}`}>
                <Music size={32} className="mx-auto mb-2 opacity-30" />
                <p>{t('music.empty')}</p>
                <p className="text-xs mt-1">{t('music.empty.hint')}</p>
              </div>
            ) : (
              playlist.map((track, i) => {
                const unavailable = unavailableTrackIds.includes(track.id)
                return (
                  <div key={track.id} onClick={() => !unavailable && playTrack(i)}
                    className={`flex items-center gap-3 px-5 py-2.5 transition-colors
                                ${unavailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50'}
                                ${i === currentIndex
                        ? 'bg-scroll-50 dark:bg-scroll-900/20 border-l-2 border-scroll-500'
                        : 'border-l-2 border-transparent'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate flex items-center gap-1 ${i === currentIndex
                          ? 'text-scroll-600 dark:text-scroll-400 font-medium'
                          : inReader ? 'text-[var(--reader-text)]' : 'text-gray-700 dark:text-gray-300'}`}>
                        {trackTitle(track, t)}
                        {unavailable && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                            <AlertTriangle size={10} />
                            {t('music.unavailable')}
                          </span>
                        )}
                      </p>
                      <p className={`text-xs truncate ${inReader ? 'chrome-muted' : 'text-gray-400 dark:text-gray-600'}`}>
                        {trackArtist(track, t)}{track.source === 'generator' ? ` · ${t('music.builtin')}` : ` · ${track.genre}`}
                      </p>
                    </div>
                    {track.source === 'generator' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-scroll-50 dark:bg-scroll-900/20
                                       text-scroll-600 dark:text-scroll-400 flex-shrink-0">{t('music.builtin')}</span>
                    )}
                    {track.source === 'url' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20
                                       text-green-600 dark:text-green-400 flex-shrink-0">{t('music.url')}</span>
                    )}
                    {track.source === 'local' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20
                                       text-blue-600 dark:text-blue-400 flex-shrink-0">{t('music.local')}</span>
                    )}
                    {track.source !== 'generator' && (
                      <button onClick={(e) => { e.stopPropagation(); removeTrack(track.id) }}
                        className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className={`px-5 py-3 border-t space-y-2 ${inReader ? 'border-[var(--reader-border)]' : 'border-gray-200 dark:border-gray-800'}`}>
            <div className="flex gap-2">
              <button onClick={() => setAddUrlOpen(true)}
                className="flex-1 py-2 text-sm text-scroll-600 dark:text-scroll-400
                           border border-dashed border-scroll-300 dark:border-scroll-700
                           rounded-lg hover:bg-scroll-50 dark:hover:bg-scroll-900/20 transition-colors">
                {t('music.addUrl')}
              </button>
              <button onClick={handleAddLocal}
                className="flex-1 py-2 text-sm text-scroll-600 dark:text-scroll-400
                           border border-dashed border-scroll-300 dark:border-scroll-700
                           rounded-lg hover:bg-scroll-50 dark:hover:bg-scroll-900/20 transition-colors">
                {t('music.addLocal')}
              </button>
            </div>
            <p className={`text-[10px] leading-relaxed ${inReader ? 'chrome-muted' : 'text-gray-400 dark:text-gray-600'}`}>
              {t('music.copyright')}
            </p>
          </div>
        </div>
      </div>

      {addUrlOpen && (
        <AddUrlTrackDialog
          inReader={inReader}
          onClose={() => setAddUrlOpen(false)}
          onAdded={() => setAddUrlOpen(false)}
        />
      )}
    </>
  )
}

function AddUrlTrackDialog({
  inReader,
  onClose,
  onAdded
}: {
  inReader: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!isValidHttpUrl(trimmedUrl)) {
      setError(t('music.error.invalidUrl'))
      return
    }
    const store = useMusicStore.getState()
    const added = store.addTrack({
      id: `url-${Date.now()}`,
      title: title.trim() || t('music.prompt.untitled'),
      artist: artist.trim() || t('music.prompt.unknown'),
      source: 'url',
      src: trimmedUrl,
      genre: 'custom',
      license: t('music.userAdded')
    })
    if (!added) {
      setError(t('music.error.duplicate'))
      return
    }
    onAdded()
  }

  const panelClass = inReader
    ? 'bg-[var(--reader-surface)] border-[var(--reader-border)]'
    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'

  const inputClass = inReader
    ? 'w-full px-3 py-2 text-sm rounded-lg border border-[var(--reader-border)] bg-[var(--reader-bg)] text-[var(--reader-text)]'
    : 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

  return (
    <div data-music-player className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-xl shadow-2xl w-[420px] border ${panelClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-3 border-b ${inReader ? 'border-[var(--reader-border)]' : 'border-gray-200 dark:border-gray-800'}`}>
          <h3 className={`text-sm font-semibold ${inReader ? 'text-[var(--reader-text)]' : 'text-gray-900 dark:text-gray-100'}`}>
            {t('music.addUrl.dialog.title')}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className={`text-xs mb-1 block ${inReader ? 'chrome-muted' : 'text-gray-500'}`}>{t('music.addUrl.dialog.url')}</span>
            <input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setError(null) }}
              placeholder="https://" className={inputClass} autoFocus required />
          </label>
          <label className="block">
            <span className={`text-xs mb-1 block ${inReader ? 'chrome-muted' : 'text-gray-500'}`}>{t('music.addUrl.dialog.titleLabel')}</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t('music.prompt.untitled')} className={inputClass} />
          </label>
          <label className="block">
            <span className={`text-xs mb-1 block ${inReader ? 'chrome-muted' : 'text-gray-500'}`}>{t('music.addUrl.dialog.artistLabel')}</span>
            <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)}
              placeholder={t('music.prompt.unknown')} className={inputClass} />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className={`flex justify-end gap-2 px-5 py-3 border-t ${inReader ? 'border-[var(--reader-border)]' : 'border-gray-200 dark:border-gray-800'}`}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            {t('music.addUrl.dialog.cancel')}
          </button>
          <button type="submit"
            className="px-4 py-2 text-sm rounded-lg bg-scroll-500 hover:bg-scroll-600 text-white">
            {t('music.addUrl.dialog.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
