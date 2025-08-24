
#!/bin/bash

echo "🚀 Starting Meeshy Frontend with internationalization support..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first."
    echo "   npm install -g pnpm"
    exit 1
fi

# Navigate to frontend directory
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Start the development server
echo "🌐 Starting development server..."
echo ""
echo "🔧 Language Features:"
echo "   - Interface language switcher in the header"
echo "   - Automatic language detection"
echo "   - User language configuration"
echo "   - Support for EN, FR, PT"
echo ""
echo "📝 To test internationalization:"
echo "   1. Open http://localhost:3100"
echo "   2. Click the language switcher in the header"
echo "   3. Select different languages (EN, FR, PT)"
echo "   4. Observe the interface language change"
echo ""
echo "🛑 To stop: Press Ctrl+C"

pnpm dev
