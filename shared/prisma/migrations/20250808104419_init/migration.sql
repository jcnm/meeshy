/*
  Warnings:

  - You are about to drop the column `groupId` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `group_members` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `maxMembers` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `groups` table. All the data in the column will be lost.
  - Added the required column `createdBy` to the `groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `groups` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "message_translations" ADD COLUMN "confidenceScore" REAL;

-- CreateTable
CREATE TABLE "anonymous_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "email" TEXT,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canSendMessages" BOOLEAN NOT NULL DEFAULT true,
    "canSendFiles" BOOLEAN NOT NULL DEFAULT false,
    "canSendImages" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "anonymous_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "anonymous_participants_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "conversation_share_links" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "maxMembers" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "communities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "community_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_members_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "community_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CommunityAdmins" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CommunityAdmins_A_fkey" FOREIGN KEY ("A") REFERENCES "communities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CommunityAdmins_B_fkey" FOREIGN KEY ("B") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CommunityModerators" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CommunityModerators_A_fkey" FOREIGN KEY ("A") REFERENCES "communities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CommunityModerators_B_fkey" FOREIGN KEY ("B") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conversation_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "canSendMessage" BOOLEAN NOT NULL DEFAULT true,
    "canSendFiles" BOOLEAN NOT NULL DEFAULT true,
    "canSendImages" BOOLEAN NOT NULL DEFAULT true,
    "canSendVideos" BOOLEAN NOT NULL DEFAULT true,
    "canSendAudios" BOOLEAN NOT NULL DEFAULT true,
    "canSendLocations" BOOLEAN NOT NULL DEFAULT true,
    "canSendLinks" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "conversation_members_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_conversation_members" ("conversationId", "id", "isActive", "joinedAt", "leftAt", "role", "userId") SELECT "conversationId", "id", "isActive", "joinedAt", "leftAt", "role", "userId" FROM "conversation_members";
DROP TABLE "conversation_members";
ALTER TABLE "new_conversation_members" RENAME TO "conversation_members";
CREATE UNIQUE INDEX "conversation_members_conversationId_userId_key" ON "conversation_members"("conversationId", "userId");
CREATE TABLE "new_conversation_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "conversation_preferences_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_conversation_preferences" ("conversationId", "createdAt", "id", "key", "updatedAt", "userId", "value") SELECT "conversationId", "createdAt", "id", "key", "updatedAt", "userId", "value" FROM "conversation_preferences";
DROP TABLE "conversation_preferences";
ALTER TABLE "new_conversation_preferences" RENAME TO "conversation_preferences";
CREATE UNIQUE INDEX "conversation_preferences_conversationId_userId_key_key" ON "conversation_preferences"("conversationId", "userId", "key");
CREATE TABLE "new_conversation_share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "maxConcurrentUsers" INTEGER,
    "currentConcurrentUsers" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowAnonymousMessages" BOOLEAN NOT NULL DEFAULT true,
    "allowAnonymousFiles" BOOLEAN NOT NULL DEFAULT false,
    "allowAnonymousImages" BOOLEAN NOT NULL DEFAULT true,
    "allowViewHistory" BOOLEAN NOT NULL DEFAULT true,
    "requireNickname" BOOLEAN NOT NULL DEFAULT true,
    "requireEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "conversation_share_links_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_share_links_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_conversation_share_links" ("conversationId", "createdAt", "createdBy", "currentUses", "description", "expiresAt", "id", "isActive", "linkId", "maxUses", "name", "updatedAt") SELECT "conversationId", "createdAt", "createdBy", "currentUses", "description", "expiresAt", "id", "isActive", "linkId", "maxUses", "name", "updatedAt" FROM "conversation_share_links";
DROP TABLE "conversation_share_links";
ALTER TABLE "new_conversation_share_links" RENAME TO "conversation_share_links";
CREATE UNIQUE INDEX "conversation_share_links_linkId_key" ON "conversation_share_links"("linkId");
CREATE TABLE "new_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "image" TEXT,
    "avatar" TEXT,
    "communityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "conversations_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_conversations" ("avatar", "createdAt", "description", "id", "isActive", "isArchived", "lastMessageAt", "title", "type", "updatedAt") SELECT "avatar", "createdAt", "description", "id", "isActive", "isArchived", "lastMessageAt", "title", "type", "updatedAt" FROM "conversations";
DROP TABLE "conversations";
ALTER TABLE "new_conversations" RENAME TO "conversations";
CREATE TABLE "new_group_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_group_members" ("groupId", "id", "joinedAt", "userId") SELECT "groupId", "id", "joinedAt", "userId" FROM "group_members";
DROP TABLE "group_members";
ALTER TABLE "new_group_members" RENAME TO "group_members";
CREATE UNIQUE INDEX "group_members_groupId_userId_key" ON "group_members"("groupId", "userId");
CREATE TABLE "new_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "groups_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_groups" ("createdAt", "description", "id", "updatedAt") SELECT "createdAt", "description", "id", "updatedAt" FROM "groups";
DROP TABLE "groups";
ALTER TABLE "new_groups" RENAME TO "groups";
CREATE TABLE "new_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "anonymousSenderId" TEXT,
    "content" TEXT NOT NULL,
    "originalLanguage" TEXT NOT NULL DEFAULT 'fr',
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" DATETIME,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "replyToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_anonymousSenderId_fkey" FOREIGN KEY ("anonymousSenderId") REFERENCES "anonymous_participants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_messages" ("content", "conversationId", "createdAt", "deletedAt", "editedAt", "id", "isDeleted", "isEdited", "messageType", "originalLanguage", "replyToId", "senderId", "updatedAt") SELECT "content", "conversationId", "createdAt", "deletedAt", "editedAt", "id", "isDeleted", "isEdited", "messageType", "originalLanguage", "replyToId", "senderId", "updatedAt" FROM "messages";
DROP TABLE "messages";
ALTER TABLE "new_messages" RENAME TO "messages";
CREATE TABLE "new_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "pushSent" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notifications" ("content", "createdAt", "data", "expiresAt", "id", "isRead", "title", "type", "userId") SELECT "content", "createdAt", "data", "expiresAt", "id", "isRead", "title", "type", "userId" FROM "notifications";
DROP TABLE "notifications";
ALTER TABLE "new_notifications" RENAME TO "notifications";
CREATE TABLE "new_user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_preferences" ("createdAt", "id", "key", "updatedAt", "userId", "value") SELECT "createdAt", "id", "key", "updatedAt", "userId", "value" FROM "user_preferences";
DROP TABLE "user_preferences";
ALTER TABLE "new_user_preferences" RENAME TO "user_preferences";
CREATE UNIQUE INDEX "user_preferences_userId_key_key" ON "user_preferences"("userId", "key");
CREATE TABLE "new_user_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "charactersTyped" INTEGER NOT NULL DEFAULT 0,
    "imageMessagesSent" INTEGER NOT NULL DEFAULT 0,
    "filesShared" INTEGER NOT NULL DEFAULT 0,
    "conversationsJoined" INTEGER NOT NULL DEFAULT 0,
    "groupsCreated" INTEGER NOT NULL DEFAULT 0,
    "friendsAdded" INTEGER NOT NULL DEFAULT 0,
    "friendRequestsSent" INTEGER NOT NULL DEFAULT 0,
    "translationsUsed" INTEGER NOT NULL DEFAULT 0,
    "languagesDetected" INTEGER NOT NULL DEFAULT 0,
    "autoTranslateTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalOnlineTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_stats" ("conversationsJoined", "createdAt", "groupsCreated", "id", "lastActiveAt", "messagesReceived", "messagesSent", "translationsUsed", "updatedAt", "userId") SELECT "conversationsJoined", "createdAt", "groupsCreated", "id", "lastActiveAt", "messagesReceived", "messagesSent", "translationsUsed", "updatedAt", "userId" FROM "user_stats";
DROP TABLE "user_stats";
ALTER TABLE "new_user_stats" RENAME TO "user_stats";
CREATE UNIQUE INDEX "user_stats_userId_key" ON "user_stats"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_participants_sessionToken_key" ON "anonymous_participants"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_participants_conversationId_sessionToken_key" ON "anonymous_participants"("conversationId", "sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "community_members_communityId_userId_key" ON "community_members"("communityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "_CommunityAdmins_AB_unique" ON "_CommunityAdmins"("A", "B");

-- CreateIndex
CREATE INDEX "_CommunityAdmins_B_index" ON "_CommunityAdmins"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CommunityModerators_AB_unique" ON "_CommunityModerators"("A", "B");

-- CreateIndex
CREATE INDEX "_CommunityModerators_B_index" ON "_CommunityModerators"("B");
