# 🚀 QUICK DEPLOYMENT GUIDE

## Before You Start

1. **Update the content in `pages/index.js`:**
   - Replace `profileImage` URL with her photo
   - Replace `tiktokCardImage` URL with card background
   - Update `creatorName`, `username`, `tiktokUrl`
   - Add your `META_PIXEL_ID`

## Deploy to Vercel (3 Steps)

### Step 1: Upload to GitHub
```bash
# If you have GitHub Desktop:
1. Open GitHub Desktop
2. Add this folder as a repository
3. Publish to GitHub

# Or use command line:
cd tiktok-landing-page
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

### Step 2: Connect to Vercel
1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Click "Import" next to your GitHub repo
4. Click "Deploy"
5. **Done!** Site is live in 30 seconds

### Step 3: Connect Your Domain
1. In Vercel, click your project → "Settings" → "Domains"
2. Type your domain (e.g., `example.com`) and click "Add"
3. Vercel will show you DNS records to add
4. Go to GoDaddy:
   - My Products → Domains → Click your domain
   - Click "DNS" or "Manage DNS"
   - Add the records Vercel gave you:
     * **A Record**: Name = @ , Value = 76.76.21.21
     * **CNAME**: Name = www , Value = cname.vercel-dns.com
5. Click "Save"
6. Wait 15-30 minutes for DNS to update
7. **Done!** Your domain now points to the site

## Alternative: Deploy Without GitHub

If you don't want to use GitHub:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd tiktok-landing-page
vercel

# Follow the prompts - it will deploy immediately
```

## Getting Your Meta Pixel ID

1. Go to https://business.facebook.com/events_manager2
2. Click on your Pixel
3. Copy the Pixel ID (15-16 digit number)
4. Paste it in `pages/index.js` where it says `YOUR_PIXEL_ID_HERE`

## Tracking Events

After deployment, check your Meta Events Manager to see:
- **PageView** events when people visit
- **Purchase** events when people click "Continue" button

---

**Questions?** Check the README.md file for more details!
