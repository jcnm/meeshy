# Integration Guide: Admin User Management System

## ✅ Backend Integration Complete

All backend routes are now registered and ready to use!

---

## 🔌 API Endpoints Available

Base URL: `http://localhost:3000/api`

### **Authentication Required**
All endpoints require:
- `Authorization: Bearer <JWT_TOKEN>` header
- User must have appropriate admin permissions

---

### 1. **List Users** (VIEW permission)
```http
GET /api/admin/users?page=1&pageSize=20&search=john&role=ADMIN&isActive=true
```

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `pageSize` (number) - Items per page (max: 100, default: 20)
- `search` (string) - Search by username, email, firstName, lastName
- `role` (string) - Filter by role (BIGBOSS, ADMIN, MODO, AUDIT, ANALYST, USER)
- `isActive` (boolean) - Filter by status
- `emailVerified` (boolean) - Filter by email verification
- `phoneVerified` (boolean) - Filter by phone verification
- `twoFactorEnabled` (boolean) - Filter by 2FA status
- `createdAfter` (date) - Created after date
- `createdBefore` (date) - Created before date
- `sortBy` (string) - Sort field (createdAt, lastSeen, username, email, firstName, lastName)
- `sortOrder` (string) - Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user123",
        "username": "john_doe",
        "firstName": "John",
        "lastName": "Doe",
        "email": "j***@example.com",  // Masked for MODO/AUDIT
        "role": "USER",
        "isActive": true,
        ...
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalUsers": 100,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

### 2. **Get User Details** (VIEW permission)
```http
GET /api/admin/users/:userId
```

**Response:**
- Returns `AdminUser` (full data) for BIGBOSS/ADMIN
- Returns `MaskedUser` (masked email/phone) for MODO/AUDIT

---

### 3. **Create User** (UPDATE permission)
```http
POST /api/admin/users
Content-Type: application/json

{
  "username": "new_user",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "password": "SecurePass123!",
  "displayName": "Jane S.",
  "bio": "New team member",
  "phoneNumber": "+33612345678",
  "role": "USER",
  "systemLanguage": "en",
  "regionalLanguage": "fr"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* sanitized user object */ },
  "message": "User created successfully"
}
```

---

### 4. **Update User Profile** (UPDATE permission)
```http
PATCH /api/admin/users/:userId
Content-Type: application/json

{
  "username": "updated_username",
  "firstName": "Updated",
  "lastName": "Name",
  "displayName": "New Display Name",
  "bio": "Updated bio",
  "phoneNumber": "+33698765432",
  "systemLanguage": "fr",
  "regionalLanguage": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* sanitized user object */ },
  "message": "User updated successfully"
}
```

---

### 5. **Change User Role** (UPDATE permission)
```http
PATCH /api/admin/users/:userId/role
Content-Type: application/json

{
  "role": "ADMIN",
  "reason": "Promoted to admin for new responsibilities"
}
```

**Restrictions:**
- BIGBOSS can change any role
- ADMIN can change roles except BIGBOSS
- Must have higher hierarchy level than target user

**Response:**
```json
{
  "success": true,
  "data": { /* sanitized user object */ },
  "message": "User role updated to ADMIN"
}
```

---

### 6. **Change User Status** (UPDATE permission)
```http
PATCH /api/admin/users/:userId/status
Content-Type: application/json

{
  "isActive": false,
  "reason": "Account suspended for policy violation"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* sanitized user object */ },
  "message": "User deactivated"
}
```

---

