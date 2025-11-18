/**
 * Mock implementation of @signalapp/libsignal-client for testing
 */

export enum CiphertextMessageType {
  Whisper = 2,
  PreKey = 3,
}

export enum Direction {
  Sending = 0,
  Receiving = 1,
}

export enum IdentityChange {
  NewOrUnchanged = 0,
  ReplacedExisting = 1,
}

export class PrivateKey {
  private key: Uint8Array;

  constructor(key?: Uint8Array) {
    this.key = key || crypto.getRandomValues(new Uint8Array(32));
  }

  static generate(): PrivateKey {
    return new PrivateKey();
  }

  getPublicKey(): PublicKey {
    // In real implementation, this would derive the public key
    return new PublicKey(this.key);
  }

  sign(data: Uint8Array): Uint8Array {
    // Mock signature
    return new Uint8Array(64);
  }

  serialize(): Uint8Array {
    return this.key;
  }
}

export class PublicKey {
  private key: Uint8Array;

  constructor(key: Uint8Array) {
    this.key = key;
  }

  static deserialize(buffer: Uint8Array): PublicKey {
    return new PublicKey(buffer);
  }

  serialize(): Uint8Array {
    return this.key;
  }

  compare(other: PublicKey): number {
    // Compare byte arrays
    const a = this.key;
    const b = other.key;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        return a[i] - b[i];
      }
    }
    return a.length - b.length;
  }
}

export class KEMKeyPair {
  private publicKey: KEMPublicKey;
  private secretKey: KEMSecretKey;

  constructor() {
    this.publicKey = new KEMPublicKey(crypto.getRandomValues(new Uint8Array(32)));
    this.secretKey = new KEMSecretKey(crypto.getRandomValues(new Uint8Array(32)));
  }

  static generate(): KEMKeyPair {
    return new KEMKeyPair();
  }

  getPublicKey(): KEMPublicKey {
    return this.publicKey;
  }

  getSecretKey(): KEMSecretKey {
    return this.secretKey;
  }
}

export class KEMPublicKey {
  private key: Uint8Array;

  constructor(key: Uint8Array) {
    this.key = key;
  }

  serialize(): Uint8Array {
    return this.key;
  }
}

export class KEMSecretKey {
  private key: Uint8Array;

  constructor(key: Uint8Array) {
    this.key = key;
  }

  serialize(): Uint8Array {
    return this.key;
  }
}

export class ProtocolAddress {
  private _name: string;
  private _deviceId: number;

  private constructor(name: string, deviceId: number) {
    this._name = name;
    this._deviceId = deviceId;
  }

  static new(name: string, deviceId: number): ProtocolAddress {
    return new ProtocolAddress(name, deviceId);
  }

  name(): string {
    return this._name;
  }

  deviceId(): number {
    return this._deviceId;
  }
}

export class PreKeyRecord {
  private _id: number;
  private _publicKey: PublicKey;
  private _privateKey: PrivateKey;

  private constructor(id: number, publicKey: PublicKey, privateKey: PrivateKey) {
    this._id = id;
    this._publicKey = publicKey;
    this._privateKey = privateKey;
  }

  static new(id: number, publicKey: PublicKey, privateKey: PrivateKey): PreKeyRecord {
    return new PreKeyRecord(id, publicKey, privateKey);
  }

  id(): number {
    return this._id;
  }

  publicKey(): PublicKey {
    return this._publicKey;
  }

  privateKey(): PrivateKey {
    return this._privateKey;
  }

  serialize(): Uint8Array {
    return new Uint8Array(64);
  }
}

export class SignedPreKeyRecord {
  private _id: number;
  private _timestamp: number;
  private _publicKey: PublicKey;
  private _privateKey: PrivateKey;
  private _signature: Uint8Array;

  private constructor(
    id: number,
    timestamp: number,
    publicKey: PublicKey,
    privateKey: PrivateKey,
    signature: Uint8Array
  ) {
    this._id = id;
    this._timestamp = timestamp;
    this._publicKey = publicKey;
    this._privateKey = privateKey;
    this._signature = signature;
  }

  static new(
    id: number,
    timestamp: number,
    publicKey: PublicKey,
    privateKey: PrivateKey,
    signature: Uint8Array
  ): SignedPreKeyRecord {
    return new SignedPreKeyRecord(id, timestamp, publicKey, privateKey, signature);
  }

  id(): number {
    return this._id;
  }

