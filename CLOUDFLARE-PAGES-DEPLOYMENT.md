# Deploy to Cloudflare Pages (FREE Alternative)

## Why Cloudflare Pages?
- ✅ **Unlimited Bandwidth** - No limits on free tier
- ✅ **Unlimited Requests** - No request limits
- ✅ **500 Builds/Month** - More than enough for personal projects
- ✅ **Fast Global CDN** - Cloudflare's edge network
- ✅ **Free SSL** - Automatic HTTPS
- ✅ **GitHub/GitLab Integration** - Auto-deploy

## Method 1: Deploy via Dashboard (Easiest)

### Step 1: Sign Up
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Sign up (free account)

### Step 2: Connect GitHub
1. Click "Create a project"
2. Connect your GitHub account
3. Select your WhatsApp automation repository

### Step 3: Configure Build Settings
- **Project name:** sk-whatsapp-agent
- **Production branch:** main
- **Framework preset:** None (select manually)
- **Build command:** `cd frontend && npm install && npm run build`
- **Build output directory:** `frontend/dist`

### Step 4: Add Environment Variables
- Click "Environment variables"
- Add: `VITE_API_URL` = your backend URL

### Step 5: Deploy
- Click "Save and Deploy"
- Wait ~2 minutes

🎉 **Your site will be live at:** `https://your-project.pages.dev`

---

## Method 2: Deploy via Wrangler CLI

### Step 1: Install Wrangler

```powershell
npm install -g wrangler
```

### Step 2: Login

```powershell
wrangler login
```

### Step 3: Build Your Frontend

```powershell
cd frontend
npm run build
```

### Step 4: Deploy

```powershell
wrangler pages deploy dist --project-name=sk-whatsapp-agent
```

🎉 **Done!** Your app is live.

---

## Configure Environment Variables via CLI

```powershell
# Set production environment variable
wrangler pages secrets put VITE_API_URL --project-name=sk-whatsapp-agent
```

Enter your backend URL when prompted.

---

## Automatic Deployments

Once connected to GitHub:
- Every push to `main` = automatic production deployment
- Every pull request = preview deployment

## Custom Domain (Free)

You can add a custom domain for free in Cloudflare Pages dashboard.

---

## Troubleshooting

### Build Fails?
Make sure the build command includes the `cd frontend` part:
```
cd frontend && npm install && npm run build
```

### API Calls Failing?
Check that `VITE_API_URL` is set correctly in environment variables.
