/**
 * Voice Effects Processor
 * Applies various audio effects to MediaStream using Web Audio API
 */

export type VoiceEffectType =
  | 'none'
  | 'robot'
  | 'deep'
  | 'chipmunk'
  | 'echo'
  | 'reverb'
  | 'telephone'
  | 'cave';

export interface VoiceEffectSettings {
  type: VoiceEffectType;
  intensity: number; // 0-100
}

export class VoiceEffectsProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private currentEffect: VoiceEffectType = 'none';

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }

  /**
   * Apply voice effect to a media stream
   */
  applyEffect(inputStream: MediaStream, settings: VoiceEffectSettings): MediaStream {
    if (!this.audioContext || settings.type === 'none') {
      return inputStream;
    }

    try {
      // Clean up previous nodes
      this.cleanup();

      // Create nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      this.gainNode = this.audioContext.createGain();

      // Apply effect based on type
      switch (settings.type) {
        case 'robot':
          this.applyRobotEffect(settings.intensity);
          break;
        case 'deep':
          this.applyDeepEffect(settings.intensity);
          break;
        case 'chipmunk':
          this.applyChipmunkEffect(settings.intensity);
          break;
        case 'echo':
          this.applyEchoEffect(settings.intensity);
          break;
        case 'reverb':
          this.applyReverbEffect(settings.intensity);
          break;
        case 'telephone':
          this.applyTelephoneEffect(settings.intensity);
          break;
        case 'cave':
          this.applyCaveEffect(settings.intensity);
          break;
        default:
          // No effect - direct connection
          this.sourceNode.connect(this.destinationNode);
          break;
      }

      this.currentEffect = settings.type;

      // Return the processed stream
      return this.destinationNode.stream;
    } catch (error) {
      console.error('Failed to apply voice effect:', error);
      return inputStream;
    }
  }

  private applyRobotEffect(intensity: number) {
    if (!this.sourceNode || !this.destinationNode || !this.gainNode || !this.audioContext) return;

    // Create oscillator for modulation
    const oscillator = this.audioContext.createOscillator();
    const modulationGain = this.audioContext.createGain();

    oscillator.frequency.value = 30 * (intensity / 100); // Modulation frequency
    modulationGain.gain.value = 50 + (intensity * 2); // Modulation depth

    oscillator.connect(modulationGain);
    modulationGain.connect(this.gainNode.gain);

    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.destinationNode);

    oscillator.start();
  }

  private applyDeepEffect(intensity: number) {
    if (!this.sourceNode || !this.destinationNode || !this.audioContext) return;

    // Lower pitch using a buffer and playback rate
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000 - (intensity * 5); // Lower frequencies

    this.sourceNode.connect(filter);
    filter.connect(this.destinationNode);
  }

  private applyChipmunkEffect(intensity: number) {
    if (!this.sourceNode || !this.destinationNode || !this.audioContext) return;

    // Higher pitch
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 500 + (intensity * 10); // Higher frequencies

    this.sourceNode.connect(filter);
    filter.connect(this.destinationNode);
  }

  private applyEchoEffect(intensity: number) {
    if (!this.sourceNode || !this.destinationNode || !this.audioContext) return;

    this.delayNode = this.audioContext.createDelay();
    this.feedbackGain = this.audioContext.createGain();
    const wetGain = this.audioContext.createGain();
    const dryGain = this.audioContext.createGain();

    // Configure delay
    this.delayNode.delayTime.value = 0.3 + (intensity / 500); // 0.3-0.5s delay
    this.feedbackGain.gain.value = 0.3 + (intensity / 250); // Feedback amount
    wetGain.gain.value = intensity / 200; // Wet signal
    dryGain.gain.value = 1 - (intensity / 200); // Dry signal

    // Create echo chain
    this.sourceNode.connect(dryGain);
    dryGain.connect(this.destinationNode);

    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode); // Feedback loop
    this.delayNode.connect(wetGain);
    wetGain.connect(this.destinationNode);
  }

  private applyReverbEffect(intensity: number) {
    if (!this.sourceNode || !this.destinationNode || !this.audioContext) return;

    // Create simple reverb using convolver
    this.convolverNode = this.audioContext.createConvolver();
    const wetGain = this.audioContext.createGain();
    const dryGain = this.audioContext.createGain();

    wetGain.gain.value = intensity / 150;
    dryGain.gain.value = 1 - (intensity / 200);

    // Generate impulse response
    const length = this.audioContext.sampleRate * (1 + intensity / 100);
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }

    this.convolverNode.buffer = impulse;

    // Connect nodes
    this.sourceNode.connect(dryGain);
    dryGain.connect(this.destinationNode);

    this.sourceNode.connect(this.convolverNode);
    this.convolverNode.connect(wetGain);
    wetGain.connect(this.destinationNode);
  }

  private applyTelephoneEffect(intensity: number) {
    if (!this.sourceNode || !this.destinationNode || !this.audioContext) return;

    // Bandpass filter for telephone effect
    const lowpass = this.audioContext.createBiquadFilter();
    const highpass = this.audioContext.createBiquadFilter();
    const compressor = this.audioContext.createDynamicsCompressor();

    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3000 - (intensity * 10);

    highpass.type = 'highpass';
    highpass.frequency.value = 300 + (intensity * 2);

    this.sourceNode.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(this.destinationNode);
  }

  private applyCaveEffect(intensity: number) {
    if (!this.sourceNode || !this.destinationNode || !this.audioContext) return;

    // Large reverb + echo for cave effect
    this.convolverNode = this.audioContext.createConvolver();
    this.delayNode = this.audioContext.createDelay();
    const wetGain = this.audioContext.createGain();
    const dryGain = this.audioContext.createGain();

    this.delayNode.delayTime.value = 0.5 + (intensity / 200);
    wetGain.gain.value = intensity / 100;
    dryGain.gain.value = 0.5;

    // Generate long impulse response
    const length = this.audioContext.sampleRate * (2 + intensity / 50);
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 1.5);
      impulseL[i] = (Math.random() * 2 - 1) * decay;
      impulseR[i] = (Math.random() * 2 - 1) * decay;
    }

    this.convolverNode.buffer = impulse;

    // Connect nodes
    this.sourceNode.connect(dryGain);
    dryGain.connect(this.destinationNode);

    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.convolverNode);
    this.convolverNode.connect(wetGain);
    wetGain.connect(this.destinationNode);
  }

  /**
   * Get available effects with descriptions
   */
  static getAvailableEffects(): Array<{ value: VoiceEffectType; label: string; description: string; icon: string }> {
    return [
      { value: 'none', label: 'Normal', description: 'Your natural voice', icon: '🎤' },
      { value: 'robot', label: 'Robot', description: 'Robotic voice modulation', icon: '🤖' },
      { value: 'deep', label: 'Deep', description: 'Deeper, lower pitch', icon: '🐻' },
      { value: 'chipmunk', label: 'Chipmunk', description: 'Higher, faster pitch', icon: '🐿️' },
      { value: 'echo', label: 'Echo', description: 'Echo and delay effect', icon: '🔊' },
      { value: 'reverb', label: 'Reverb', description: 'Concert hall reverb', icon: '🎭' },
      { value: 'telephone', label: 'Telephone', description: 'Old phone quality', icon: '📞' },
      { value: 'cave', label: 'Cave', description: 'Large cave acoustics', icon: '🏔️' },
    ];
  }

  /**
   * Clean up audio nodes
   */
  cleanup() {
    try {
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      if (this.destinationNode) {
        this.destinationNode.disconnect();
        this.destinationNode = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.filterNode) {
        this.filterNode.disconnect();
        this.filterNode = null;
      }
      if (this.convolverNode) {
        this.convolverNode.disconnect();
        this.convolverNode = null;
      }
      if (this.delayNode) {
        this.delayNode.disconnect();
        this.delayNode = null;
      }
      if (this.feedbackGain) {
        this.feedbackGain.disconnect();
        this.feedbackGain = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Destroy the processor
   */
  destroy() {
    this.cleanup();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  getCurrentEffect(): VoiceEffectType {
    return this.currentEffect;
  }
}
