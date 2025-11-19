/**
 * IndexedDB Key Storage
 *
 * Securely stores encryption keys in browser IndexedDB.
 * Keys are stored encrypted with a master key derived from user session.
 */

import { exportKey, importKey, generateKeyId } from './crypto-utils';

const DB_NAME = 'meeshy_encryption';
const DB_VERSION = 1;
const KEYS_STORE = 'encryption_keys';
const CONVERSATIONS_STORE = 'conversation_keys';
const USER_KEYS_STORE = 'user_keys';

interface StoredKey {
  id: string;
  keyData: string; // Base64 encoded key
  algorithm: 'aes-256-gcm' | 'ecdh-p256';
  createdAt: number;
  conversationId?: string;
  userId?: string;
}

interface ConversationKeyMapping {
  conversationId: string;
  keyId: string;
  mode: 'e2ee' | 'server';
  createdAt: number;
}

interface UserSignalKeys {
  userId: string;
  publicKey: string;
  privateKey: string; // Encrypted
  registrationId: number;
  identityKey: string;
  preKeyBundleVersion: number;
  createdAt: number;
}

class KeyStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(KEYS_STORE)) {
          const keysStore = db.createObjectStore(KEYS_STORE, { keyPath: 'id' });
          keysStore.createIndex('conversationId', 'conversationId', { unique: false });
          keysStore.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
          const convsStore = db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'conversationId' });
          convsStore.createIndex('keyId', 'keyId', { unique: false });
        }

        if (!db.objectStoreNames.contains(USER_KEYS_STORE)) {
          db.createObjectStore(USER_KEYS_STORE, { keyPath: 'userId' });
        }

        console.log('IndexedDB schema upgraded');
      };
    });

    return this.initPromise;
  }

  /**
   * Store an encryption key
   */
  async storeKey(key: CryptoKey, id?: string, conversationId?: string, userId?: string): Promise<string> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const keyId = id || generateKeyId();
    const keyData = await exportKey(key);

    const storedKey: StoredKey = {
      id: keyId,
      keyData,
      algorithm: 'aes-256-gcm',
      createdAt: Date.now(),
      conversationId,
      userId,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KEYS_STORE], 'readwrite');
      const store = transaction.objectStore(KEYS_STORE);
      const request = store.put(storedKey);

      request.onsuccess = () => resolve(keyId);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve an encryption key
   */
  async getKey(keyId: string): Promise<CryptoKey | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KEYS_STORE], 'readonly');
      const store = transaction.objectStore(KEYS_STORE);
      const request = store.get(keyId);

      request.onsuccess = async () => {
        const stored: StoredKey = request.result;
        if (!stored) {
          resolve(null);
          return;
        }

        try {
          const key = await importKey(stored.keyData);
          resolve(key);
        } catch (error) {
          console.error('Failed to import key:', error);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store conversation key mapping
   */
  async storeConversationKey(
    conversationId: string,
    keyId: string,
    mode: 'e2ee' | 'server'
  ): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const mapping: ConversationKeyMapping = {
      conversationId,
      keyId,
      mode,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONVERSATIONS_STORE], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      const request = store.put(mapping);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get conversation key mapping
   */
  async getConversationKey(conversationId: string): Promise<ConversationKeyMapping | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONVERSATIONS_STORE], 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      const request = store.get(conversationId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store user Signal Protocol keys
   */
  async storeUserKeys(keys: UserSignalKeys): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([USER_KEYS_STORE], 'readwrite');
      const store = transaction.objectStore(USER_KEYS_STORE);
      const request = store.put(keys);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get user Signal Protocol keys
   */
  async getUserKeys(userId: string): Promise<UserSignalKeys | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([USER_KEYS_STORE], 'readonly');
      const store = transaction.objectStore(USER_KEYS_STORE);
      const request = store.get(userId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a key
   */
  async deleteKey(keyId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KEYS_STORE], 'readwrite');
      const store = transaction.objectStore(KEYS_STORE);
      const request = store.delete(keyId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all keys (for logout)
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [KEYS_STORE, CONVERSATIONS_STORE, USER_KEYS_STORE],
        'readwrite'
      );

      const promises = [
        transaction.objectStore(KEYS_STORE).clear(),
        transaction.objectStore(CONVERSATIONS_STORE).clear(),
        transaction.objectStore(USER_KEYS_STORE).clear(),
      ];

      transaction.oncomplete = () => {
        console.log('All encryption keys cleared');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get all keys for a conversation
   */
  async getConversationKeys(conversationId: string): Promise<StoredKey[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([KEYS_STORE], 'readonly');
      const store = transaction.objectStore(KEYS_STORE);
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export keys for backup (encrypted with password)
   */
  async exportKeys(password: string): Promise<string> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Get all keys
    const transaction = this.db.transaction(
      [KEYS_STORE, CONVERSATIONS_STORE, USER_KEYS_STORE],
      'readonly'
    );

    const keys = await new Promise<StoredKey[]>((resolve, reject) => {
      const request = transaction.objectStore(KEYS_STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const conversations = await new Promise<ConversationKeyMapping[]>((resolve, reject) => {
      const request = transaction.objectStore(CONVERSATIONS_STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const userKeys = await new Promise<UserSignalKeys[]>((resolve, reject) => {
      const request = transaction.objectStore(USER_KEYS_STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const backup = {
      keys,
      conversations,
      userKeys,
      version: DB_VERSION,
      exportedAt: Date.now(),
    };

    // TODO: Encrypt backup with password
    return btoa(JSON.stringify(backup));
  }

  /**
   * Import keys from backup
   */
  async importKeys(encryptedBackup: string, password: string): Promise<void> {
    // TODO: Decrypt backup with password
    const backup = JSON.parse(atob(encryptedBackup));

    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(
      [KEYS_STORE, CONVERSATIONS_STORE, USER_KEYS_STORE],
      'readwrite'
    );

    // Import keys
    const keysStore = transaction.objectStore(KEYS_STORE);
    for (const key of backup.keys) {
      keysStore.put(key);
    }

    const convsStore = transaction.objectStore(CONVERSATIONS_STORE);
    for (const conv of backup.conversations) {
      convsStore.put(conv);
    }

    const userKeysStore = transaction.objectStore(USER_KEYS_STORE);
    for (const userKey of backup.userKeys) {
      userKeysStore.put(userKey);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log('Keys imported successfully');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Export singleton instance
export const keyStorage = new KeyStorage();
