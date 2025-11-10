/**
 * AUDIO EFFECTS UTILITIES - PROFESSIONAL IMPLEMENTATION
 * Uses Tone.js for high-quality real-time voice effects
 *
 * Implements 4 audio effects:
 * 1. Voice Coder (auto-tune with harmonization)
 * 2. Baby Voice (high pitch with formant shift)
 * 3. Demon Voice (low pitch with distortion and reverb)
 * 4. Back Sound Code (background music)
 */

import * as Tone from 'tone';
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
  inputNode: Tone.ToneAudioNode;
  outputNode: Tone.ToneAudioNode;
  connect(destination: Tone.ToneAudioNode | AudioNode): void;
  disconnect(): void;
  updateParams(params: any): void;
  destroy(): void;
}

/**
 * Voice Coder Effect - Auto-tune with pitch correction
 * Uses Tone.PitchShift for professional pitch shifting
 */
export class VoiceCoderProcessor implements AudioEffectProcessor {
  inputNode: Tone.Gain;
  outputNode: Tone.Gain;
  private pitchShift: Tone.PitchShift;
  private chorus: Tone.Chorus;
  private wetDry: Tone.CrossFade;
  private params: VoiceCoderParams;

  constructor(params: VoiceCoderParams) {
    this.params = params;

    // Create audio nodes
    this.inputNode = new Tone.Gain(1);
    this.outputNode = new Tone.Gain(1);

    // Pitch shifter for auto-tune effect
    this.pitchShift = new Tone.PitchShift({
      pitch: params.pitch,
      windowSize: 0.1, // Smaller = more responsive, larger = better quality
      delayTime: 0, // No delay
      feedback: 0,
    });

    // Chorus for harmonization
    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      type: 'sine',
      spread: 180,
    }).start();

    // Wet/Dry mix for strength control
    this.wetDry = new Tone.CrossFade(params.strength / 100);

    // Connect nodes
    this.setupRouting();
  }

  private setupRouting(): void {
    // Disconnect everything first
    this.inputNode.disconnect();
    this.pitchShift.disconnect();
    this.chorus.disconnect();
    this.wetDry.disconnect();

    if (this.params.harmonization) {
      // Route: input -> pitchShift -> chorus -> wetDry -> output
      this.inputNode.connect(this.pitchShift);
      this.pitchShift.connect(this.chorus);
      this.chorus.connect(this.wetDry.b);
    } else {
      // Route: input -> pitchShift -> wetDry -> output
      this.inputNode.connect(this.pitchShift);
      this.pitchShift.connect(this.wetDry.b);
    }

    // Connect dry signal
    this.inputNode.connect(this.wetDry.a);

    // Connect to output
    this.wetDry.connect(this.outputNode);
  }

  connect(destination: Tone.ToneAudioNode | AudioNode): void {
    this.outputNode.connect(destination as any);
  }

  disconnect(): void {
    this.outputNode.disconnect();
  }

  updateParams(params: VoiceCoderParams): void {
    const needsReroute = this.params.harmonization !== params.harmonization;
    this.params = params;

    // Update pitch shift
    this.pitchShift.pitch = params.pitch;

    // Update wet/dry mix for strength
    this.wetDry.fade.value = params.strength / 100;

    // Re-route if harmonization changed
    if (needsReroute) {
      this.setupRouting();
    }
  }

  destroy(): void {
    this.disconnect();
    this.pitchShift.dispose();
    this.chorus.dispose();
    this.wetDry.dispose();
    this.inputNode.dispose();
    this.outputNode.dispose();
  }
}

/**
 * Baby Voice Effect - High pitch with formant shift
 */
export class BabyVoiceProcessor implements AudioEffectProcessor {
  inputNode: Tone.Gain;
  outputNode: Tone.Gain;
  private pitchShift: Tone.PitchShift;
  private filter: Tone.Filter;
  private noiseGain: Tone.Gain;
  private noise: Tone.Noise;
  private params: BabyVoiceParams;

