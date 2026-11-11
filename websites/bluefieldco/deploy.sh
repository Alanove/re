#!/bin/bash

# EMDC CMS Deployment Script for Ubuntu
# Usage: ./deploy.sh [production|staging]

set -e  # Exit on any error

ENVIRONMENT=${1:-production}
PROJECT_DIR="/var/www/emdc-cms"
REPO_URL="https://github.com/Alanove/emdc.git"
NODE_ENV=$ENVIRONMENT

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

# Create project directory if it doesn't exist
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR

# Navigate to project directory
cd $PROJECT_DIR

# Clone or update repository
if [ -d ".git" ]; then
    echo "📥 Updating existing repository..."
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone $REPO_URL .
fi

# Navigate to the web application directory
cd emdc-website

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🔨 Building application..."
npm run build

# Build styles
echo "🎨 Building styles..."
npm run scss:once

# Build JavaScript modules
echo "⚙️ Building JavaScript modules..."
npm run js:build

# Set up environment
echo "🔧 Setting up environment..."
cp .env.$ENVIRONMENT .env 2>/dev/null || echo "No environment file found, using defaults"

# Create necessary directories
mkdir -p logs
mkdir -p public/uploads
mkdir -p public/temp

# Set proper permissions
sudo chown -R $USER:www-data public/uploads
sudo chown -R $USER:www-data public/temp
sudo chown -R $USER:www-data logs
sudo chmod -R 755 public/uploads
sudo chmod -R 755 public/temp
sudo chmod -R 755 logs

# Restart application with PM2
if command -v pm2 >/dev/null 2>&1; then
    echo "🔄 Restarting application with PM2..."
    pm2 reload ecosystem.config.js --env $ENVIRONMENT || pm2 start ecosystem.config.js --env $ENVIRONMENT
    pm2 save
else
    echo "⚠️ PM2 not installed. Please start the application manually with: npm start"
fi

# Reload Nginx if it's running
if systemctl is-active --quiet nginx; then
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
fi

echo "✅ Deployment completed successfully!"
echo "🌐 Application should be running on port 3001"

# Show PM2 status
if command -v pm2 >/dev/null 2>&1; then
    echo "📊 PM2 Status:"
    pm2 list
fi
