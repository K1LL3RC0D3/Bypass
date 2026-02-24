# GitHub Pages Deployment Guide

## Repository: KLL3RC03

This Vite React app is configured for GitHub Pages deployment.

---

## 🚀 Option 1: GitHub Actions (Recommended)

The easiest way to deploy. Just push to `main` or `master` branch.

### Setup:

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/KLL3RC03.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repo on GitHub → **Settings** → **Pages**
   - Under **Build and deployment** → **Source**
   - Select **GitHub Actions**
   - The workflow will run automatically on push

3. **Done!** 🎉
   - Your site will be at: `https://YOUR_USERNAME.github.io/KLL3RC03/`

---

## 📤 Option 2: Manual Deploy (gh-pages branch)

Use the provided deploy script.

### Setup:

1. **Run the deploy script:**
   ```bash
   ./deploy-gh-pages.sh
   ```

2. **Configure GitHub Pages:**
   - Go to your repo on GitHub → **Settings** → **Pages**
   - Under **Build and deployment** → **Source**
   - Select **Deploy from a branch**
   - Select branch: `gh-pages` and folder: `/ (root)`
   - Click **Save**

3. **Done!** 🎉

---

## 📁 Files Included

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite config with `base: '/KLL3RC03/'` for GitHub Pages |
| `public/.nojekyll` | Prevents Jekyll processing (required for underscore files) |
| `.github/workflows/deploy.yml` | GitHub Actions workflow for auto-deployment |
| `deploy-gh-pages.sh` | Manual deployment script |
| `dist/` | Production build output (ready to upload) |

---

## ⚙️ vite.config.ts

```typescript
export default defineConfig({
  base: '/KLL3RC03/',  // GitHub Pages base path
  plugins: [react()],
  // ...
});
```

---

## 🔧 Troubleshooting

### 404 errors or blank page?
- Check that `base: '/KLL3RC03/'` matches your repo name exactly (case-sensitive)
- Ensure GitHub Pages is enabled in repo settings

### Assets not loading?
- The `base` path must match your repository name
- Rebuild after changing vite.config.ts: `npm run build`

### Workflow failing (red light)?
- Check Actions tab for error details
- Ensure `package.json` has correct build script: `"build": "tsc -b && vite build"`
- Make sure all dependencies are in `package.json`

---

## 📦 Quick Deploy (Upload dist/ directly)

If you just want to upload the built files:

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under **Build and deployment** → **Source**
3. Select **Deploy from a branch**
4. Select branch: `main` or `master`, folder: `/ (root)`
5. Upload the contents of `dist/` folder to your repo root
6. Include `.nojekyll` file in the root

---

## 🌐 Live URL

After deployment, your site will be at:

```
https://YOUR_GITHUB_USERNAME.github.io/KLL3RC03/
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.
