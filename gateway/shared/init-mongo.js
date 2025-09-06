// MongoDB Initialization Script for Meeshy
// This script is executed when MongoDB starts for the first time

print("🚀 Initializing Meeshy MongoDB database...");

// Switch to the meeshy database
db = db.getSiblingDB('meeshy');

// Create the main user for the application
db.createUser({
  user: "meeshy",
  pwd: "MeeshyPassword123",
  roles: [
    {
      role: "readWrite",
      db: "meeshy"
    },
    {
      role: "dbAdmin",
      db: "meeshy"
    }
  ]
});

print("✅ Created meeshy application user");

// Create collections with proper indexes for better performance
print("📋 Creating collections and indexes...");

// Users collection
db.createCollection("User");
db.User.createIndex({ "username": 1 }, { unique: true });
db.User.createIndex({ "email": 1 }, { unique: true });
db.User.createIndex({ "isOnline": 1 });
db.User.createIndex({ "lastActiveAt": 1 });
db.User.createIndex({ "createdAt": 1 });

print("✅ Created User collection with indexes");

// Conversations collection
db.createCollection("Conversation");
db.Conversation.createIndex({ "type": 1 });
db.Conversation.createIndex({ "isActive": 1 });
db.Conversation.createIndex({ "lastMessageAt": -1 });
db.Conversation.createIndex({ "createdAt": 1 });
db.Conversation.createIndex({ "communityId": 1 });

print("✅ Created Conversation collection with indexes");

// Messages collection
db.createCollection("Message");
db.Message.createIndex({ "conversationId": 1, "createdAt": -1 });
db.Message.createIndex({ "senderId": 1 });
db.Message.createIndex({ "anonymousSenderId": 1 });
db.Message.createIndex({ "messageType": 1 });
db.Message.createIndex({ "isDeleted": 1 });
db.Message.createIndex({ "originalLanguage": 1 });

print("✅ Created Message collection with indexes");

// MessageTranslation collection
db.createCollection("MessageTranslation");
db.MessageTranslation.createIndex({ "messageId": 1 });
db.MessageTranslation.createIndex({ "cacheKey": 1 }, { unique: true });
db.MessageTranslation.createIndex({ "sourceLanguage": 1, "targetLanguage": 1 });
db.MessageTranslation.createIndex({ "createdAt": 1 });

print("✅ Created MessageTranslation collection with indexes");

// ConversationMember collection
db.createCollection("ConversationMember");
db.ConversationMember.createIndex({ "conversationId": 1, "userId": 1 }, { unique: true });
db.ConversationMember.createIndex({ "userId": 1 });
db.ConversationMember.createIndex({ "role": 1 });
db.ConversationMember.createIndex({ "isActive": 1 });

print("✅ Created ConversationMember collection with indexes");

// AnonymousParticipant collection
db.createCollection("AnonymousParticipant");
db.AnonymousParticipant.createIndex({ "sessionToken": 1 }, { unique: true });
db.AnonymousParticipant.createIndex({ "shareLinkId": 1 });
db.AnonymousParticipant.createIndex({ "conversationId": 1 });
db.AnonymousParticipant.createIndex({ "isActive": 1 });
db.AnonymousParticipant.createIndex({ "lastActiveAt": 1 });

print("✅ Created AnonymousParticipant collection with indexes");

// ConversationShareLink collection
db.createCollection("ConversationShareLink");
db.ConversationShareLink.createIndex({ "linkId": 1 }, { unique: true });
db.ConversationShareLink.createIndex({ "conversationId": 1 });
db.ConversationShareLink.createIndex({ "isActive": 1 });
db.ConversationShareLink.createIndex({ "expiresAt": 1 });

print("✅ Created ConversationShareLink collection with indexes");

// Community collection
db.createCollection("Community");
db.Community.createIndex({ "name": 1 });
db.Community.createIndex({ "createdBy": 1 });
db.Community.createIndex({ "isPrivate": 1 });
db.Community.createIndex({ "createdAt": 1 });

print("✅ Created Community collection with indexes");

