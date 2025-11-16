# @meeshy/mls-core

MLS (Messaging Layer Security) implementation for Meeshy - End-to-end encryption core library.

## Overview

This package provides the cryptographic foundations for end-to-end encrypted messaging in Meeshy, following the MLS protocol (RFC 9420) for DMA (Digital Markets Act) compliance.

**Phase 1**: Simple 1:1 conversations with TweetNaCl
**Phase 2+**: Full MLS protocol with OpenMLS (Rust bindings)

## Features

- ✅ **KeyPackage Management**: Generate and manage pre-keys for conversations
- ✅ **1:1 Encryption**: Secure messaging between two users
- ✅ **ECDH Key Agreement**: Using X25519 (Curve25519)
- ✅ **Authenticated Encryption**: Using NaCl's box construction
- ✅ **Type-Safe**: Full TypeScript strict mode
- ✅ **Secure Memory**: Automatic wiping of sensitive data
- 🚧 **Group Encryption**: Coming in Phase 2
- 🚧 **MLS Protocol**: Coming in Phase 2

## Installation

```bash
pnpm install @meeshy/mls-core
```

## Usage

### Basic Example

```typescript
import { MLSClient } from '@meeshy/mls-core';

// Initialize client for a user
const alice = new MLSClient('alice-user-id');
const bob = new MLSClient('bob-user-id');

// Generate KeyPackages
const aliceKeyPackages = alice.generateKeyPackages(5);
const bobKeyPackages = bob.generateKeyPackages(5);

// Establish encrypted conversation
const conversationId = 'conv_123';

await alice.establishConversation(
  conversationId,
  aliceKeyPackages[0].keyPackageId,
  bobKeyPackages[0].publicKey
);

await bob.establishConversation(
  conversationId,
  bobKeyPackages[0].keyPackageId,
  aliceKeyPackages[0].publicKey
);

// Encrypt and send message
const encrypted = await alice.encryptMessage(conversationId, 'Hello Bob!');
console.log(encrypted);
// {
//   ciphertext: 'base64...',
//   nonce: 'base64...',
//   senderKeyHash: 'base64...',
//   encryptionType: 'mls_1to1',
//   groupEpoch: 0
// }

// Decrypt received message
const decrypted = await bob.decryptMessage(
  conversationId,
  encrypted.ciphertext,
  encrypted.nonce
);
console.log(decrypted); // "Hello Bob!"
```

### KeyPackage Management

```typescript
import { KeyPackageManager } from '@meeshy/mls-core';

const manager = new KeyPackageManager('user-id');

// Generate multiple KeyPackages
const keyPackages = manager.generateKeyPackages(5);

// Get available KeyPackages
const available = manager.getAvailableKeyPackages();

// Cleanup expired KeyPackages
const deleted = manager.cleanupExpired();

// Get statistics
const stats = manager.getStats();
console.log(stats);
// { total: 5, available: 5, expired: 0 }
```

### Cryptographic Utilities

```typescript
import { crypto } from '@meeshy/mls-core';

// Generate key pair
const keyPair = crypto.generateKeyPair();

// Compute shared secret (ECDH)
const sharedSecret = crypto.computeSharedSecret(
  theirPublicKey,
  mySecretKey
);

// Encrypt with shared secret
const { ciphertext, nonce } = crypto.encryptWithSharedSecret(
  messageBytes,
  sharedSecret
);

// Decrypt
const plaintext = crypto.decryptWithSharedSecret(
  ciphertext,
  nonce,
  sharedSecret
);

// Sign message
const signature = crypto.signMessage(messageBytes, secretKey);

// Verify signature
const valid = crypto.verifySignature(messageBytes, signature, publicKey);
```

## API Reference

### `MLSClient`

Main client for MLS operations.

#### Methods

- `generateKeyPackages(count: number)`: Generate KeyPackages
- `getAvailableKeyPackages()`: Get available KeyPackages
- `establishConversation(conversationId, myKeyPackageId, theirPublicKey)`: Establish encrypted conversation
- `isConversationEstablished(conversationId)`: Check if conversation is established
- `encryptMessage(conversationId, plaintext)`: Encrypt a message
- `decryptMessage(conversationId, ciphertext, nonce)`: Decrypt a message
- `closeConversation(conversationId)`: Close and cleanup conversation
- `cleanupExpiredKeyPackages()`: Cleanup expired KeyPackages
- `getConversationStats()`: Get conversation statistics
- `getKeyPackageStats()`: Get KeyPackage statistics

### `KeyPackageManager`

Manages KeyPackage lifecycle.

#### Methods

- `generateKeyPackage(cipherSuite?)`: Generate single KeyPackage
- `generateKeyPackages(count, cipherSuite?)`: Generate multiple KeyPackages
- `getKeyPackage(keyPackageId)`: Get KeyPackage by ID
- `getSecretKey(keyPackageId)`: Get secret key
- `getPublicKey(keyPackageId)`: Get public key
- `isExpired(keyPackageId)`: Check if KeyPackage is expired
- `deleteKeyPackage(keyPackageId)`: Delete KeyPackage
- `cleanupExpired()`: Cleanup expired KeyPackages
- `getAvailableKeyPackages()`: Get all available KeyPackages
- `getStats()`: Get statistics

### `crypto` utilities

Low-level cryptographic functions.

See source code for full API reference.

## Security Considerations

### Phase 1 (Current)

- ⚠️ Uses simplified key derivation (NOT suitable for production passwords)
- ⚠️ No forward secrecy rotation yet
- ⚠️ Basic ECDH key agreement
- ✅ Secure memory wiping
- ✅ Constant-time comparisons
- ✅ Authenticated encryption

### Phase 2+ (Planned)

- Full MLS protocol implementation
- Forward secrecy with ratcheting
- Proper PBKDF2/Argon2 for passwords
- X.509 certificate support
- Group key management
- External audit

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## Build

```bash
# Build TypeScript
pnpm build

# Type check
pnpm typecheck
```

## Contributing

This package is part of the Meeshy monorepo. See root README for contributing guidelines.

## License

UNLICENSED - Proprietary to Meeshy

## References

- [RFC 9420 - The Messaging Layer Security (MLS) Protocol](https://datatracker.ietf.org/doc/rfc9420/)
- [TweetNaCl.js](https://tweetnacl.js.org/)
- [Digital Markets Act](https://digital-markets-act.ec.europa.eu/)

## Support

For questions or issues, contact the Meeshy team.
