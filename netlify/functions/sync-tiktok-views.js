import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const APIFY_TOKEN = process.env.APIFY_TOKEN

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 })
  }

  if (!APIFY_TOKEN) {
    return new Response(JSON.stringify({ error: 'APIFY_TOKEN not configured' }), { status: 500 })
  }

  // Fetch all active TikTok accounts
  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('id, handle, model_id')
    .eq('platform', 'tiktok')
    .eq('status', 'Active')

  if (accErr) {
    return new Response(JSON.stringify({ error: accErr.message }), { status: 500 })
  }

  if (!accounts.length) {
    return new Response(JSON.stringify({ synced: 0, errors: ['No active TikTok accounts found in database. Did you run supabase-add-rose-tiktok.sql?'], details: [] }))
  }

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const results = { synced: 0, skipped: 0, errors: [], details: [] }

  // Build profiles list (strip leading @)
  const profiles = accounts.map(a => a.handle.replace('@', ''))
  results._dbAccounts = accounts.map(a => a.handle)

  try {
    // Use clockworks/tiktok-scraper to get recent videos per profile
    // Process in batches of 5 to avoid timeouts
    const batchSize = 5
    for (let i = 0; i < profiles.length; i += batchSize) {
      const batchProfiles = profiles.slice(i, i + batchSize)
      const batchAccounts = accounts.slice(i, i + batchSize)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 90000) // 90s timeout

      try {
        const runRes = await fetch(
          `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              profiles: batchProfiles,
              resultsPerPage: 30, // ~30 recent videos per profile
              shouldDownloadVideos: false,
            }),
          }
        )
        clearTimeout(timer)

        if (!runRes.ok) {
          const errText = await runRes.text()
          results.errors.push(`Apify error ${runRes.status}: ${errText.slice(0, 200)}`)
          continue
        }

        const responseText = await runRes.text()
        let videos
        try {
          videos = JSON.parse(responseText)
        } catch {
          results.errors.push(`Non-JSON response from Apify: ${responseText.slice(0, 300)}`)
          continue
        }

        if (!Array.isArray(videos)) {
          results.errors.push(`Apify returned non-array: ${JSON.stringify(videos).slice(0, 300)}`)
          continue
        }

        results._apifyVideoCount = (results._apifyVideoCount || 0) + videos.length

        // Debug: capture first video's structure to help diagnose field names
        if (videos.length > 0 && i === 0) {
          const sample = videos[0]
          results._debug = {
            totalVideos: videos.length,
            sampleAuthorFields: {
              'authorMeta.name': sample.authorMeta?.name,
              'authorMeta.uniqueId': sample.authorMeta?.uniqueId,
              'authorMeta.nickName': sample.authorMeta?.nickName,
              'authorMeta.id': sample.authorMeta?.id,
              'authorMeta.fans': sample.authorMeta?.fans,
              'author.uniqueId': sample.author?.uniqueId,
              'author': typeof sample.author === 'string' ? sample.author : undefined,
              'authorUniqueId': sample.authorUniqueId,
            },
            sampleTimeFields: {
              'createTimeISO': sample.createTimeISO,
              'createTime': sample.createTime,
              'createTimeType': typeof sample.createTime,
            },
            sampleStatFields: {
              'playCount': sample.playCount,
              'diggCount': sample.diggCount,
              'commentCount': sample.commentCount,
              'shareCount': sample.shareCount,
            },
            dbHandles: batchAccounts.map(a => a.handle),
          }
        }

        // Group videos by author and bucket into 7d/30d windows
        const statsByUser = {}
        for (const video of videos) {
          // TikTok scrapers use various field names for the username:
          // - authorMeta.uniqueId = the actual TikTok handle (e.g. "porcelain.ts.girl")
          // - authorMeta.name = can be display name OR username depending on scraper version
          // - author.uniqueId = alternative location
          const author = (
            video.authorMeta?.uniqueId ||
            video.authorMeta?.name ||
            video.author?.uniqueId ||
            video.authorUniqueId ||
            ''
          ).toLowerCase()
          if (!author) continue

          // Parse video creation time — handle both unix timestamps and ISO strings
          const createTime = video.createTimeISO || video.createTime
          if (!createTime) continue
          let videoDate
          if (typeof createTime === 'number') {
            videoDate = new Date(createTime * 1000)
          } else if (typeof createTime === 'string' && /^\d+$/.test(createTime)) {
            // String-encoded unix timestamp (e.g. "1711900000")
            videoDate = new Date(parseInt(createTime, 10) * 1000)
          } else {
            videoDate = new Date(createTime)
          }
          if (isNaN(videoDate.getTime())) continue

          // Skip videos older than 30 days
          if (videoDate < thirtyDaysAgo) continue

          const plays = parseInt(video.playCount || video.plays || 0, 10) || 0
          const likes = parseInt(video.diggCount || video.likes || 0, 10) || 0
          const comments = parseInt(video.commentCount || video.comments || 0, 10) || 0
          const shares = parseInt(video.shareCount || video.shares || 0, 10) || 0

          if (!statsByUser[author]) {
            statsByUser[author] = {
              views7d: 0, views30d: 0,
              likes7d: 0, comments7d: 0, shares7d: 0,
              videos7d: 0, videos30d: 0,
              followers: null,
            }
          }

          // 30d totals
          statsByUser[author].views30d += plays
          statsByUser[author].videos30d++

          // 7d totals
          if (videoDate >= sevenDaysAgo) {
            statsByUser[author].views7d += plays
            statsByUser[author].likes7d += likes
            statsByUser[author].comments7d += comments
            statsByUser[author].shares7d += shares
            statsByUser[author].videos7d++
          }

          // Grab follower count from author meta if available
          const followerCount = video.authorMeta?.fans || video.authorMeta?.followers
          if (followerCount && !statsByUser[author].followers) {
            statsByUser[author].followers = parseInt(followerCount, 10) || null
          }
        }

        // Debug: show which authors were found in scraper output
        results._authorsFound = Object.keys(statsByUser)

        // Update snapshots for each account in this batch
        for (const account of batchAccounts) {
          const handle = account.handle.replace('@', '').toLowerCase()
          const userData = statsByUser[handle]

          if (!userData) {
            results.skipped++
            results.errors.push(`@${handle}: no videos found. Authors in data: [${Object.keys(statsByUser).join(', ')}]`)
            continue
          }

          const snapshotData = {
            tt_views_7d: userData.views7d,
            tt_likes_7d: userData.likes7d,
            tt_comments_7d: userData.comments7d,
            tt_shares_7d: userData.shares7d,
            tt_videos_posted_7d: userData.videos7d,
          }

          // Also update followers if we got it from the scraper
          if (userData.followers) {
            snapshotData.followers = userData.followers
          }

          // Check if snapshot exists for today
          const { data: existing } = await supabase
            .from('snapshots')
            .select('id')
            .eq('account_id', account.id)
            .eq('snapshot_date', today)
            .limit(1)

          if (existing && existing.length > 0) {
            const { error: upErr } = await supabase
              .from('snapshots')
              .update(snapshotData)
              .eq('id', existing[0].id)
            if (upErr) {
              results.errors.push(`@${handle}: update failed — ${upErr.message}`)
            } else {
              results.details.push({
                handle, action: 'updated',
                views_7d: userData.views7d, views_30d: userData.views30d,
                videos_7d: userData.videos7d, followers: userData.followers,
              })
              results.synced++
            }
          } else {
            const { error: insErr } = await supabase
              .from('snapshots')
              .insert({
                account_id: account.id,
                snapshot_date: today,
                captured_by: 'API-TikTok',
                ...snapshotData,
              })
            if (insErr) {
              results.errors.push(`@${handle}: insert failed — ${insErr.message}`)
            } else {
              results.details.push({
                handle, action: 'created',
                views_7d: userData.views7d, views_30d: userData.views30d,
                videos_7d: userData.videos7d, followers: userData.followers,
              })
              results.synced++
            }
          }
        }
      } catch (err) {
        clearTimeout(timer)
        if (err.name === 'AbortError') {
          results.errors.push(`Batch ${i / batchSize + 1} timed out after 90s`)
        } else {
          results.errors.push(`Batch ${i / batchSize + 1} error: ${err.message}`)
        }
      }
    }
  } catch (err) {
    results.errors.push(`Request failed: ${err.message}`)
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