  constructor(params: BabyVoiceParams) {
    this.params = params;

    // Create nodes
    this.inputNode = new Tone.Gain(1);
    this.outputNode = new Tone.Gain(1);

    // Pitch shift up for baby voice
    this.pitchShift = new Tone.PitchShift({
      pitch: params.pitch,
      windowSize: 0.05, // Smaller window for more natural baby voice
      delayTime: 0,
      feedback: 0,
    });

    // High-pass filter for formant shifting (makes voice brighter/thinner)
    this.filter = new Tone.Filter({
      type: 'highpass',
      frequency: 800 * params.formant,
      Q: 1,
      rolloff: -12,
    });

    // Noise for breathiness
    this.noise = new Tone.Noise('pink').start();
    this.noiseGain = new Tone.Gain(params.breathiness / 500); // Very subtle

    // Connect: input -> pitchShift -> filter -> output
    this.inputNode.connect(this.pitchShift);
    this.pitchShift.connect(this.filter);
    this.filter.connect(this.outputNode);

    // Add breathiness noise
    this.noise.connect(this.noiseGain);
    this.noiseGain.connect(this.outputNode);
  }

  connect(destination: Tone.ToneAudioNode | AudioNode): void {
    this.outputNode.connect(destination as any);
  }

  disconnect(): void {
    this.outputNode.disconnect();
  }

  updateParams(params: BabyVoiceParams): void {
    this.params = params;

    // Update pitch
    this.pitchShift.pitch = params.pitch;

    // Update formant (filter frequency)
    this.filter.frequency.value = 800 * params.formant;

    // Update breathiness
    this.noiseGain.gain.value = params.breathiness / 500;
  }

  destroy(): void {
    this.disconnect();
    this.pitchShift.dispose();
    this.filter.dispose();
    this.noise.stop();
    this.noise.dispose();
    this.noiseGain.dispose();
    this.inputNode.dispose();
    this.outputNode.dispose();
  }
}

/**
 * Demon Voice Effect - Low pitch with distortion and reverb
 */
export class DemonVoiceProcessor implements AudioEffectProcessor {
  inputNode: Tone.Gain;
  outputNode: Tone.Gain;
  private pitchShift: Tone.PitchShift;
  private distortion: Tone.Distortion;
  private reverb: Tone.Reverb;
  private filter: Tone.Filter;
  private params: DemonVoiceParams;

  constructor(params: DemonVoiceParams) {
    this.params = params;

    // Create nodes
    this.inputNode = new Tone.Gain(1);
    this.outputNode = new Tone.Gain(0.7); // Reduce overall gain to prevent clipping

    // Pitch shift down for demon voice
    this.pitchShift = new Tone.PitchShift({
      pitch: params.pitch,
      windowSize: 0.1,
      delayTime: 0,
      feedback: 0,
    });

    // Distortion for grit
    this.distortion = new Tone.Distortion({
      distortion: params.distortion / 100,
      oversample: '4x',
    });

    // Low-pass filter to make it darker/more menacing
    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 2000,
      Q: 0.5,
      rolloff: -24,
    });

    // Reverb for cathedral/demonic effect
    this.reverb = new Tone.Reverb({
      decay: 3 + (params.reverb / 100) * 5, // 3-8 seconds
      wet: params.reverb / 200, // Mix amount
    });

    // Generate reverb impulse response
    this.reverb.generate();

    // Connect: input -> pitchShift -> distortion -> filter -> reverb -> output
    this.inputNode.connect(this.pitchShift);
    this.pitchShift.connect(this.distortion);
    this.distortion.connect(this.filter);
    this.filter.connect(this.reverb);
    this.reverb.connect(this.outputNode);
  }

  connect(destination: Tone.ToneAudioNode | AudioNode): void {
    this.outputNode.connect(destination as any);
  }

  disconnect(): void {
    this.outputNode.disconnect();
  }

  updateParams(params: DemonVoiceParams): void {
    this.params = params;

    // Update pitch
    this.pitchShift.pitch = params.pitch;

    // Update distortion
    this.distortion.distortion = params.distortion / 100;

    // Update reverb
    this.reverb.decay = 3 + (params.reverb / 100) * 5;
    this.reverb.wet.value = params.reverb / 200;
  }

  destroy(): void {
    this.disconnect();
    this.pitchShift.dispose();
    this.distortion.dispose();
    this.filter.dispose();
    this.reverb.dispose();
    this.inputNode.dispose();
    this.outputNode.dispose();
  }
}

