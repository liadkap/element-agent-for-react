#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔧 UX Fix Collector - Chrome Extension Installer"
echo "================================================"
echo ""

cd "$PROJECT_DIR"

echo "📦 Installing dependencies..."
yarn install

echo ""
echo "🏗️  Building extension..."
yarn build

DIST_PATH="$PROJECT_DIR/dist"

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Extension built at: $DIST_PATH"
echo ""
echo "🚀 To install in Chrome:"
echo "   1. Open Chrome and go to: chrome://extensions/"
echo "   2. Enable 'Developer mode' (toggle in top right)"
echo "   3. Click 'Load unpacked'"
echo "   4. Select this folder: $DIST_PATH"
echo ""
echo "💡 After installing:"
echo "   - Open DevTools (F12 or Cmd+Option+I)"
echo "   - Look for the 'UX Fixes' tab"
echo "   - Click the settings icon to configure your Cursor API key"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Would you like to open Chrome extensions page? (y/n)"
  read -r response
  if [[ "$response" =~ ^[Yy]$ ]]; then
    open "chrome://extensions/"
  fi
fi