// TypingIndicator collection
db.createCollection("TypingIndicator");
db.TypingIndicator.createIndex({ "conversationId": 1, "userId": 1 }, { unique: true });
db.TypingIndicator.createIndex({ "conversationId": 1 });
db.TypingIndicator.createIndex({ "updatedAt": 1 });

print("✅ Created TypingIndicator collection with indexes");

// UserStats collection
db.createCollection("UserStats");
db.UserStats.createIndex({ "userId": 1 }, { unique: true });
db.UserStats.createIndex({ "lastActiveAt": 1 });

print("✅ Created UserStats collection with indexes");

// MessageReadStatus collection
db.createCollection("MessageReadStatus");
db.MessageReadStatus.createIndex({ "messageId": 1, "userId": 1 }, { unique: true });
db.MessageReadStatus.createIndex({ "userId": 1 });
db.MessageReadStatus.createIndex({ "readAt": 1 });

print("✅ Created MessageReadStatus collection with indexes");

// Create some initial data
print("📋 Creating initial data...");

// Create default admin user
db.User.insertOne({
  _id: ObjectId(),
  username: "admin",
  firstName: "Admin",
  lastName: "User",
  email: "admin@meeshy.com",
  password: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/DPGm4q3pW", // admin123
  displayName: "Administrator",
  isOnline: false,
  lastSeen: new Date(),
  lastActiveAt: new Date(),
  systemLanguage: "fr",
  regionalLanguage: "fr",
  autoTranslateEnabled: true,
  translateToSystemLanguage: true,
  translateToRegionalLanguage: false,
  useCustomDestination: false,
  role: "ADMIN",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

print("✅ Created default admin user (admin/admin123)");

// Create BigBoss user
db.User.insertOne({
  _id: ObjectId(),
  username: "bigboss",
  firstName: "Big",
  lastName: "Boss",
  email: "bigboss@meeshy.com",
  password: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/DPGm4q3pW", // bigboss123
  displayName: "Big Boss",
  isOnline: false,
  lastSeen: new Date(),
  lastActiveAt: new Date(),
  systemLanguage: "fr",
  regionalLanguage: "fr",
  autoTranslateEnabled: true,
  translateToSystemLanguage: true,
  translateToRegionalLanguage: false,
  useCustomDestination: false,
  role: "BIGBOSS",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

print("✅ Created BigBoss user (bigboss/bigboss123)");

// Create a public conversation for testing
var publicConversationId = ObjectId();
db.Conversation.insertOne({
  _id: publicConversationId,
  uuid: "public-welcome-conversation",
  type: "public",
  title: "Welcome to Meeshy",
  description: "Public conversation for new users",
  isActive: true,
  isArchived: false,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
});

print("✅ Created public welcome conversation");

// Add welcome message
db.Message.insertOne({
  _id: ObjectId(),
  conversationId: publicConversationId,
  content: "Bienvenue sur Meeshy ! Cette plateforme de messagerie multilingue vous permet de communiquer sans barrières linguistiques.",
  originalLanguage: "fr",
  messageType: "text",
  isEdited: false,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date()
});

print("✅ Created welcome message");

// Initialize replica set (for MongoDB transactions support)
try {
  rs.initiate({
    _id: "rs0",
    members: [
      { _id: 0, host: "localhost:27017" }
    ]
  });
  print("✅ Initialized replica set rs0");
} catch (e) {
  print("⚠️  Replica set may already be initialized: " + e.message);
}

print("🎉 Meeshy MongoDB database initialization completed!");
print("📊 Database statistics:");
print("- Collections created: " + db.getCollectionNames().length);
print("- Users created: " + db.User.countDocuments());
print("- Conversations created: " + db.Conversation.countDocuments());
print("- Messages created: " + db.Message.countDocuments());
print("");
print("🔐 Default users:");
print("- Admin: admin@meeshy.com / admin123");
print("- BigBoss: bigboss@meeshy.com / bigboss123");
print("- MongoDB: meeshy / MeeshyPassword123");
print("");
print("✅ Ready for Prisma client connections!");
