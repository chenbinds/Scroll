import { useRef, useEffect, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, ListMusic, X } from 'lucide-react'
import { useMusicStore, type MusicTrack } from '../../stores/musicStore'
import { useI18n } from '../../lib/i18n'
import { startGenerator, stopGenerator, type GeneratorType } from '../../lib/audioGenerator'

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

export default function MusicPlayer() {
  const { t } = useI18n()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const {
    playlist, currentIndex, isPlaying, volume, currentTime, isExpanded, showMiniPlayer,
    togglePlay, nextTrack, prevTrack, setVolume, setCurrentTime, setDuration,
    setExpanded, setShowMiniPlayer
  } = useMusicStore()

  const track: MusicTrack | null = playlist[currentIndex] || null

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.volume = volume
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => nextTrack()
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!track) return
    if (track.source === 'generator') {
      if (audio) { audio.pause(); audio.src = '' }
      stopGenerator()
      if (isPlaying) startGenerator(track.src.replace('generator:', '') as GeneratorType, volume)
    } else {
      stopGenerator()
      if (!audio) return
      const src = track.source === 'local' ? `file:///${track.src.replace(/\\/g, '/')}` : track.src
      if (audio.src !== src) { audio.src = src; if (isPlaying) audio.play().catch(() => {}) }
    }
  }, [track?.id])

  useEffect(() => {
    if (!track) return
    if (track.source === 'generator') {
      if (isPlaying) startGenerator(track.src.replace('generator:', '') as GeneratorType, volume)
      else stopGenerator()
    } else {
      const audio = audioRef.current
      if (!audio) return
      if (isPlaying) audio.play().catch(() => {})
      else audio.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    if (track?.source === 'generator' && isPlaying) {
      stopGenerator()
      startGenerator(track.src.replace('generator:', '') as GeneratorType, volume)
    }
  }, [volume])

  useEffect(() => {
    return () => {
      stopGenerator()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    }
  }, [])

  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }, [])

  if (!showMiniPlayer) return null

  return (
    <>
      <div className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300
                       ${isExpanded ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="h-12 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm
                        border-t border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3">
          <button onClick={() => setExpanded(true)} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <Music size={14} className="text-scroll-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                {track ? trackTitle(track, t) : t('music.noTrack')}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 truncate">
                {track ? trackArtist(track, t) : '-'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <button onClick={prevTrack} disabled={playlist.length === 0}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors">
              <SkipBack size={16} />
            </button>
            <button onClick={togglePlay} disabled={!track}
              className="p-1.5 rounded-full bg-scroll-500 hover:bg-scroll-600 text-white disabled:opacity-30 transition-colors">
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={nextTrack} disabled={playlist.length === 0}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors">
              <SkipForward size={16} />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-400 min-w-[120px] justify-end">
            {track?.source !== 'generator' && <span>{formatTime(currentTime)}</span>}
            {track?.source === 'generator' && <span className="text-scroll-400">{t('music.live')}</span>}
            <div className="flex items-center gap-1">
              <Volume2 size={12} />
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))} className="w-16 accent-scroll-500" />
            </div>
          </div>

          <button onClick={() => setExpanded(true)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ListMusic size={16} />
          </button>
          <button onClick={() => {
            stopGenerator()
            if (audioRef.current) { audioRef.current.pause() }
            useMusicStore.getState().togglePlay()
            setShowMiniPlayer(false)
          }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {isExpanded && <MusicPlaylistPanel onClose={() => setExpanded(false)} />}
    </>
  )
}

function MusicPlaylistPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const { playlist, currentIndex, playTrack, removeTrack } = useMusicStore()

  const handleAddUrl = () => {
    const url = prompt(t('music.prompt.url'))
    if (!url) return
    const title = prompt(t('music.prompt.title')) || t('music.prompt.untitled')
    const artist = prompt(t('music.prompt.artist')) || t('music.prompt.unknown')
    useMusicStore.getState().addTrack({
      id: `url-${Date.now()}`, title, artist, source: 'url', src: url,
      genre: 'custom', license: t('music.userAdded')
    })
  }

  const handleAddLocal = async () => {
    const paths = await window.scrollAPI.openMusicDialog()
    if (!paths || paths.length === 0) return
    for (const path of paths) {
      const fileName = path.split(/[\\/]/).pop() || 'Unknown'
      useMusicStore.getState().addTrack({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: fileName.replace(/\.[^.]+$/, ''),
        artist: t('music.localFile'), source: 'local', src: path,
        genre: 'custom', license: t('music.userAdded')
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[480px] max-h-[70vh]
                      border border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Music size={16} className="text-scroll-500" />
            {t('music.playlist')}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {playlist.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-600">
              <Music size={32} className="mx-auto mb-2 opacity-30" />
              <p>{t('music.empty')}</p>
              <p className="text-xs mt-1">{t('music.empty.hint')}</p>
            </div>
          ) : (
            playlist.map((track, i) => (
              <div key={track.id} onClick={() => playTrack(i)}
                className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors
                            hover:bg-gray-50 dark:hover:bg-gray-800/50
                            ${i === currentIndex
                    ? 'bg-scroll-50 dark:bg-scroll-900/20 border-l-2 border-scroll-500'
                    : 'border-l-2 border-transparent'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${i === currentIndex
                      ? 'text-scroll-600 dark:text-scroll-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300'}`}>
                    {trackTitle(track, t)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 truncate">
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
                <button onClick={(e) => { e.stopPropagation(); removeTrack(track.id) }}
                  className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <div className="flex gap-2">
            <button onClick={handleAddUrl}
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
          <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed">
            {t('music.copyright')}
          </p>
        </div>
      </div>
    </div>
  )
}