  timestamp(): number {
    return this._timestamp;
  }

  publicKey(): PublicKey {
    return this._publicKey;
  }

  privateKey(): PrivateKey {
    return this._privateKey;
  }

  signature(): Uint8Array {
    return this._signature;
  }

  serialize(): Uint8Array {
    return new Uint8Array(128);
  }
}

export class KyberPreKeyRecord {
  private _id: number;
  private _timestamp: number;
  private _keyPair: KEMKeyPair;
  private _signature: Uint8Array;

  private constructor(
    id: number,
    timestamp: number,
    keyPair: KEMKeyPair,
    signature: Uint8Array
  ) {
    this._id = id;
    this._timestamp = timestamp;
    this._keyPair = keyPair;
    this._signature = signature;
  }

  static new(
    id: number,
    timestamp: number,
    keyPair: KEMKeyPair,
    signature: Uint8Array
  ): KyberPreKeyRecord {
    return new KyberPreKeyRecord(id, timestamp, keyPair, signature);
  }

  id(): number {
    return this._id;
  }

  timestamp(): number {
    return this._timestamp;
  }

  keyPair(): KEMKeyPair {
    return this._keyPair;
  }

  publicKey(): KEMPublicKey {
    return this._keyPair.getPublicKey();
  }

  secretKey(): KEMSecretKey {
    return this._keyPair.getSecretKey();
  }

  signature(): Uint8Array {
    return this._signature;
  }

  serialize(): Uint8Array {
    return new Uint8Array(128);
  }
}

export class PreKeyBundle {
  private _registrationId: number;
  private _deviceId: number;
  private _preKeyId: number | null;
  private _preKey: PublicKey | null;
  private _signedPreKeyId: number;
  private _signedPreKey: PublicKey;
  private _signedPreKeySignature: Uint8Array;
  private _identityKey: PublicKey;
  private _kyberPreKeyId: number;
  private _kyberPreKey: KEMPublicKey;
  private _kyberPreKeySignature: Uint8Array;

  private constructor(
    registrationId: number,
    deviceId: number,
    preKeyId: number | null,
    preKey: PublicKey | null,
    signedPreKeyId: number,
    signedPreKey: PublicKey,
    signedPreKeySignature: Uint8Array,
    identityKey: PublicKey,
    kyberPreKeyId: number,
    kyberPreKey: KEMPublicKey,
    kyberPreKeySignature: Uint8Array
  ) {
    this._registrationId = registrationId;
    this._deviceId = deviceId;
    this._preKeyId = preKeyId;
    this._preKey = preKey;
    this._signedPreKeyId = signedPreKeyId;
    this._signedPreKey = signedPreKey;
    this._signedPreKeySignature = signedPreKeySignature;
    this._identityKey = identityKey;
    this._kyberPreKeyId = kyberPreKeyId;
    this._kyberPreKey = kyberPreKey;
    this._kyberPreKeySignature = kyberPreKeySignature;
  }

  static new(
    registrationId: number,
    deviceId: number,
    preKeyId: number | null,
    preKey: PublicKey | null,
    signedPreKeyId: number,
    signedPreKey: PublicKey,
    signedPreKeySignature: Uint8Array,
    identityKey: PublicKey,
    kyberPreKeyId: number,
    kyberPreKey: KEMPublicKey,
    kyberPreKeySignature: Uint8Array
  ): PreKeyBundle {
    return new PreKeyBundle(
      registrationId,
      deviceId,
      preKeyId,
      preKey,
      signedPreKeyId,
      signedPreKey,
      signedPreKeySignature,
      identityKey,
      kyberPreKeyId,
      kyberPreKey,
      kyberPreKeySignature
    );
  }

  registrationId(): number {
    return this._registrationId;
  }

  deviceId(): number {
    return this._deviceId;
  }

  preKeyId(): number | null {
    return this._preKeyId;
  }

  preKeyPublic(): PublicKey | null {
    return this._preKey;
  }

  signedPreKeyId(): number {
    return this._signedPreKeyId;
  }

  signedPreKeyPublic(): PublicKey {
    return this._signedPreKey;
  }

  signedPreKeySignature(): Uint8Array {
    return this._signedPreKeySignature;
  }

  identityKey(): PublicKey {
    return this._identityKey;
  }

  kyberPreKeyId(): number {
    return this._kyberPreKeyId;
  }

  kyberPreKeyPublic(): KEMPublicKey {
    return this._kyberPreKey;
  }

