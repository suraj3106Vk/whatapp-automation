# Deploy to Vercel (FREE - Recommended Alternative)

## Why Vercel?
- ✅ **Generous Free Tier** - Unlimited bandwidth for personal projects
- ✅ **Fast Deployment** - Deploy in under 2 minutes
- ✅ **Auto SSL** - Free HTTPS certificates
- ✅ **GitHub Integration** - Auto-deploy on every push
- ✅ **Fast CDN** - Global edge network

## Step 1: Install Vercel CLI

```powershell
npm install -g vercel
```

## Step 2: Login to Vercel

```powershell
vercel login
```

This will open a browser - sign up with GitHub (free account).

## Step 3: Deploy Your Frontend

```powershell
cd frontend
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No
- **Project name?** → sk-whatsapp-agent (or press Enter)
- **In which directory is your code?** → `./` (current directory)
- **Want to override settings?** → Yes
  - **Build Command:** `npm run build`
  - **Output Directory:** `dist`
  - **Development Command:** `npm run dev`

## Step 4: Configure Environment Variables

In your Vercel dashboard or via CLI:

```powershell
vercel env add VITE_API_URL
```

Enter your backend URL (e.g., your Railway backend URL or localhost for testing).

## Step 5: Deploy to Production

```powershell
vercel --prod
```

🎉 **Done!** Your app is live at: `https://your-project.vercel.app`

## Automatic Deployments

Once connected to GitHub:
1. Every push to `main` branch = automatic production deployment
2. Every pull request = preview deployment

## Custom Domain (Optional & Free)

You can add a custom domain for free in Vercel dashboard.

---

## Alternative: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (free)
3. Click "Add New Project"
4. Import your GitHub repository
5. Set build settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
6. Add environment variable:
   - `VITE_API_URL` = your backend URL
7. Click "Deploy"

✅ **Your site will be live in ~2 minutes!**
