/**
 * Signal Protocol Service
 *
 * High-level service for Signal Protocol operations:
 * - Pre-key bundle generation (X3DH)
 * - Session establishment
 * - Message encryption (Double Ratchet)
 * - Message decryption
 * - Group messaging with Sender Keys
 */

import {
  ProtocolAddress,
  PreKeyBundle,
  PreKeyRecord,
  SignedPreKeyRecord,
  KyberPreKeyRecord,
  KEMKeyPair,
  PrivateKey,
  PublicKey,
  IdentityKeyPair,
  processPreKeyBundle,
  signalEncrypt,
  signalDecrypt,
  signalDecryptPreKey,
  PreKeySignalMessage,
  SignalMessage,
  CiphertextMessage,
  groupEncrypt,
  groupDecrypt,
  SenderKeyDistributionMessage,
  processSenderKeyDistributionMessage,
  Uuid,
  IdentityKeyStore,
  SessionStore,
  PreKeyStore,
  SignedPreKeyStore,
  KyberPreKeyStore,
  SenderKeyStore,
} from '@signalapp/libsignal-client';

import type {
  PreKeyBundle as PreKeyBundleType,
  SignalEncryptedMessage,
  SignalMessageType,
  SignalSessionState,
} from './signal-types';

const PREKEY_COUNT = 100;
const PREKEY_START_ID = 1;

/**
 * Signal Protocol Service
 *
 * Provides high-level encryption/decryption using Signal Protocol
 */
export class SignalProtocolService {
  private identityStore: IdentityKeyStore;
  private sessionStore: SessionStore;
  private preKeyStore: PreKeyStore;
  private signedPreKeyStore: SignedPreKeyStore;
  private kyberPreKeyStore: KyberPreKeyStore;
  private senderKeyStore: SenderKeyStore;
  private deviceId: number;

  constructor(
    stores: {
      identityStore: IdentityKeyStore;
      sessionStore: SessionStore;
      preKeyStore: PreKeyStore;
      signedPreKeyStore: SignedPreKeyStore;
      kyberPreKeyStore: KyberPreKeyStore;
      senderKeyStore: SenderKeyStore;
    },
    deviceId: number = 1
  ) {
    this.identityStore = stores.identityStore;
    this.sessionStore = stores.sessionStore;
    this.preKeyStore = stores.preKeyStore;
    this.signedPreKeyStore = stores.signedPreKeyStore;
    this.kyberPreKeyStore = stores.kyberPreKeyStore;
    this.senderKeyStore = stores.senderKeyStore;
    this.deviceId = deviceId;
  }

  /**
   * Generate pre-key bundle for X3DH key agreement
   *
   * This bundle is uploaded to the server and retrieved by other users
   * to establish an encrypted session.
   */
  async generatePreKeyBundle(): Promise<PreKeyBundleType> {
    const identityKey = await this.identityStore.getIdentityKey();
    const identityPublicKey = identityKey.getPublicKey();
    const registrationId = await this.identityStore.getLocalRegistrationId();

    // Generate signed pre-key
    const signedPreKeyId = Date.now();
    const signedPreKeyPrivate = PrivateKey.generate();
    const signedPreKeyPublic = signedPreKeyPrivate.getPublicKey();
    const signedPreKeySignature = identityKey.sign(signedPreKeyPublic.serialize());

    const signedPreKeyRecord = SignedPreKeyRecord.new(
      signedPreKeyId,
      Date.now(),
      signedPreKeyPublic,
      signedPreKeyPrivate,
      signedPreKeySignature
    );

    await this.signedPreKeyStore.saveSignedPreKey(signedPreKeyId, signedPreKeyRecord);

    // Generate one-time pre-keys
    const preKeyId = Math.floor(Math.random() * 0xffffff);
    const preKeyPrivate = PrivateKey.generate();
    const preKeyPublic = preKeyPrivate.getPublicKey();
    const preKeyRecord = PreKeyRecord.new(preKeyId, preKeyPublic, preKeyPrivate);

    await this.preKeyStore.savePreKey(preKeyId, preKeyRecord);

    // Generate Kyber pre-key (post-quantum)
    const kyberPreKeyId = Date.now();
    const kyberKeyPair = KEMKeyPair.generate();
    const kyberPreKeyPublic = kyberKeyPair.getPublicKey();
    const kyberPreKeySignature = identityKey.sign(kyberPreKeyPublic.serialize());

    const kyberPreKeyRecord = KyberPreKeyRecord.new(
      kyberPreKeyId,
      Date.now(),
      kyberKeyPair,
      kyberPreKeySignature
    );

    await this.kyberPreKeyStore.saveKyberPreKey(kyberPreKeyId, kyberPreKeyRecord);

    return {
      registrationId,
      deviceId: this.deviceId,
      preKeyId,
      preKeyPublic: preKeyPublic.serialize(),
      signedPreKeyId,
      signedPreKeyPublic: signedPreKeyPublic.serialize(),
      signedPreKeySignature,
      identityKey: identityPublicKey.serialize(),
      kyberPreKeyId,
      kyberPreKeyPublic: kyberPreKeyPublic.serialize(),
      kyberPreKeySignature,
    };
  }

