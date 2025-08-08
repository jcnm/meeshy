#!/bin/bash

echo "🔧 Testing conversations page authentication flow..."

# 1. Login and get token
echo "🔐 Logging in..."
response=$(curl -s -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@meeshy.com", "password": "password123"}')

token=$(echo "$response" | jq -r '.access_token')
user=$(echo "$response" | jq -r '.user')

if [ "$token" = "null" ] || [ -z "$token" ]; then
  echo "❌ Login failed"
  echo "$response" | jq .
  exit 1
fi

echo "✅ Login successful, token: ${token:0:20}..."

# 2. Test auth/me endpoint
echo "🔍 Testing /auth/me endpoint..."
me_response=$(curl -s "http://localhost:3000/auth/me" \
  -H "Authorization: Bearer $token")

me_status=$(echo "$me_response" | jq -r '.username // "error"')
echo "✅ /auth/me response: $me_status"

# 3. Test conversations endpoint
echo "🔍 Testing /api/conversations endpoint..."
conv_response=$(curl -s "http://localhost:3000/api/conversations" \
  -H "Authorization: Bearer $token")

conv_count=$(echo "$conv_response" | jq '.data | length')
echo "✅ Found $conv_count conversations"

# 4. Open conversations page with token in localStorage
echo "🌐 Opening conversations page..."
open "http://localhost:3100/conversations"

echo "✅ Test completed! Check the browser for the conversations page."
echo "📝 To authenticate manually in the browser:"
echo "   1. Open browser console (F12)"
echo "   2. Run: localStorage.setItem('auth_token', '$token')"
echo "   3. Run: localStorage.setItem('user', '$(echo "$user" | tr -d '\n')')"
echo "   4. Refresh the page"
