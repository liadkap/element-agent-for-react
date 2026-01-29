#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔧 UX Fix Collector - Development Mode"
echo "======================================="
echo ""

cd "$PROJECT_DIR"

echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  yarn install
fi

echo ""
echo "🚀 Starting development server..."
echo ""
echo "The extension will hot-reload when you make changes."
echo "Load the 'dist' folder in Chrome as an unpacked extension."
echo ""

yarn dev
