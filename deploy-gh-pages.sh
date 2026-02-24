#!/bin/bash

# GitHub Pages Deployment Script for KLL3RC03
# Usage: ./deploy-gh-pages.sh

set -e

echo "🚀 Deploying to GitHub Pages..."

# Build the project
echo "📦 Building project..."
npm run build

# Copy .nojekyll to dist
echo "📝 Copying .nojekyll to dist..."
cp public/.nojekyll dist/.nojekyll

# Check if dist folder exists
if [ ! -d "dist" ]; then
  echo "❌ Error: dist folder not found!"
  exit 1
fi

# Check if git repo is initialized
if [ ! -d ".git" ]; then
  echo "❌ Error: Not a git repository. Please initialize git first."
  exit 1
fi

echo "📤 Deploying to gh-pages branch..."

# Create a temporary worktree for gh-pages branch
git branch -D gh-pages 2>/dev/null || true
git checkout --orphan gh-pages
git rm -rf .

# Copy dist contents to root
cp -r dist/* .

# Add .nojekyll if not present
if [ ! -f ".nojekyll" ]; then
  touch .nojekyll
fi

# Commit and push
git add -A
git commit -m "Deploy to GitHub Pages - $(date)"
git push origin gh-pages --force

# Switch back to main/master branch
git checkout -

echo "✅ Deployed successfully!"
echo "🌐 Your site should be available at: https://your-username.github.io/KLL3RC03/"
echo ""
echo "⚠️  IMPORTANT: Make sure to:"
echo "   1. Go to GitHub repo → Settings → Pages"
echo "   2. Set Source to 'Deploy from a branch'"
echo "   3. Select 'gh-pages' branch and '/ (root)' folder"
echo "   4. Click Save"
