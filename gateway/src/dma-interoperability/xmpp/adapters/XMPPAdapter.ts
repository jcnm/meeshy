/**
 * XMPP Adapter
 *
 * Wraps custom XMPP implementation
 * Can be extended to use strophe.js
 */

import { IXMPPAdapter } from '../../adapters/LibraryAdapters';
import { XMPPClient, XMPPStanza } from '../XMPPClient';
import { DMAConfig } from '../../DMAInteroperabilityAdapter';

export class XMPPAdapter implements IXMPPAdapter {
  private client: XMPPClient;
  private config?: DMAConfig;

  constructor() {
    // Will be initialized on first use
    this.client = null as any;
  }

  async connect(
    server: string,
    port: number,
    username: string,
    password: string,
    tls: boolean = true
  ): Promise<void> {
    // Create config for custom XMPPClient
    this.config = {
      protocol: 'whatsapp-dma-interop',
      xmppServer: server,
      xmppPort: port,
      xmppVersion: '1.0',
      meeshyDomain: 'meeshy.app',
      meeshyServiceName: 'Meeshy Messaging',
      meeshyJID: `${username}@${server}`,
      meeshyPassword: password,
      enlistmentAPIPort: 3001,
      enlistmentAPISecret: 'secret-key'
    };

    this.client = new XMPPClient(this.config);
    await this.client.initialize();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  isConnected(): boolean {
    return this.client ? this.client.getStatus().connected : false;
  }

  async sendStanza(stanza: {
    type: 'message' | 'presence' | 'iq';
    to: string;
    body?: string;
    [key: string]: any;
  }): Promise<void> {
    const xmppStanza: XMPPStanza = {
      type: stanza.type,
      from: this.client.getStatus().jid || '',
      to: stanza.to,
      id: stanza.id || this.generateStanzaId(),
      timestamp: new Date().toISOString(),
      body: stanza.body,
      ...stanza
    };

    await this.client.sendStanza(xmppStanza);
  }

  onStanza(handler: (stanza: any) => void): void {
    // Register appropriate handler based on stanza type
    this.client.onMessage(async (stanza: XMPPStanza) => {
      handler(stanza);
    });

    this.client.onPresence(async (stanza: XMPPStanza) => {
      handler(stanza);
    });
  }

  getJID(): string {
    return this.client?.getStatus().jid || '';
  }

  getImplementation(): 'strophe' | 'custom' {
    return 'custom';
  }

  getVersion(): string {
    return 'xmpp-custom-v1';
  }

  /**
   * Helper: Generate stanza ID
   */
  private generateStanzaId(): string {
    return `stanza-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
