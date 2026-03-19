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
  { id: uuid(10), name: 'ariana', display_name: 'Ariana', status: 'Active', of_username: 'ariana', notes: '', created_at: daysAgo(100), updated_at: daysAgo(2) },
  { id: uuid(11), name: 'rose', display_name: 'Rose', status: 'Active', of_username: 'rose', notes: '', created_at: daysAgo(95), updated_at: daysAgo(3) },
  { id: uuid(12), name: 'indibaby', display_name: 'Indibaby', status: 'Active', of_username: 'indibaby', notes: '', created_at: daysAgo(90), updated_at: daysAgo(1) },
  { id: uuid(13), name: 'barbie', display_name: 'Barbie', status: 'Active', of_username: 'barbie', notes: '', created_at: daysAgo(85), updated_at: daysAgo(4) },
  { id: uuid(14), name: 'franche', display_name: 'Franche', status: 'Active', of_username: 'franche', notes: '', created_at: daysAgo(80), updated_at: daysAgo(2) },
  { id: uuid(15), name: 'moxie', display_name: 'Moxie', status: 'Active', of_username: 'moxie', notes: '', created_at: daysAgo(75), updated_at: daysAgo(1) },
  { id: uuid(16), name: 'lola', display_name: 'Lola', status: 'Active', of_username: 'lola', notes: '', created_at: daysAgo(70), updated_at: daysAgo(5) },
  { id: uuid(17), name: 'maple', display_name: 'Maple', status: 'Active', of_username: 'maple', notes: '', created_at: daysAgo(65), updated_at: daysAgo(3) },
  { id: uuid(18), name: 'olivia', display_name: 'Olivia', status: 'Active', of_username: 'olivia', notes: '', created_at: daysAgo(60), updated_at: daysAgo(2) },
  { id: uuid(19), name: 'bella', display_name: 'Bella', status: 'Active', of_username: 'bella', notes: '', created_at: daysAgo(55), updated_at: daysAgo(1) },
  { id: uuid(20), name: 'angelmoon', display_name: 'AngelMoon', status: 'Active', of_username: 'angelmoon', notes: '', created_at: daysAgo(50), updated_at: daysAgo(4) },
  { id: uuid(21), name: 'dawn', display_name: 'Dawn', status: 'Active', of_username: 'dawn', notes: '', created_at: daysAgo(45), updated_at: daysAgo(2) },
  { id: uuid(22), name: 'gia', display_name: 'Gia', status: 'Active', of_username: 'gia', notes: '', created_at: daysAgo(40), updated_at: daysAgo(1) },
]