  /**
   * Generate multiple pre-keys for replenishment
   */
  async generatePreKeys(startId: number, count: number): Promise<number[]> {
    const preKeyIds: number[] = [];

    for (let i = 0; i < count; i++) {
      const preKeyId = startId + i;
      const preKeyPrivate = PrivateKey.generate();
      const preKeyPublic = preKeyPrivate.getPublicKey();
      const preKeyRecord = PreKeyRecord.new(preKeyId, preKeyPublic, preKeyPrivate);

      await this.preKeyStore.savePreKey(preKeyId, preKeyRecord);
      preKeyIds.push(preKeyId);
    }

    return preKeyIds;
  }

  /**
   * Process pre-key bundle to establish session (X3DH)
   *
   * This is called by the initiator to establish an encrypted session
   * with the recipient using their pre-key bundle.
   */
  async processPreKeyBundle(
    recipientAddress: ProtocolAddress,
    bundle: PreKeyBundleType
  ): Promise<void> {
    // Reconstruct PreKeyBundle from serialized data
    const preKeyPublic = bundle.preKeyPublic
      ? PublicKey.deserialize(Buffer.from(bundle.preKeyPublic))
      : null;

    const kyberPreKeyPublic = bundle.kyberPreKeyPublic
      ? KEMKeyPair.generate().getPublicKey() // TODO: deserialize properly
      : null;

    const signalBundle = PreKeyBundle.new(
      bundle.registrationId,
      bundle.deviceId,
      bundle.preKeyId ?? null,
      preKeyPublic,
      bundle.signedPreKeyId,
      PublicKey.deserialize(Buffer.from(bundle.signedPreKeyPublic)),
      Buffer.from(bundle.signedPreKeySignature),
      PublicKey.deserialize(Buffer.from(bundle.identityKey)),
      bundle.kyberPreKeyId,
      kyberPreKeyPublic,
      bundle.kyberPreKeySignature ? Buffer.from(bundle.kyberPreKeySignature) : null
    );

    // Process bundle to establish session
    await processPreKeyBundle(signalBundle, recipientAddress, this.sessionStore, this.identityStore);
  }

  /**
   * Encrypt message using Double Ratchet algorithm
   *
   * Returns encrypted message that can be decrypted only by the recipient.
   * Provides forward secrecy - past messages cannot be decrypted if current keys are compromised.
   */
  async encryptMessage(
    recipientAddress: ProtocolAddress,
    plaintext: string
  ): Promise<SignalEncryptedMessage> {
    const plaintextBuffer = Buffer.from(plaintext, 'utf8');

    const ciphertext = await signalEncrypt(
      plaintextBuffer,
      recipientAddress,
      this.sessionStore,
      this.identityStore
    );

    const registrationId = await this.identityStore.getLocalRegistrationId();

    return {
      type: ciphertext.type() as SignalMessageType,
      registrationId,
      body: ciphertext.serialize(),
      deviceId: this.deviceId,
    };
  }