/**
 * Back Sound Code Effect - Background music/sound
 * Plays background audio that mixes with voice
 */
export class BackSoundProcessor implements AudioEffectProcessor {
  inputNode: Tone.Gain;
  outputNode: Tone.Gain;
  private player: Tone.Player | null = null;
  private playerGain: Tone.Gain;
  private params: BackSoundParams;
  private startTime: number = 0;
  private stopTimeout: number | null = null;

  constructor(params: BackSoundParams) {
    this.params = params;

    // Create nodes
    this.inputNode = new Tone.Gain(1);
    this.outputNode = new Tone.Gain(1);
    this.playerGain = new Tone.Gain(params.volume / 100);

    // Connect voice input directly to output
    this.inputNode.connect(this.outputNode);

    // Player will be connected when loaded
    this.playerGain.connect(this.outputNode);
  }

  async loadSound(url: string): Promise<void> {
    try {
      // Dispose old player if exists
      if (this.player) {
        this.player.stop();
        this.player.dispose();
      }

      // Create new player
      this.player = new Tone.Player({
        url,
        loop: true,
        volume: -10, // Reduce volume to blend better
        fadeIn: 0.5,
        fadeOut: 0.5,
      }).toDestination();

      // Connect player to gain
      this.player.connect(this.playerGain);

      // Wait for buffer to load
      await Tone.loaded();
    } catch (error) {
      console.error('[BackSoundProcessor] Failed to load sound:', error);
      throw error;
    }
  }

  async play(): Promise<void> {
    if (!this.player || !this.player.loaded) {
      console.warn('[BackSoundProcessor] Player not loaded');
      return;
    }

    // Clear any existing stop timeout
    if (this.stopTimeout !== null) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    // Start playback
    await Tone.start(); // Resume audio context if needed
    this.player.start();
    this.startTime = Tone.now();

    // Setup automatic stop based on loop mode
    if (this.params.loopMode === 'N_TIMES' && this.player.buffer) {
      const duration = this.player.buffer.duration * this.params.loopValue * 1000;
      this.stopTimeout = window.setTimeout(() => {
        this.stop();
      }, duration);
    } else if (this.params.loopMode === 'N_MINUTES') {
      const duration = this.params.loopValue * 60 * 1000;
      this.stopTimeout = window.setTimeout(() => {
        this.stop();
      }, duration);
    }
  }

  stop(): void {
    if (this.player) {
      this.player.stop();
    }

    if (this.stopTimeout !== null) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
  }

  connect(destination: Tone.ToneAudioNode | AudioNode): void {
    this.outputNode.connect(destination as any);
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
      this.playerGain.gain.rampTo(params.volume / 100, 0.1);
    }

    // Sound change will be handled externally by reloading
  }

  destroy(): void {
    this.stop();
    this.disconnect();

    if (this.player) {
      this.player.dispose();
    }

    this.playerGain.dispose();
    this.inputNode.dispose();
    this.outputNode.dispose();
  }
}

/**
 * Create appropriate processor for effect type
 */
export function createAudioEffectProcessor(
  type: 'voice-coder',
  params: VoiceCoderParams
): VoiceCoderProcessor;
export function createAudioEffectProcessor(
  type: 'baby-voice',
  params: BabyVoiceParams
): BabyVoiceProcessor;
export function createAudioEffectProcessor(
  type: 'demon-voice',
  params: DemonVoiceParams
): DemonVoiceProcessor;
export function createAudioEffectProcessor(
  type: 'back-sound',
  params: BackSoundParams
): BackSoundProcessor;
export function createAudioEffectProcessor(
  type: string,
  params: any
): AudioEffectProcessor {
  switch (type) {
    case 'voice-coder':
      return new VoiceCoderProcessor(params);
    case 'baby-voice':
      return new BabyVoiceProcessor(params);
    case 'demon-voice':
      return new DemonVoiceProcessor(params);
    case 'back-sound':
      return new BackSoundProcessor(params);
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