### 7. **Reset Password** (UPDATE permission)
```http
POST /api/admin/users/:userId/reset-password
Content-Type: application/json

{
  "newPassword": "NewSecurePass123!",
  "sendEmail": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### 8. **Delete User** (DELETE permission)
```http
DELETE /api/admin/users/:userId
```

**Note:** This is a soft delete. User data is preserved but account is deactivated.

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 🔐 Permission Matrix

| Role     | View Users | View Sensitive | Create | Update | Delete | Change Role |
|----------|------------|----------------|--------|--------|--------|-------------|
| BIGBOSS  | ✅         | ✅             | ✅     | ✅     | ✅     | ✅          |
| ADMIN    | ✅         | ✅             | ✅     | ✅*    | ✅*    | ✅*         |
| MODO     | ✅         | ❌             | ❌     | ❌     | ❌     | ❌          |
| AUDIT    | ✅         | ❌             | ❌     | ❌     | ❌     | ❌          |
| ANALYST  | ❌         | ❌             | ❌     | ❌     | ❌     | ❌          |

\* Cannot modify BIGBOSS users

---

## 🧪 Testing with cURL

### 1. Login to get JWT token:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

Extract the `token` from the response.

### 2. List all users:
```bash
curl http://localhost:3000/api/admin/users?page=1&pageSize=10 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Get specific user:
```bash
curl http://localhost:3000/api/admin/users/USER_ID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Create new user:
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### 5. Update user role:
```bash
curl -X PATCH http://localhost:3000/api/admin/users/USER_ID_HERE/role \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "ADMIN",
    "reason": "Promotion"
  }'
```

---

## 🐛 Troubleshooting

### 401 Unauthorized
- Check if JWT token is valid
- Verify token is in `Authorization: Bearer <token>` format
- Token may have expired - login again

### 403 Forbidden
- User doesn't have required permissions
- Check user role in database
- Verify permission matrix above

### 404 Not Found
- User ID doesn't exist
- Check UUID format

### 400 Bad Request
- Validation error - check request body
- Response will include `details` field with Zod errors

### 500 Internal Server Error
- Check server logs
- Verify Prisma connection
- Check if bcrypt is installed

---

## 🔧 Database Setup (Required)

### Add AdminAuditLog Table

Edit `/shared/prisma/schema.prisma`:

```prisma
model AdminAuditLog {
  id        String   @id @default(cuid())
  userId    String
  adminId   String
  action    String
  entity    String
  entityId  String
  changes   Json?
  metadata  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user  User @relation("AuditedUser", fields: [userId], references: [id])
  admin User @relation("AdminAuditor", fields: [adminId], references: [id])

  @@index([userId])
  @@index([adminId])
  @@index([entityId])
  @@index([createdAt])
}

model User {
  // ... existing fields ...

  // Add these relations
  auditedActions AdminAuditLog[] @relation("AuditedUser")
  adminActions   AdminAuditLog[] @relation("AdminAuditor")
}
```

Then run:
```bash
cd /Users/smpceo/Documents/Services/Meeshy/meeshy/shared
npx prisma migrate dev --name add_admin_audit_log
```

---

## 📊 Response Data Sanitization

### BIGBOSS & ADMIN see:
```json
{
  "id": "user123",
  "username": "john_doe",
  "email": "john.doe@example.com",        // ✅ Real email
  "phoneNumber": "+33612345678",          // ✅ Real phone
  "twoFactorEnabled": true,
  "systemLanguage": "en",
  // ... all sensitive fields
}
```

### MODO & AUDIT see:
```json
{
  "id": "user123",
  "username": "john_doe",
  "email": "j***@example.com",            // ❌ Masked
  "phoneNumber": "+33 6** ** ** **",      // ❌ Masked
  // No twoFactorEnabled field
  // No language preferences
  // ... only public fields
}
```

---

## 📝 Next Steps

1. ✅ Backend is ready and integrated
2. ⏳ Build frontend UI components
3. ⏳ Create admin dashboard page
4. ⏳ Test all permission scenarios
5. ⏳ Add avatar upload functionality
6. ⏳ Implement email notifications

---

## 🆘 Support

Check these files for reference:
- **Types:** `/shared/types/user.ts`
- **Services:** `/gateway/src/services/admin/*.ts`
- **Routes:** `/gateway/src/routes/admin/users.ts`
- **Middleware:** `/gateway/src/middleware/admin-user-auth.middleware.ts`
- **Full Plan:** `/PLAN_GESTION_UTILISATEURS_V2.md`
- **Summary:** `/IMPLEMENTATION_SUMMARY.md`

---

**Happy Coding! 🚀**
