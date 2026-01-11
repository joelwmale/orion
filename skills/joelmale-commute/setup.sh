#!/bin/bash

# Commute Monitor Skill Setup Helper
# Run this after installing Clawdbot to set up the skill

set -e

echo "🚗 Commute Monitor Skill - Setup Helper"
echo "======================================"
echo ""

# Check prerequisites
echo "✅ Checking prerequisites..."
if ! command -v bun &> /dev/null; then
  echo "❌ Bun not found. Please install Bun first."
  exit 1
fi

if ! command -v git &> /dev/null; then
  echo "❌ Git not found. Please install Git first."
  exit 1
fi

echo "✅ Bun and Git found"
echo ""

# Create config directory
CONFIG_DIR="$HOME/.clawdbot/config"
CREDS_DIR="$HOME/.clawdbot/credentials"
CACHE_DIR="$HOME/.clawdbot/cache"

echo "📁 Setting up directories..."
mkdir -p "$CONFIG_DIR" "$CREDS_DIR" "$CACHE_DIR"

# Check for locations config
if [ ! -f "$CONFIG_DIR/personal-locations.json" ]; then
  echo ""
  echo "⚠️  Missing personal-locations.json"
  echo "Please create: $CONFIG_DIR/personal-locations.json"
  echo ""
  echo "Example:"
  cat << 'EOF'
{
  "home": {
    "address": "14 Hexham St, Yarrabilba Queensland 4207, Australia",
    "coordinates": {
      "lat": -27.8658,
      "lng": 153.0892
    }
  },
  "daycare": {
    "address": "17-25 Park Ridge Rd, Park Ridge QLD 4125",
    "coordinates": {
      "lat": -27.7456,
      "lng": 152.9578
    }
  },
  "commute_preferences": {
    "buffer_minutes": 10
  }
}
EOF
  echo ""
  read -p "Press Enter once you've created the file... "
else
  echo "✅ Locations config found"
fi

# Check for API key
if [ ! -f "$CREDS_DIR/google-maps-api.txt" ]; then
  echo ""
  echo "⚠️  Missing Google Maps API key"
  echo "Please add your API key to: $CREDS_DIR/google-maps-api.txt"
  echo ""
  echo "Get one from: https://console.cloud.google.com"
  echo "Then run: echo 'YOUR_KEY' > $CREDS_DIR/google-maps-api.txt"
  echo ""
  read -p "Press Enter once you've added the API key... "
else
  echo "✅ Google Maps API key found"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Test the skill:"
echo "  bun /root/clawd/skills/joelmale-commute/cli.ts morning-check"
echo ""
echo "Or calculate a departure time:"
echo "  bun /root/clawd/skills/joelmale-commute/cli.ts calculate 10:00"
echo ""
