// Demo mock data for when Supabase has no real data
// Generates realistic-looking social media dashboard data

const DEMO_MODE_KEY = 'ig_dashboard_demo'

export function isDemoMode() {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true'
}

export function enableDemoMode() {
  localStorage.setItem(DEMO_MODE_KEY, 'true')
}

export function disableDemoMode() {
  localStorage.removeItem(DEMO_MODE_KEY)
}

// Deterministic pseudo-random using seed
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const rand = seededRandom(42)
const randBetween = (min, max) => Math.floor(rand() * (max - min + 1)) + min

function uuid(i) {
  return `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ── Profiles ──
export const mockProfiles = [
  { id: uuid(1), email: 'admin@demo.com', display_name: 'Alex Admin', role: 'admin', created_at: daysAgo(120) },
  { id: uuid(2), email: 'sarah@demo.com', display_name: 'Sarah Manager', role: 'manager', created_at: daysAgo(90) },
  { id: uuid(3), email: 'mike@demo.com', display_name: 'Mike Ops', role: 'operator', created_at: daysAgo(60) },
  { id: uuid(4), email: 'jess@demo.com', display_name: 'Jess Ops', role: 'operator', created_at: daysAgo(45) },
]

// ── Models ──
export const mockModels = [
  { id: uuid(10), name: 'luna_ray', display_name: 'Luna Ray', status: 'Active', of_username: 'lunaray', notes: 'Top performer', created_at: daysAgo(100), updated_at: daysAgo(2) },
  { id: uuid(11), name: 'maya_bliss', display_name: 'Maya Bliss', status: 'Active', of_username: 'mayabliss', notes: '', created_at: daysAgo(90), updated_at: daysAgo(5) },
  { id: uuid(12), name: 'jade_stone', display_name: 'Jade Stone', status: 'Active', of_username: 'jadestone', notes: 'Growing fast', created_at: daysAgo(80), updated_at: daysAgo(1) },
  { id: uuid(13), name: 'ruby_fox', display_name: 'Ruby Fox', status: 'Onboarding', of_username: 'rubyfox', notes: 'New creator', created_at: daysAgo(14), updated_at: daysAgo(1) },
  { id: uuid(14), name: 'nova_star', display_name: 'Nova Star', status: 'Paused', of_username: 'novastar', notes: 'On break until April', created_at: daysAgo(70), updated_at: daysAgo(10) },
]

// ── Accounts ──
const accountDefs = [
  // Luna Ray accounts
  { id: uuid(100), model_id: uuid(10), platform: 'instagram', handle: 'lunaray_official', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(101), model_id: uuid(10), platform: 'twitter', handle: 'lunaray_x', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(102), model_id: uuid(10), platform: 'tiktok', handle: 'lunaray_tt', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(103), model_id: uuid(10), platform: 'reddit', handle: 'u/lunaray_real', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  // Maya Bliss accounts
  { id: uuid(110), model_id: uuid(11), platform: 'instagram', handle: 'mayabliss_', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(111), model_id: uuid(11), platform: 'twitter', handle: 'mayabliss_x', account_type: 'Primary', status: 'Active', health: 'Limited', assigned_operator: uuid(4) },
  { id: uuid(112), model_id: uuid(11), platform: 'reddit', handle: 'u/mayabliss', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  // Jade Stone accounts
  { id: uuid(120), model_id: uuid(12), platform: 'instagram', handle: 'jadestone_ig', account_type: 'Primary', status: 'Active', health: 'Shadowbanned', assigned_operator: uuid(3) },
  { id: uuid(121), model_id: uuid(12), platform: 'instagram', handle: 'jade.backup', account_type: 'Backup', status: 'Warming Up', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(122), model_id: uuid(12), platform: 'tiktok', handle: 'jadestone_tt', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  // Ruby Fox accounts
  { id: uuid(130), model_id: uuid(13), platform: 'instagram', handle: 'rubyfox_new', account_type: 'Primary', status: 'Warming Up', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(131), model_id: uuid(13), platform: 'twitter', handle: 'rubyfox_x', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  // Nova Star accounts
  { id: uuid(140), model_id: uuid(14), platform: 'instagram', handle: 'novastar_ig', account_type: 'Primary', status: 'Active', health: 'Action Blocked', assigned_operator: uuid(3) },
  { id: uuid(141), model_id: uuid(14), platform: 'reddit', handle: 'u/novastar', account_type: 'Primary', status: 'Active', health: 'Karma Farming', assigned_operator: uuid(4) },
]

function getModelForAccount(acc) {
  const m = mockModels.find(m => m.id === acc.model_id)
  return m ? { id: m.id, name: m.name, display_name: m.display_name } : null
}

function getOperatorForAccount(acc) {
  const p = mockProfiles.find(p => p.id === acc.assigned_operator)
  return p ? { id: p.id, display_name: p.display_name } : null
}

export const mockAccounts = accountDefs.map(a => ({
  ...a,
  account_url: `https://${a.platform}.com/${a.handle}`,
  created_at: daysAgo(randBetween(30, 100)),
  updated_at: daysAgo(randBetween(0, 7)),
  model: getModelForAccount(a),
  operator: getOperatorForAccount(a),
}))

