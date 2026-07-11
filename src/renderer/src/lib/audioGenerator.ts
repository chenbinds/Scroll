/**
 * Web Audio API ambient sound generators
 * 100% copyright-free, works offline, no external dependencies
 */

let audioCtx: AudioContext | null = null
let currentGenerator: { stop: () => void } | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export type GeneratorType = 'whitenoise' | 'brownnoise' | 'softpad' | 'rain'

export function startGenerator(type: GeneratorType, volume: number): void {
  stopGenerator()
  const ctx = getCtx()
  const masterGain = ctx.createGain()
  masterGain.gain.value = volume
  masterGain.connect(ctx.destination)

  switch (type) {
    case 'whitenoise':
      startWhiteNoise(ctx, masterGain)
      break
    case 'brownnoise':
      startBrownNoise(ctx, masterGain)
      break
    case 'softpad':
      startSoftPad(ctx, masterGain)
      break
    case 'rain':
      startRain(ctx, masterGain)
      break
  }

  currentGenerator = {
    stop: () => {
      masterGain.disconnect()
    }
  }
}

export function stopGenerator(): void {
  if (currentGenerator) {
    currentGenerator.stop()
    currentGenerator = null
  }
}

export function setGeneratorVolume(volume: number): void {
  // Volume is set at start time; for live adjustment, we'd need to track the gain node
  // This is handled by the Audio element for non-generator tracks
}

// ---- Generator Implementations ----

function startWhiteNoise(ctx: AudioContext, dest: GainNode): void {
  const bufferSize = 2 * ctx.sampleRate
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  // Low-pass filter to soften the noise
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 8000
  source.connect(filter)
  filter.connect(dest)
  source.start()
}

function startBrownNoise(ctx: AudioContext, dest: GainNode): void {
  const bufferSize = 2 * ctx.sampleRate
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let lastOut = 0
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1
    data[i] = (lastOut + 0.02 * white) / 1.02
    lastOut = data[i]
    data[i] *= 3.5 // normalize
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 400
  source.connect(filter)
  filter.connect(dest)
  source.start()
}

function startSoftPad(ctx: AudioContext, dest: GainNode): void {
  // Gentle chord: D2 + A2 + F#3 (D major)
  const frequencies = [73.42, 110.0, 185.0]
  const oscillators: OscillatorNode[] = []

  frequencies.forEach((freq) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.value = 0.12 / frequencies.length
    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    oscillators.push(osc)
  })

  // Slow LFO for subtle movement
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.1
  lfoGain.gain.value = 5
  lfo.connect(lfoGain)
  lfoGain.connect(dest)
  lfo.start()
  oscillators.push(lfo)

  // Store refs for cleanup
  ;(dest as unknown as Record<string, unknown>)._oscs = oscillators
  const origDisconnect = dest.disconnect.bind(dest)
  dest.disconnect = function () {
    oscillators.forEach((o) => {
      try { o.stop() } catch { /* already stopped */ }
    })
    origDisconnect()
  }
}

function startRain(ctx: AudioContext, dest: GainNode): void {
  // Simulate rain with filtered white noise + occasional pops
  const bufferSize = 2 * ctx.sampleRate
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    // Base rain: filtered noise
    let sample = Math.random() * 2 - 1
    // Occasional "drop" spikes
    if (Math.random() < 0.003) {
      sample *= 4
    }
    data[i] = sample * 0.6
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const hpFilter = ctx.createBiquadFilter()
  hpFilter.type = 'highpass'
  hpFilter.frequency.value = 1000

  const lpFilter = ctx.createBiquadFilter()
  lpFilter.type = 'lowpass'
  lpFilter.frequency.value = 12000

  source.connect(hpFilter)
  hpFilter.connect(lpFilter)
  lpFilter.connect(dest)
  source.start()
}