  /**
   * Decrypt message using Double Ratchet algorithm
   *
   * Handles both PreKeyMessages (first message) and regular SignalMessages.
   */
  async decryptMessage(
    senderAddress: ProtocolAddress,
    message: SignalEncryptedMessage
  ): Promise<string> {
    let plaintext: Buffer;

    if (message.type === 3) {
      // PreKeyMessage - first message in conversation
      const preKeyMessage = PreKeySignalMessage.deserialize(Buffer.from(message.body));

      plaintext = await signalDecryptPreKey(
        preKeyMessage,
        senderAddress,
        this.sessionStore,
        this.identityStore,
        this.preKeyStore,
        this.signedPreKeyStore,
        this.kyberPreKeyStore
      );

      // Remove used pre-key
      const preKeyId = preKeyMessage.preKeyId();
      if (preKeyId !== null) {
        await this.preKeyStore.removePreKey(preKeyId);
      }
    } else {
      // Regular SignalMessage
      const signalMessage = SignalMessage.deserialize(Buffer.from(message.body));

      plaintext = await signalDecrypt(signalMessage, senderAddress, this.sessionStore, this.identityStore);
    }

    return plaintext.toString('utf8');
  }

  /**
   * Check if a session exists with the given address
   */
  async hasSession(recipientAddress: ProtocolAddress): Promise<boolean> {
    const session = await this.sessionStore.getSession(recipientAddress);
    return session !== null && session.hasCurrentState();
  }

  /**
   * Get session state information
   */
  async getSessionState(recipientAddress: ProtocolAddress): Promise<SignalSessionState> {
    const session = await this.sessionStore.getSession(recipientAddress);

    return {
      hasSession: session !== null && session.hasCurrentState(),
      recipientAddress: recipientAddress.name(),
      deviceId: recipientAddress.deviceId(),
    };
  }

  /**
   * Create sender key distribution message for group encryption
   *
   * Sender keys allow efficient group messaging - each message is encrypted once
   * rather than once per recipient.
   */
  async createSenderKeyDistributionMessage(
    groupId: string,
    distributionId: Uuid
  ): Promise<Uint8Array> {
    const senderAddress = ProtocolAddress.new(groupId, this.deviceId);

    const message = await SenderKeyDistributionMessage.create(
      senderAddress,
      distributionId,
      this.senderKeyStore
    );

    return message.serialize();
  }

  /**
   * Process sender key distribution message to enable group decryption
   */
  async processSenderKeyDistributionMessage(
    senderAddress: ProtocolAddress,
    distributionId: Uuid,
    messageData: Uint8Array
  ): Promise<void> {
    const message = SenderKeyDistributionMessage.deserialize(Buffer.from(messageData));
    await processSenderKeyDistributionMessage(senderAddress, message, this.senderKeyStore);
  }

  /**
   * Encrypt group message using sender key
   */
  async encryptGroupMessage(
    groupId: string,
    distributionId: Uuid,
    plaintext: string
  ): Promise<Uint8Array> {
    const senderAddress = ProtocolAddress.new(groupId, this.deviceId);
    const plaintextBuffer = Buffer.from(plaintext, 'utf8');

    const ciphertext = await groupEncrypt(senderAddress, distributionId, this.senderKeyStore, plaintextBuffer);

    return ciphertext.serialize();
  }

  /**
   * Decrypt group message using sender key
   */
  async decryptGroupMessage(senderAddress: ProtocolAddress, ciphertext: Uint8Array): Promise<string> {
    const plaintext = await groupDecrypt(senderAddress, this.senderKeyStore, Buffer.from(ciphertext));

    return plaintext.toString('utf8');
  }

  /**
   * Get registration ID
   */
  async getRegistrationId(): Promise<number> {
    return await this.identityStore.getLocalRegistrationId();
  }

  /**
   * Get identity key
   */
  async getIdentityKey(): Promise<Uint8Array> {
    const identityKey = await this.identityStore.getIdentityKey();
    return identityKey.getPublicKey().serialize();
  }
}
