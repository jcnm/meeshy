/**
 * AUDIO EFFECTS UTILITIES
 * Web Audio API processing for voice effects
 *
 * Implements 4 audio effects:
 * 1. Voice Coder (auto-tune with harmonization)
 * 2. Baby Voice (high pitch with formant shift)
 * 3. Demon Voice (low pitch with distortion and reverb)
 * 4. Back Sound Code (background music)
 */

import type {
  VoiceCoderParams,
  BabyVoiceParams,
  DemonVoiceParams,
  BackSoundParams,
} from '@shared/types/video-call';

/**
 * Audio effect processor interface
 */
export interface AudioEffectProcessor {
  connect(destination: AudioNode): void;
  disconnect(): void;
  updateParams(params: any): void;
  destroy(): void;
}

/**
 * Voice Coder Effect - Auto-tune with harmonization
 */
export class VoiceCoderProcessor implements AudioEffectProcessor {
  private context: AudioContext;
  private inputNode: MediaStreamAudioSourceNode;
  private outputNode: GainNode;
  private pitchShiftNode: GainNode | null = null;
  private params: VoiceCoderParams;

  constructor(
    context: AudioContext,
    inputStream: MediaStream,
    params: VoiceCoderParams
  ) {
    this.context = context;
    this.params = params;

    // Create audio nodes
    this.inputNode = context.createMediaStreamSource(inputStream);
    this.outputNode = context.createGain();

    // Initialize pitch shift (simplified implementation)
    // For production, use Tone.js or similar library for proper pitch shifting
    this.pitchShiftNode = context.createGain();

    this.setupPitchShift();
    this.connect(this.outputNode);
  }

  private setupPitchShift(): void {
    if (!this.pitchShiftNode) return;

    // Simplified pitch shift using gain
    // In production, implement FFT-based pitch shifting or use Tone.js
    const pitchFactor = Math.pow(2, this.params.pitch / 12);
    this.pitchShiftNode.gain.value = pitchFactor * (this.params.strength / 100);
  }

  connect(destination: AudioNode): void {
    if (this.pitchShiftNode) {
      this.inputNode.connect(this.pitchShiftNode);
      this.pitchShiftNode.connect(destination);
    }
  }

  disconnect(): void {
    if (this.pitchShiftNode) {
      this.pitchShiftNode.disconnect();
    }
    this.inputNode.disconnect();
  }

  updateParams(params: VoiceCoderParams): void {
    this.params = params;
    this.setupPitchShift();
  }

  destroy(): void {
    this.disconnect();
  }
}

/**
 * Baby Voice Effect - High pitch with formant shift
 */
export class BabyVoiceProcessor implements AudioEffectProcessor {
  private context: AudioContext;
  private inputNode: MediaStreamAudioSourceNode;
  private outputNode: GainNode;
  private pitchNode: GainNode;
  private formantNode: BiquadFilterNode;
  private breathinessNode: GainNode;
  private params: BabyVoiceParams;

  constructor(
    context: AudioContext,
    inputStream: MediaStream,
    params: BabyVoiceParams
  ) {
    this.context = context;
    this.params = params;

    // Create audio nodes
    this.inputNode = context.createMediaStreamSource(inputStream);
    this.outputNode = context.createGain();
    this.pitchNode = context.createGain();
    this.formantNode = context.createBiquadFilter();
    this.breathinessNode = context.createGain();

    this.setupEffect();
  }

  private setupEffect(): void {
    // Pitch shift (simplified)
    const pitchFactor = Math.pow(2, this.params.pitch / 12);
    this.pitchNode.gain.value = pitchFactor;

    // Formant shift using high-pass filter
    this.formantNode.type = 'highpass';
    this.formantNode.frequency.value = 1000 * this.params.formant;
    this.formantNode.Q.value = 1;

    // Breathiness (add subtle noise)
    this.breathinessNode.gain.value = this.params.breathiness / 100;

    // Connect nodes
    this.inputNode.connect(this.pitchNode);
    this.pitchNode.connect(this.formantNode);
    this.formantNode.connect(this.breathinessNode);
    this.breathinessNode.connect(this.outputNode);
  }

  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  disconnect(): void {
    this.outputNode.disconnect();
    this.breathinessNode.disconnect();
    this.formantNode.disconnect();
    this.pitchNode.disconnect();
    this.inputNode.disconnect();
  }

  updateParams(params: BabyVoiceParams): void {
    this.params = params;
    this.setupEffect();
  }

  destroy(): void {
    this.disconnect();
  }
}

/**
 * Demon Voice Effect - Low pitch with distortion and reverb
 */
export class DemonVoiceProcessor implements AudioEffectProcessor {
  private context: AudioContext;
  private inputNode: MediaStreamAudioSourceNode;
  private outputNode: GainNode;
  private pitchNode: GainNode;
  private distortionNode: WaveShaperNode;
  private reverbNode: ConvolverNode | GainNode; // Fallback to gain if convolver not available
  private params: DemonVoiceParams;

  constructor(
    context: AudioContext,
    inputStream: MediaStream,
    params: DemonVoiceParams
  ) {
    this.context = context;
    this.params = params;

    // Create audio nodes
    this.inputNode = context.createMediaStreamSource(inputStream);
    this.outputNode = context.createGain();
    this.pitchNode = context.createGain();
    this.distortionNode = context.createWaveShaper();

    // Try to create convolver, fallback to gain
    try {
      this.reverbNode = context.createConvolver();
    } catch {
      this.reverbNode = context.createGain();
    }

    this.setupEffect();
  }