// ── Accounts ──
// First account per model is Primary, rest are Farm
const accountDefs = [
  // ARIANA — 7 X accounts
  { id: uuid(100), model_id: uuid(10), platform: 'twitter', handle: 'ArianaAngelsxo', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(101), model_id: uuid(10), platform: 'twitter', handle: 'TsAriAngelsxox', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(102), model_id: uuid(10), platform: 'twitter', handle: 'TSArianaAngelsx', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(103), model_id: uuid(10), platform: 'twitter', handle: 'TSAriiAngels', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(104), model_id: uuid(10), platform: 'twitter', handle: 'TSAngelArii', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(105), model_id: uuid(10), platform: 'twitter', handle: 'AriAngelsXo', account_type: 'Farm', status: 'Active', health: 'Limited', assigned_operator: uuid(4) },
  { id: uuid(106), model_id: uuid(10), platform: 'twitter', handle: 'Isabelacasiu', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },

  // ROSE — 3 X accounts
  { id: uuid(110), model_id: uuid(11), platform: 'twitter', handle: 'porcelaingoirl', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(111), model_id: uuid(11), platform: 'twitter', handle: 'TsPorcelainbby', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(112), model_id: uuid(11), platform: 'twitter', handle: 'valeriapasion7', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },

  // INDIBABY — 5 X accounts
  { id: uuid(120), model_id: uuid(12), platform: 'twitter', handle: 'IndibabyTs', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(121), model_id: uuid(12), platform: 'twitter', handle: 'TsIndigirlxo', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(122), model_id: uuid(12), platform: 'twitter', handle: 'Indibabyxo', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(123), model_id: uuid(12), platform: 'twitter', handle: 'Indibabyx', account_type: 'Farm', status: 'Active', health: 'Limited', assigned_operator: uuid(4) },
  { id: uuid(124), model_id: uuid(12), platform: 'twitter', handle: 'TSindibaby', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },

  // BARBIE — 4 X accounts
  { id: uuid(130), model_id: uuid(13), platform: 'twitter', handle: 'Tsbarbiegirlx', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(131), model_id: uuid(13), platform: 'twitter', handle: 'Ebarbiebbyx', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(132), model_id: uuid(13), platform: 'twitter', handle: 'Tsbarbiegirlxx', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(133), model_id: uuid(13), platform: 'twitter', handle: 'Ebarbiexxgirl', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },

  // FRANCHE — 5 X accounts
  { id: uuid(140), model_id: uuid(14), platform: 'twitter', handle: 'franchebbyy', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(141), model_id: uuid(14), platform: 'twitter', handle: 'Tsfrancheexo', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(142), model_id: uuid(14), platform: 'twitter', handle: 'franchetgirl', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(143), model_id: uuid(14), platform: 'twitter', handle: 'Tsfranchecutie', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(144), model_id: uuid(14), platform: 'twitter', handle: 'franchebbyx', account_type: 'Farm', status: 'Active', health: 'Limited', assigned_operator: uuid(4) },

  // MOXIE — 5 X accounts
  { id: uuid(150), model_id: uuid(15), platform: 'twitter', handle: 'moxiedoll', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(151), model_id: uuid(15), platform: 'twitter', handle: 'tsdollymoxie', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(152), model_id: uuid(15), platform: 'twitter', handle: 'TsMoxiebby', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(153), model_id: uuid(15), platform: 'twitter', handle: 'isabelaramir3', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(154), model_id: uuid(15), platform: 'twitter', handle: 'moxiedollts', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },

  // LOLA — 3 X accounts
  { id: uuid(160), model_id: uuid(16), platform: 'twitter', handle: 'transbabydollx', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(161), model_id: uuid(16), platform: 'twitter', handle: 'TsLolaxox', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(162), model_id: uuid(16), platform: 'twitter', handle: 'bbytransgirlx', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },

  // MAPLE — 2 X accounts
  { id: uuid(170), model_id: uuid(17), platform: 'twitter', handle: 'LittlemapleB', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(171), model_id: uuid(17), platform: 'twitter', handle: 'BbyTransCutie', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },

  // OLIVIA — 5 X accounts
  { id: uuid(180), model_id: uuid(18), platform: 'twitter', handle: 'TsOliviaxSkye', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(181), model_id: uuid(18), platform: 'twitter', handle: 'TsOliviaSkyexox', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(182), model_id: uuid(18), platform: 'twitter', handle: 'Oliviacutiexxo', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(183), model_id: uuid(18), platform: 'twitter', handle: 'Oliviaskyexx', account_type: 'Farm', status: 'Active', health: 'Limited', assigned_operator: uuid(3) },
  { id: uuid(184), model_id: uuid(18), platform: 'twitter', handle: 'OliviaSkyexxo', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },

  // BELLA — 2 X accounts
  { id: uuid(190), model_id: uuid(19), platform: 'twitter', handle: 'dollytsbella', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(191), model_id: uuid(19), platform: 'twitter', handle: 'tsbelladollz', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },

  // ANGELMOON — 3 X accounts
  { id: uuid(200), model_id: uuid(20), platform: 'twitter', handle: 'SinnyRose', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(201), model_id: uuid(20), platform: 'twitter', handle: 'TsAngelMoon', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(202), model_id: uuid(20), platform: 'twitter', handle: 'cutieTsangel', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },

  // DAWN — 2 X accounts
  { id: uuid(210), model_id: uuid(21), platform: 'twitter', handle: 'dawnriveraa', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
  { id: uuid(211), model_id: uuid(21), platform: 'twitter', handle: 'Tsdawnbby', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },

  // GIA — 2 X accounts
  { id: uuid(220), model_id: uuid(22), platform: 'twitter', handle: 'Tsbbydollx', account_type: 'Primary', status: 'Active', health: 'Clean', assigned_operator: uuid(4) },
  { id: uuid(221), model_id: uuid(22), platform: 'twitter', handle: 'tsbbygf', account_type: 'Farm', status: 'Active', health: 'Clean', assigned_operator: uuid(3) },
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
  account_url: `https://x.com/${a.handle}`,
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

      // All accounts are Twitter/X for now
      snap.tw_impressions_7d = randBetween(10000, 200000)
      snap.tw_views_7d = randBetween(8000, 150000)
      snap.tw_retweets_7d = randBetween(50, 800)
      snap.tw_likes_7d = randBetween(200, 3000)
      snap.tw_replies_7d = randBetween(30, 500)
      snap.tw_link_clicks_7d = randBetween(10, 300)
      snap.tw_tweets_posted_7d = randBetween(5, 30)
      snap.tw_dms_sent_7d = randBetween(10, 100)
      snap.tw_dm_response_rate = parseFloat((rand() * 60 + 30).toFixed(1))

      snapshots.push(snap)
    }
  }
  return snapshots
}

export const mockSnapshots = generateSnapshots()

// ── Tasks ──
export const mockTasks = [
  { id: uuid(2000), title: 'Review Ariana primary analytics', description: 'Check weekly performance on main account', priority: 'high', assignee_id: uuid(3), account_id: uuid(100), status: 'open', created_by: uuid(2), completed_at: null, assignee: { id: uuid(3), display_name: 'Mike Ops' }, account: { id: uuid(100), handle: 'ArianaAngelsxo', platform: 'twitter' } },
  { id: uuid(2001), title: 'Fix Olivia limited account', description: 'Investigate limited status on Oliviaskyexx', priority: 'urgent', assignee_id: uuid(3), account_id: uuid(183), status: 'open', created_by: uuid(2), completed_at: null, assignee: { id: uuid(3), display_name: 'Mike Ops' }, account: { id: uuid(183), handle: 'Oliviaskyexx', platform: 'twitter' } },
  { id: uuid(2002), title: 'Warm up Indibaby farms', description: 'Get new farm accounts posting regularly', priority: 'normal', assignee_id: uuid(4), account_id: uuid(121), status: 'open', created_by: uuid(1), completed_at: null, assignee: { id: uuid(4), display_name: 'Jess Ops' }, account: { id: uuid(121), handle: 'TsIndigirlxo', platform: 'twitter' } },
  { id: uuid(2003), title: 'Post content for Moxie', description: 'Weekly content schedule across farm accounts', priority: 'normal', assignee_id: uuid(4), account_id: uuid(150), status: 'done', created_by: uuid(2), completed_at: daysAgo(2), assignee: { id: uuid(4), display_name: 'Jess Ops' }, account: { id: uuid(150), handle: 'moxiedoll', platform: 'twitter' } },
]

// ── Demo user for auth bypass ──
export const mockDemoUser = {
  id: uuid(1),
  email: 'admin@demo.com',
}

export const mockDemoProfile = mockProfiles[0]
