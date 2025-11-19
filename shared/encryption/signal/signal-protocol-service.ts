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
  PrivateKey,
  PublicKey,
  processPreKeyBundle,
  signalEncrypt,
  signalDecrypt,
  signalDecryptPreKey,
  PreKeySignalMessage,
  SignalMessage,
  CiphertextMessage,
  groupEncrypt,
  groupDecrypt,
  createSenderKeyDistributionMessage,
  processSenderKeyDistributionMessage,
} from '@signalapp/libsignal-client';

import type { SignalProtocolStores } from './signal-store-interface';
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
  private stores: SignalProtocolStores;
  private deviceId: number;

  constructor(stores: SignalProtocolStores, deviceId: number = 1) {
    this.stores = stores;
    this.deviceId = deviceId;
  }

  /**
   * Generate pre-key bundle for X3DH key agreement
   *
   * This bundle is uploaded to the server and retrieved by other users
   * to establish an encrypted session.
   */
  async generatePreKeyBundle(): Promise<PreKeyBundleType> {
    const identityKeyPair = await this.stores.identityStore.getIdentityKeyPair();
    const registrationId = await this.stores.identityStore.getLocalRegistrationId();

    // Generate signed pre-key
    const signedPreKeyId = Date.now();
    const signedPreKeyPair = PrivateKey.generate();
    const signedPreKeyPublic = signedPreKeyPair.getPublicKey();
    const signedPreKeySignature = identityKeyPair
      .privateKey()
      .sign(signedPreKeyPublic.serialize());

    const signedPreKeyRecord = SignedPreKeyRecord.new(
      signedPreKeyId,
      Date.now(),
      signedPreKeyPair.getPublicKey(),
      signedPreKeyPair,
      signedPreKeySignature
    );

    await this.stores.signedPreKeyStore.saveSignedPreKey(signedPreKeyId, signedPreKeyRecord);

    // Generate one-time pre-keys
    const preKeyId = Math.floor(Math.random() * 0xffffff);
    const preKeyPair = PrivateKey.generate();
    const preKeyRecord = PreKeyRecord.new(preKeyId, preKeyPair.getPublicKey(), preKeyPair);

    await this.stores.preKeyStore.savePreKey(preKeyId, preKeyRecord);

    // Generate Kyber pre-key (post-quantum)
    const kyberPreKeyId = Date.now();
    const kyberKeyPair = PrivateKey.generate(); // In real implementation, use Kyber key generation
    const kyberPreKeyPublic = kyberKeyPair.getPublicKey();
    const kyberPreKeySignature = identityKeyPair.privateKey().sign(kyberPreKeyPublic.serialize());

    const kyberPreKeyRecord = KyberPreKeyRecord.new(
      kyberPreKeyId,
      Date.now(),
      kyberKeyPair,
      kyberPreKeySignature
    );

    await this.stores.kyberPreKeyStore.saveKyberPreKey(kyberPreKeyId, kyberPreKeyRecord);

    return {
      registrationId,
      deviceId: this.deviceId,
      preKeyId,
      preKeyPublic: preKeyPair.getPublicKey().serialize(),
      signedPreKeyId,
      signedPreKeyPublic: signedPreKeyPublic.serialize(),
      signedPreKeySignature,
      identityKey: identityKeyPair.publicKey().serialize(),
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
      const preKeyPair = PrivateKey.generate();
      const preKeyRecord = PreKeyRecord.new(preKeyId, preKeyPair.getPublicKey(), preKeyPair);

      await this.stores.preKeyStore.savePreKey(preKeyId, preKeyRecord);
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

    const signalBundle = PreKeyBundle.new(
      bundle.registrationId,
      bundle.deviceId,
      bundle.preKeyId,
      preKeyPublic,
      bundle.signedPreKeyId,
      PublicKey.deserialize(Buffer.from(bundle.signedPreKeyPublic)),
      Buffer.from(bundle.signedPreKeySignature),
      PublicKey.deserialize(Buffer.from(bundle.identityKey))
    );

    // Process bundle to establish session
    await processPreKeyBundle(
      signalBundle,
      recipientAddress,
      this.stores.sessionStore,
      this.stores.identityStore
    );
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
      this.stores.sessionStore,
      this.stores.identityStore
    );

    const registrationId = await this.stores.identityStore.getLocalRegistrationId();

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
        this.stores.sessionStore,
        this.stores.identityStore,
        this.stores.preKeyStore,
        this.stores.signedPreKeyStore,
        this.stores.kyberPreKeyStore
      );

      // Remove used pre-key
      const preKeyId = preKeyMessage.preKeyId();
      if (preKeyId !== null) {
        await this.stores.preKeyStore.removePreKey(preKeyId);
      }
    } else {
      // Regular SignalMessage
      const signalMessage = SignalMessage.deserialize(Buffer.from(message.body));

      plaintext = await signalDecrypt(
        signalMessage,
        senderAddress,
        this.stores.sessionStore,
        this.stores.identityStore
      );
    }

    return plaintext.toString('utf8');
  }

  /**
   * Check if a session exists with the given address
   */
  async hasSession(recipientAddress: ProtocolAddress): Promise<boolean> {
    const session = await this.stores.sessionStore.getSession(recipientAddress);
    return session !== null;
  }

  /**
   * Get session state information
   */
  async getSessionState(recipientAddress: ProtocolAddress): Promise<SignalSessionState> {
    const session = await this.stores.sessionStore.getSession(recipientAddress);

    return {
      hasSession: session !== null,
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
    distributionId: string
  ): Promise<Uint8Array> {
    const senderAddress = ProtocolAddress.new(groupId, this.deviceId);

    const message = await createSenderKeyDistributionMessage(
      senderAddress,
      Buffer.from(distributionId),
      this.stores.senderKeyStore
    );

    return message.serialize();
  }

  /**
   * Process sender key distribution message to enable group decryption
   */
  async processSenderKeyDistributionMessage(
    senderAddress: ProtocolAddress,
    distributionId: string,
    message: Uint8Array
  ): Promise<void> {
    await processSenderKeyDistributionMessage(
      senderAddress,
      message,
      this.stores.senderKeyStore
    );
  }

  /**
   * Encrypt group message using sender key
   */
  async encryptGroupMessage(
    groupId: string,
    distributionId: string,
    plaintext: string
  ): Promise<Uint8Array> {
    const senderAddress = ProtocolAddress.new(groupId, this.deviceId);
    const plaintextBuffer = Buffer.from(plaintext, 'utf8');

    const ciphertext = await groupEncrypt(
      senderAddress,
      Buffer.from(distributionId),
      plaintextBuffer,
      this.stores.senderKeyStore
    );

    return ciphertext;
  }

  /**
   * Decrypt group message using sender key
   */
  async decryptGroupMessage(
    senderAddress: ProtocolAddress,
    ciphertext: Uint8Array
  ): Promise<string> {
    const plaintext = await groupDecrypt(
      senderAddress,
      ciphertext,
      this.stores.senderKeyStore
    );

    return plaintext.toString('utf8');
  }

  /**
   * Get registration ID
   */
  async getRegistrationId(): Promise<number> {
    return await this.stores.identityStore.getLocalRegistrationId();
  }

  /**
   * Get identity key
   */
  async getIdentityKey(): Promise<Uint8Array> {
    const identityKeyPair = await this.stores.identityStore.getIdentityKeyPair();
    return identityKeyPair.publicKey().serialize();
  }
}
