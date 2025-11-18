/**
 * Noise Protocol Adapter
 *
 * Wraps custom Noise Protocol implementation
 * Can be extended to use libnoiser or other Noise libraries
 */

import { INoiseAdapter } from '../../adapters/LibraryAdapters';
import { NoiseProtocol } from '../NoiseProtocol';

export class NoiseAdapter implements INoiseAdapter {
  private noise: NoiseProtocol;

  constructor() {
    this.noise = new NoiseProtocol();
  }

  async initiateHandshake(sessionId: string): Promise<{ ephemeralPublicKey: Buffer; sessionData: any }> {
    const { session, handshakeMessage } = this.noise.initiateHandshake(sessionId);

    return {
      ephemeralPublicKey: handshakeMessage.ephemeralPublicKey!,
      sessionData: {
        sessionId,
        state: session
      }
    };
  }

  async respondToHandshake(
    sessionId: string,
    initiatorEphemeralPublicKey: Buffer
  ): Promise<{ ephemeralPublicKey: Buffer; sessionData: any }> {
    const { session, handshakeMessage } = this.noise.respondToHandshake(
      sessionId,
      initiatorEphemeralPublicKey
    );

    return {
      ephemeralPublicKey: handshakeMessage.ephemeralPublicKey!,
      sessionData: {
        sessionId,
        state: session
      }
    };
  }

  async completeHandshake(sessionId: string, responderEphemeralPublicKey: Buffer): Promise<void> {
    this.noise.completeHandshake(sessionId, responderEphemeralPublicKey);
  }

  async encryptTransport(sessionId: string, plaintext: Buffer): Promise<Buffer> {
    return this.noise.encryptMessage(sessionId, plaintext);
  }

  async decryptTransport(sessionId: string, ciphertext: Buffer): Promise<Buffer> {
    return this.noise.decryptMessage(sessionId, ciphertext);
  }

  isSessionReady(sessionId: string): boolean {
    return this.noise.isSessionReady(sessionId);
  }

  getImplementation(): 'libnoiser' | 'custom' {
    return 'custom';
  }

  getVersion(): string {
    return 'noise-protocol-v1-custom';
  }
}