  kyberPreKeySignature(): Uint8Array {
    return this._kyberPreKeySignature;
  }
}

export class SessionRecord {
  private data: Uint8Array;

  constructor(data?: Uint8Array) {
    this.data = data || new Uint8Array(256);
  }

  static deserialize(buffer: Uint8Array): SessionRecord {
    return new SessionRecord(buffer);
  }

  serialize(): Uint8Array {
    return this.data;
  }

  localRegistrationId(): number {
    return 0;
  }

  remoteRegistrationId(): number {
    return 0;
  }

  hasCurrentState(): boolean {
    return true;
  }
}

export class CiphertextMessage {
  private _type: number;
  private _body: Uint8Array;

  constructor(type: number, body: Uint8Array) {
    this._type = type;
    this._body = body;
  }

  type(): number {
    return this._type;
  }

  serialize(): Uint8Array {
    return this._body;
  }
}

export class SignalMessage {
  private data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  static deserialize(buffer: Uint8Array): SignalMessage {
    return new SignalMessage(buffer);
  }

  serialize(): Uint8Array {
    return this.data;
  }
}

export class PreKeySignalMessage {
  private data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  static deserialize(buffer: Uint8Array): PreKeySignalMessage {
    return new PreKeySignalMessage(buffer);
  }

  serialize(): Uint8Array {
    return this.data;
  }

  preKeyId(): number | null {
    return 1;
  }

  signedPreKeyId(): number {
    return 1;
  }

  registrationId(): number {
    return 0;
  }
}

// Store implementations
export abstract class SessionStore {
  abstract saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void>;
  abstract getSession(name: ProtocolAddress): Promise<SessionRecord | null>;
  abstract getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]>;
}

export abstract class IdentityKeyStore {
  abstract getIdentityKey(): Promise<PrivateKey>;
  abstract getLocalRegistrationId(): Promise<number>;
  abstract saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<IdentityChange>;
  abstract isTrustedIdentity(name: ProtocolAddress, key: PublicKey, direction: Direction): Promise<boolean>;
  abstract getIdentity(name: ProtocolAddress): Promise<PublicKey | null>;
}

export abstract class PreKeyStore {
  abstract savePreKey(id: number, record: PreKeyRecord): Promise<void>;
  abstract getPreKey(id: number): Promise<PreKeyRecord>;
  abstract removePreKey(id: number): Promise<void>;
}

export abstract class SignedPreKeyStore {
  abstract saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void>;
  abstract getSignedPreKey(id: number): Promise<SignedPreKeyRecord>;
}

export abstract class KyberPreKeyStore {
  abstract saveKyberPreKey(id: number, record: KyberPreKeyRecord): Promise<void>;
  abstract getKyberPreKey(id: number): Promise<KyberPreKeyRecord>;
  abstract markKyberPreKeyUsed(kyberPreKeyId: number, signedPreKeyId: number, baseKey: PublicKey): Promise<void>;
}

// Protocol functions
export async function processPreKeyBundle(
  bundle: PreKeyBundle,
  address: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore
): Promise<void> {
  // Mock implementation - just save a session
  await sessionStore.saveSession(address, new SessionRecord());
  await identityStore.saveIdentity(address, bundle.identityKey());
}

export async function signalEncrypt(
  message: Uint8Array,
  address: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore
): Promise<CiphertextMessage> {
  // Mock encryption
  const session = await sessionStore.getSession(address);
  const type = session ? CiphertextMessageType.Whisper : CiphertextMessageType.PreKey;
  const encrypted = new Uint8Array(message.length + 16);
  encrypted.set(message);
  return new CiphertextMessage(type, encrypted);
}

export async function signalDecrypt(
  message: SignalMessage,
  address: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore
): Promise<Uint8Array> {
  // Mock decryption
  const data = message.serialize();
  return data.slice(0, data.length - 16);
}

export async function signalDecryptPreKey(
  message: PreKeySignalMessage,
  address: ProtocolAddress,
  sessionStore: SessionStore,
  identityStore: IdentityKeyStore,
  prekeyStore: PreKeyStore,
  signedPrekeyStore: SignedPreKeyStore,
  kyberPrekeyStore: KyberPreKeyStore
): Promise<Uint8Array> {
  // Mock decryption
  const data = message.serialize();
  // Save session after decrypting prekey message
  await sessionStore.saveSession(address, new SessionRecord());
  return data.slice(0, data.length - 16);
}
