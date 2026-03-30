# TikTok Landing Page

A link.me style landing page for Instagram bio with Meta Pixel tracking.

## 🚀 Quick Deploy to Vercel

### Option 1: Deploy via GitHub (Recommended)

1. **Create a new GitHub repository:**
   - Go to github.com and create a new repository
   - Name it something like "tiktok-landing"
   - Keep it public or private (your choice)

2. **Push this code to GitHub:**
   ```bash
   cd tiktok-landing-page
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

3. **Deploy on Vercel:**
   - Go to vercel.com and log in
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Click "Deploy"
   - Done! Your site is live in ~30 seconds

### Option 2: Deploy without GitHub

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   cd tiktok-landing-page
   vercel
   ```

3. **Follow the prompts** - it will deploy your site

## 🔧 Customization

Before deploying, edit `pages/index.js` and update these values at the top:

```javascript
// Replace these values:
const profileImage = 'YOUR_PROFILE_IMAGE_URL';
const tiktokCardImage = 'YOUR_CARD_BACKGROUND_IMAGE_URL';
const creatorName = 'Creator Name';
const username = '@tiktokusername';
const tiktokUrl = 'https://tiktok.com/@username';
const META_PIXEL_ID = 'YOUR_PIXEL_ID_HERE';
```

## 🌐 Connect Your GoDaddy Domain

1. In Vercel, go to your project → Settings → Domains
2. Add your domain (e.g., `example.com`)
3. Vercel will show you DNS records to add
4. Go to GoDaddy → My Products → Domains → DNS
5. Add the DNS records Vercel provided:
   - Type: A Record, Name: @, Value: 76.76.21.21
   - Type: CNAME, Name: www, Value: cname.vercel-dns.com
6. Wait 10-30 minutes for DNS to propagate

## 📊 Meta Pixel Tracking

The page tracks:
- **PageView** - When someone lands on the page
- **Purchase** - When someone clicks "Continue" in the popup

To view events:
1. Go to Meta Events Manager (business.facebook.com/events_manager2)
2. Select your pixel
3. View events in real-time

## 📱 Features

- Link.me style design
- Meta Pixel tracking with Purchase events
- Confirmation popup before external link
- Mobile responsive
- Fast global CDN via Vercel
- Automatic HTTPS

## 🆘 Need Help?

- Vercel docs: vercel.com/docs
- Meta Pixel docs: developers.facebook.com/docs/meta-pixel