// ── Snapshots — generate 8 weeks of weekly data per account ──
function generateSnapshots() {
  const snapshots = []
  let snapId = 1000

  for (const acc of accountDefs) {
    const model = getModelForAccount(acc)
    let baseFollowers = randBetween(2000, 50000)

    for (let week = 7; week >= 0; week--) {
      const date = daysAgo(week * 7)
      const growth = randBetween(-200, 800)
      baseFollowers = Math.max(500, baseFollowers + growth)

      const snap = {
        id: uuid(snapId++),
        account_id: acc.id,
        snapshot_date: date,
        followers: baseFollowers,
        following: randBetween(100, 500),
        captured_by: 'Manual',
        notes: '',
        created_at: date + 'T12:00:00Z',
        created_by: uuid(1),
        vtfr_weekly: parseFloat((randBetween(15, 85) + rand() * 10).toFixed(1)),
        engagement_rate_weekly: parseFloat((rand() * 6 + 0.5).toFixed(2)),
        wow_followers_pct: parseFloat(((growth / Math.max(1, baseFollowers - growth)) * 100).toFixed(1)),
        wow_views_pct: parseFloat((rand() * 40 - 10).toFixed(1)),
        account: {
          id: acc.id,
          platform: acc.platform,
          handle: acc.handle,
          health: acc.health,
          model_id: acc.model_id,
          model,
        },
      }

      // Platform-specific metrics
      if (acc.platform === 'instagram') {
        snap.ig_views_7d = randBetween(5000, 120000)
        snap.ig_views_30d = snap.ig_views_7d * randBetween(3, 5)
        snap.ig_reach_7d = Math.floor(snap.ig_views_7d * (0.4 + rand() * 0.4))
        snap.ig_profile_visits_7d = randBetween(200, 3000)
        snap.ig_link_clicks_7d = randBetween(20, 500)
        snap.ig_reels_posted_7d = randBetween(2, 10)
        snap.ig_stories_posted_7d = randBetween(5, 25)
        snap.ig_top_reel_views = randBetween(10000, 200000)
      } else if (acc.platform === 'twitter') {
        snap.tw_impressions_7d = randBetween(10000, 200000)
        snap.tw_views_7d = randBetween(8000, 150000)
        snap.tw_retweets_7d = randBetween(50, 800)
        snap.tw_likes_7d = randBetween(200, 3000)
        snap.tw_replies_7d = randBetween(30, 500)
        snap.tw_link_clicks_7d = randBetween(10, 300)
        snap.tw_tweets_posted_7d = randBetween(5, 30)
        snap.tw_dms_sent_7d = randBetween(10, 100)
        snap.tw_dm_response_rate = parseFloat((rand() * 60 + 30).toFixed(1))
      } else if (acc.platform === 'reddit') {
        snap.rd_karma_total = randBetween(500, 25000)
        snap.rd_posts_7d = randBetween(3, 15)
        snap.rd_avg_upvotes_7d = randBetween(20, 500)
        snap.rd_total_views_7d = randBetween(5000, 80000)
        snap.rd_comments_received_7d = randBetween(10, 200)
        snap.rd_top_post_upvotes = randBetween(100, 3000)
        snap.rd_link_clicks_7d = randBetween(10, 200)
        snap.rd_subreddits_posted_7d = randBetween(2, 8)
        snap.rd_account_age_days = randBetween(30, 365)
      } else if (acc.platform === 'tiktok') {
        snap.tt_views_7d = randBetween(10000, 500000)
        snap.tt_likes_7d = randBetween(500, 20000)
        snap.tt_comments_7d = randBetween(50, 2000)
        snap.tt_shares_7d = randBetween(20, 1000)
        snap.tt_videos_posted_7d = randBetween(3, 12)
        snap.tt_avg_watch_time = parseFloat((rand() * 25 + 5).toFixed(1))
        snap.tt_profile_views_7d = randBetween(500, 10000)
        snap.tt_link_clicks_7d = randBetween(10, 300)
      }

      snapshots.push(snap)
    }
  }
  return snapshots
}

export const mockSnapshots = generateSnapshots()

// ── Tasks ──
export const mockTasks = [
  { id: uuid(2000), title: 'Review Luna IG analytics', description: 'Check weekly performance', priority: 'high', assignee_id: uuid(3), account_id: uuid(100), status: 'open', created_by: uuid(2), completed_at: null, assignee: { id: uuid(3), display_name: 'Mike Ops' }, account: { id: uuid(100), handle: 'lunaray_official', platform: 'instagram' } },
  { id: uuid(2001), title: 'Fix Jade shadowban', description: 'Investigate and resolve shadowban on main IG', priority: 'urgent', assignee_id: uuid(3), account_id: uuid(120), status: 'open', created_by: uuid(2), completed_at: null, assignee: { id: uuid(3), display_name: 'Mike Ops' }, account: { id: uuid(120), handle: 'jadestone_ig', platform: 'instagram' } },
  { id: uuid(2002), title: 'Onboard Ruby Fox socials', description: 'Set up remaining accounts', priority: 'normal', assignee_id: uuid(4), account_id: uuid(130), status: 'open', created_by: uuid(1), completed_at: null, assignee: { id: uuid(4), display_name: 'Jess Ops' }, account: { id: uuid(130), handle: 'rubyfox_new', platform: 'instagram' } },
  { id: uuid(2003), title: 'Post 5 reels for Maya', description: 'Weekly content schedule', priority: 'normal', assignee_id: uuid(4), account_id: uuid(110), status: 'done', created_by: uuid(2), completed_at: daysAgo(2), assignee: { id: uuid(4), display_name: 'Jess Ops' }, account: { id: uuid(110), handle: 'mayabliss_', platform: 'instagram' } },
]

// ── Demo user for auth bypass ──
export const mockDemoUser = {
  id: uuid(1),
  email: 'admin@demo.com',
}

export const mockDemoProfile = mockProfiles[0]
