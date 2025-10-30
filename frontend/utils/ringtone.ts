/**
 * RINGTONE UTILITY
 * Generates a pleasant ringtone using Web Audio API
 * No external audio files needed!
 */

export class Ringtone {
  private audioContext: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNode: GainNode | null = null;
  private isPlaying = false;

  /**
   * Start playing the ringtone
   */
  async play(): Promise<void> {
    if (this.isPlaying) {
      return;
    }

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 0.3; // 30% volume

      this.isPlaying = true;

      // Play ringtone pattern (classic two-tone ring)
      this.playRingPattern();
    } catch (error) {
      console.error('[Ringtone] Failed to play:', error);
    }
  }

  /**
   * Stop playing the ringtone
   */
  stop(): void {
    if (!this.isPlaying) {
      return;
    }

    this.isPlaying = false;

    // Stop all oscillators
    this.oscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
      }
    });
    this.oscillators = [];

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.gainNode = null;
  }

  /**
   * Play the ring pattern (two tones alternating)
   */
  private playRingPattern(): void {
    if (!this.audioContext || !this.gainNode || !this.isPlaying) {
      return;
    }

    const freq1 = 523.25; // C5 note
    const freq2 = 659.25; // E5 note
    const currentTime = this.audioContext.currentTime;

    // Create oscillator for first tone (0.4 seconds)
    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq1;
    osc1.connect(this.gainNode);
    osc1.start(currentTime);
    osc1.stop(currentTime + 0.4);
    this.oscillators.push(osc1);

    // Create oscillator for second tone (0.4 seconds, starts after first)
    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq2;
    osc2.connect(this.gainNode);
    osc2.start(currentTime + 0.4);
    osc2.stop(currentTime + 0.8);
    this.oscillators.push(osc2);

    // Schedule next ring after 1.5 second pause
    setTimeout(() => {
      if (this.isPlaying) {
        // Clear old oscillators
        this.oscillators = [];
        this.playRingPattern();
      }
    }, 2300); // 0.8s tone + 1.5s pause
  }
}

// Singleton instance
let ringtoneInstance: Ringtone | null = null;

/**
 * Get or create ringtone instance
 */
export function getRingtone(): Ringtone {
  if (!ringtoneInstance) {
    ringtoneInstance = new Ringtone();
  }
  return ringtoneInstance;
}

/**
 * Play ringtone
 */
export function playRingtone(): void {
  getRingtone().play();
}

/**
 * Stop ringtone
 */
export function stopRingtone(): void {
  getRingtone().stop();
}
