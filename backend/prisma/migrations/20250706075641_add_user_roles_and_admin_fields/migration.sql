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
    "customDestinationLanguage" TEXT,
    "autoTranslateEnabled" BOOLEAN NOT NULL DEFAULT true,
    "translateToSystemLanguage" BOOLEAN NOT NULL DEFAULT true,
    "translateToRegionalLanguage" BOOLEAN NOT NULL DEFAULT false,
    "useCustomDestination" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("autoTranslateEnabled", "avatar", "createdAt", "customDestinationLanguage", "displayName", "email", "firstName", "id", "isOnline", "lastActiveAt", "lastName", "lastSeen", "password", "phoneNumber", "regionalLanguage", "systemLanguage", "translateToRegionalLanguage", "translateToSystemLanguage", "updatedAt", "useCustomDestination", "username") SELECT "autoTranslateEnabled", "avatar", "createdAt", "customDestinationLanguage", "displayName", "email", "firstName", "id", "isOnline", "lastActiveAt", "lastName", "lastSeen", "password", "phoneNumber", "regionalLanguage", "systemLanguage", "translateToRegionalLanguage", "translateToSystemLanguage", "updatedAt", "useCustomDestination", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
