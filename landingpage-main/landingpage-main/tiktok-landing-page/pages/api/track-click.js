// pages/api/track-click.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { linkId, creatorName, timestamp } = req.body;

    // REPLACE THIS WITH YOUR MAKE.COM WEBHOOK URL
    const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || 'YOUR_MAKE_WEBHOOK_URL_HERE';

    try {
        if (MAKE_WEBHOOK_URL !== 'YOUR_MAKE_WEBHOOK_URL_HERE') {
            await fetch(MAKE_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    linkId,
                    creatorName,
                    timestamp,
                    event: 'onlyfans_click'
                }),
            });
            console.log(`[Tracking] Sent click for ${linkId} to Make.com`);
        } else {
            console.log(`[Tracking] Simulated click for ${linkId} (No Webhook URL configured)`);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('[Tracking] Error sending webhook:', error);
        return res.status(500).json({ success: false, error: 'Failed to track' });
    }
}