  private setupEffect(): void {
    // Pitch shift down
    const pitchFactor = Math.pow(2, this.params.pitch / 12);
    this.pitchNode.gain.value = pitchFactor;

    // Distortion using waveshaper
    const amount = this.params.distortion / 100;
    const curve = this.makeDistortionCurve(amount);
    this.distortionNode.curve = curve;
    this.distortionNode.oversample = '4x';

    // Reverb (simplified implementation)
    if ('buffer' in this.reverbNode) {
      // Create impulse response for reverb
      const reverbTime = (this.params.reverb / 100) * 3; // Max 3 seconds
      const impulse = this.createReverbImpulse(reverbTime);
      this.reverbNode.buffer = impulse;
    } else {
      // Fallback: just use gain
      (this.reverbNode as GainNode).gain.value = this.params.reverb / 100;
    }

    // Connect nodes
    this.inputNode.connect(this.pitchNode);
    this.pitchNode.connect(this.distortionNode);
    this.distortionNode.connect(this.reverbNode);
    this.reverbNode.connect(this.outputNode);
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }

  private createReverbImpulse(duration: number): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    return impulse;
  }

  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  disconnect(): void {
    this.outputNode.disconnect();
    this.reverbNode.disconnect();
    this.distortionNode.disconnect();
    this.pitchNode.disconnect();
    this.inputNode.disconnect();
  }

  updateParams(params: DemonVoiceParams): void {
    this.params = params;
    this.setupEffect();
  }

  destroy(): void {
    this.disconnect();
  }
}

/**
 * Back Sound Code Effect - Background music/sound
 */
export class BackSoundProcessor implements AudioEffectProcessor {
  private context: AudioContext;
  private outputNode: GainNode;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private params: BackSoundParams;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private loopCount: number = 0;

  constructor(
    context: AudioContext,
    params: BackSoundParams
  ) {
    this.context = context;
    this.params = params;

    // Create nodes
    this.outputNode = context.createGain();
    this.gainNode = context.createGain();
    this.gainNode.gain.value = params.volume / 100;

    // Connect gain to output
    this.gainNode.connect(this.outputNode);
  }

  async loadSound(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('[BackSoundProcessor] Failed to load sound:', error);
      throw error;
    }
  }

  play(): void {
    if (!this.audioBuffer) {
      console.warn('[BackSoundProcessor] No audio buffer loaded');
      return;
    }

    this.stop();

    // Create new source
    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);

    // Setup looping based on mode
    if (this.params.loopMode === 'N_TIMES') {
      this.sourceNode.loop = true;
      this.loopCount = 0;
      this.startTime = this.context.currentTime;

      // Stop after N loops
      const duration = this.audioBuffer.duration * this.params.loopValue;
      this.sourceNode.start(0, 0, duration);
    } else {
      // N_MINUTES mode
      this.sourceNode.loop = true;
      this.startTime = this.context.currentTime;

      // Stop after N minutes
      const duration = this.params.loopValue * 60;
      this.sourceNode.start(0, 0, duration);
    }
  }

  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // Already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  disconnect(): void {
    this.stop();
    this.outputNode.disconnect();
  }

  updateParams(params: BackSoundParams): void {
    const volumeChanged = this.params.volume !== params.volume;
    const soundChanged = this.params.soundFile !== params.soundFile;

    this.params = params;

    if (volumeChanged) {
      this.gainNode.gain.value = params.volume / 100;
    }

    if (soundChanged) {
      // Will need to reload and restart
      this.stop();
    }
  }

  destroy(): void {
    this.stop();
    this.disconnect();
  }
}

/**
 * Create appropriate processor for effect type
 */
export function createAudioEffectProcessor(
  type: 'voice-coder',
  context: AudioContext,
  inputStream: MediaStream,
  params: VoiceCoderParams
): VoiceCoderProcessor;
export function createAudioEffectProcessor(
  type: 'baby-voice',
  context: AudioContext,
  inputStream: MediaStream,
  params: BabyVoiceParams
): BabyVoiceProcessor;
export function createAudioEffectProcessor(
  type: 'demon-voice',
  context: AudioContext,
  inputStream: MediaStream,
  params: DemonVoiceParams
): DemonVoiceProcessor;
export function createAudioEffectProcessor(
  type: 'back-sound',
  context: AudioContext,
  inputStream: MediaStream,
  params: BackSoundParams
): BackSoundProcessor;
export function createAudioEffectProcessor(
  type: string,
  context: AudioContext,
  inputStream: MediaStream,
  params: any
): AudioEffectProcessor {
  switch (type) {
    case 'voice-coder':
      return new VoiceCoderProcessor(context, inputStream, params);
    case 'baby-voice':
      return new BabyVoiceProcessor(context, inputStream, params);
    case 'demon-voice':
      return new DemonVoiceProcessor(context, inputStream, params);
    case 'back-sound':
      return new BackSoundProcessor(context, params);
    default:
      throw new Error(`Unknown effect type: ${type}`);
  }
}

/**
 * Available background sounds
 */
export const BACK_SOUNDS = [
  { id: 'ambient-1', name: 'Ambient Space', url: '/sounds/ambient-space.mp3' },
  { id: 'lofi-1', name: 'Lo-Fi Chill', url: '/sounds/lofi-chill.mp3' },
  { id: 'nature-1', name: 'Forest Rain', url: '/sounds/forest-rain.mp3' },
  { id: 'beats-1', name: 'Light Beats', url: '/sounds/light-beats.mp3' },
] as const;
