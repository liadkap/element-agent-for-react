# ElementAgent for React

A Chrome DevTools extension that lets UX designers and developers select React components, describe desired changes, and send them to AI coding agents (Cursor, Cloud Code).

## Quick Install

```bash
./scripts/install.sh
```

Or manually:

```bash
yarn install
yarn build
```

Then load the `dist` folder in Chrome:

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist` folder

## Requirements for AI Agents

To use this extension with **Claude Code** or **Cursor**, the AI agent needs:

- **Task Management Access** - Ability to create and manage tasks/todos for tracking the implementation steps
- **Git Repository Access** - Permission to read/write to the git repository to create commits and pull requests

Make sure your AI agent is configured with these permissions before sending prompts.

## Usage

1. Open your app in Chrome
2. Open DevTools (`F12` or `Cmd+Option+I` on Mac)
3. Go to the **"ElementAgent for React"** tab

### Selecting Elements

**Option 1: Element Picker**

- Click **"Pick Element"** button
- Hover over elements on the page to see tooltips
- Click to capture an element
- Press `ESC` to cancel

**Option 2: From Elements Panel**

- Select an element in the Elements panel
- Click **"Capture $0"** button

### Creating Fix Requests

1. After capturing elements, describe the change you want in the text area
2. Add multiple elements/changes as needed
3. Click **"Preview"** to see the full prompt
4. Click **"Copy Prompt"** to copy to clipboard
5. Paste into Cursor chat

## Settings

Click the gear icon to configure:

- **Cursor API Key** - For future direct API integration
- **Workspace Path** - Your local project path

## Development

```bash
# Start dev server with hot reload
yarn dev

# Build for production
yarn build

# Type check
yarn type-check
```

## Features

- 🎯 **Element Picker** - Select elements directly on the page
- 🔍 **React Detection** - Automatically detects React component names
- 📋 **Smart Selectors** - Generates CSS selectors for elements
- 👁️ **Preview** - See exactly what will be sent to Cursor
- 🎨 **Dark Theme** - Matches Chrome DevTools aesthetics
- ⚙️ **Configurable** - Store API keys and settings
- 🤖 **Multi-Agent Support** - Send to Cursor or Cloud Code
