// MongoDB initialization script for Meeshy Signal DMA Phase 3
// This script creates collections and indices for production DMA database

print("=== Meeshy Signal DMA - MongoDB Initialization ===\n");

// Switch to meeshy-dma database
db = db.getSiblingDB('meeshy-dma');

print("Creating DMA collections and indices...\n");

// ===== DMA_ENROLLMENTS Collection =====
print("Creating dma_enrollments collection...");
db.createCollection("dma_enrollments");

// Create indices for enrollments
db.dma_enrollments.createIndex({ userId: 1 }, { name: "idx_userId" });
db.dma_enrollments.createIndex({ status: 1 }, { name: "idx_status" });
db.dma_enrollments.createIndex({ createdAt: 1 }, { name: "idx_createdAt" });
db.dma_enrollments.createIndex(
  { userId: 1, whatsappInternalId: 1 },
  { unique: true, name: "idx_user_whatsapp_unique" }
);
print("✓ dma_enrollments: 4 indices created\n");

// ===== DMA_OFFLINE_MESSAGES Collection =====
print("Creating dma_offline_messages collection...");
db.createCollection("dma_offline_messages");

// Create indices for offline messages with TTL
db.dma_offline_messages.createIndex({ enrollmentId: 1 }, { name: "idx_enrollmentId" });
db.dma_offline_messages.createIndex({ delivered: 1 }, { name: "idx_delivered" });
db.dma_offline_messages.createIndex(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,  // Use expiresAt as TTL
    name: "idx_expiresAt_ttl"
  }
);
db.dma_offline_messages.createIndex(
  { messageId: 1 },
  { unique: true, name: "idx_messageId_unique" }
);
db.dma_offline_messages.createIndex(
  { deliveryId: 1 },
  { unique: true, name: "idx_deliveryId_unique" }
);
db.dma_offline_messages.createIndex({ storedAt: 1 }, { name: "idx_storedAt" });
print("✓ dma_offline_messages: 6 indices created (with TTL for 30-day retention)\n");

// ===== DMA_SESSIONS Collection =====
print("Creating dma_sessions collection...");
db.createCollection("dma_sessions");

// Create indices for sessions
db.dma_sessions.createIndex({ enrollmentId: 1 }, { name: "idx_enrollmentId" });
db.dma_sessions.createIndex({ sessionState: 1 }, { name: "idx_sessionState" });
db.dma_sessions.createIndex({ createdAt: 1 }, { name: "idx_createdAt" });
db.dma_sessions.createIndex(
  { enrollmentId: 1, remotePartyId: 1, sessionType: 1 },
  { unique: true, name: "idx_enrollment_remote_type_unique" }
);
print("✓ dma_sessions: 4 indices created\n");

// ===== DMA_MESSAGE_STATUSES Collection =====
print("Creating dma_message_statuses collection...");
db.createCollection("dma_message_statuses");

// Create indices for message statuses
db.dma_message_statuses.createIndex({ enrollmentId: 1 }, { name: "idx_enrollmentId" });
db.dma_message_statuses.createIndex({ status: 1 }, { name: "idx_status" });
db.dma_message_statuses.createIndex({ createdAt: 1 }, { name: "idx_createdAt" });
db.dma_message_statuses.createIndex({ deliveredAt: 1 }, { name: "idx_deliveredAt" });
db.dma_message_statuses.createIndex(
  { messageId: 1 },
  { unique: true, name: "idx_messageId_unique" }
);
print("✓ dma_message_statuses: 5 indices created\n");

// ===== Validation & Summary =====
print("=== Collection Summary ===");
let stats = {};

// Get collection stats
["dma_enrollments", "dma_offline_messages", "dma_sessions", "dma_message_statuses"].forEach(
  collection => {
    let collStats = db[collection].stats();
    stats[collection] = {
      count: collStats.count || 0,
      avgDocumentSize: collStats.avgObjSize || 0,
      indices: db[collection].getIndexes().length
    };

    print(
      collection +
        ": " +
        stats[collection].count +
        " documents, " +
        stats[collection].indices +
        " indices"
    );
  }
);

// Create admin database with user management
db = db.getSiblingDB('admin');

// Display summary
print("\n=== Initialization Complete ===");
print("Database: meeshy-dma");
print("Collections: 4 (DMAEnrollment, DMAOfflineMessage, DMASession, DMAMessageStatus)");
print("Total Indices: 19");
print("TTL Index: dma_offline_messages (30-day automatic cleanup)");
print("Unique Constraints: 5");
print("\nReady for Phase 3 testing and production deployment!");
