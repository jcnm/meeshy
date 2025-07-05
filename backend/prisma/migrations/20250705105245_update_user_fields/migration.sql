/*
  Warnings:

  - You are about to drop the column `language` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `translationEnabled` on the `users` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "password" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "systemLanguage" TEXT NOT NULL DEFAULT 'fr',
    "regionalLanguage" TEXT NOT NULL DEFAULT 'fr',
    "autoTranslateEnabled" BOOLEAN NOT NULL DEFAULT true,
    "translateToSystemLanguage" BOOLEAN NOT NULL DEFAULT true,
    "translateToRegionalLanguage" BOOLEAN NOT NULL DEFAULT false,
    "useCustomDestination" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatar", "createdAt", "displayName", "email", "id", "isOnline", "lastSeen", "password", "updatedAt", "username") SELECT "avatar", "createdAt", "displayName", "email", "id", "isOnline", "lastSeen", "password", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
