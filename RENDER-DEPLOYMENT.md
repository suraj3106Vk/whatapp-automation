# Deploy to Render (FREE Alternative)

## Why Render?
- ✅ **Free Static Site Hosting** - Unlimited bandwidth
- ✅ **Auto-Deploy from Git** - Push and deploy
- ✅ **Free SSL** - Automatic HTTPS
- ✅ **Can Host Backend Too** - All-in-one solution
- ✅ **Simple Setup** - No CLI needed

## Step 1: Sign Up
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (free account)

## Step 2: Create New Static Site
1. Click "New +" → "Static Site"
2. Connect your GitHub repository
3. Select your WhatsApp automation repo

## Step 3: Configure Build Settings
- **Name:** sk-whatsapp-agent
- **Branch:** main
- **Root Directory:** `frontend`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`

## Step 4: Add Environment Variables
- Click "Advanced"
- Add environment variable:
  - **Key:** `VITE_API_URL`
  - **Value:** Your backend URL

## Step 5: Deploy
- Click "Create Static Site"
- Wait ~3 minutes

🎉 **Your site will be live at:** `https://your-project.onrender.com`

---

## Deploy Backend on Render Too (Optional)

If you want to host both frontend AND backend on Render:

### Backend Setup:
1. Click "New +" → "Web Service"
2. Connect your repository
3. Configure:
   - **Name:** sk-whatsapp-backend
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
4. Add all your backend environment variables
5. Deploy

Then update your frontend's `VITE_API_URL` to point to your Render backend URL.

---

## Custom Domain (Free)
You can add a custom domain for free in Render dashboard.

## Automatic Deployments
Every push to your main branch triggers automatic deployment.
