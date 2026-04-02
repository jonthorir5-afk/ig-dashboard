import { schedule } from '@netlify/functions';

// Run every midnight UTC (0 0 * * *)
export const handler = schedule('0 0 * * *', async (event) => {
  // process.env.URL is populated by Netlify with the site's URL
  const baseUrl = process.env.URL || 'http://localhost:8888';

  console.log('Triggering daily automated syncs...');
  
  try {
    // Trigger Instagram
    console.log('Syncing Instagram...');
    await fetch(`${baseUrl}/.netlify/functions/sync-instagram`, { method: 'POST' });

    // Trigger Twitter
    console.log('Syncing Twitter...');
    await fetch(`${baseUrl}/.netlify/functions/sync-twitter`, { method: 'POST' });

    // Trigger Reddit
    console.log('Syncing Reddit...');
    await fetch(`${baseUrl}/.netlify/functions/sync-reddit`, { method: 'POST' });

    // Trigger OnlyFans
    console.log('Syncing OnlyFans...');
    await fetch(`${baseUrl}/.netlify/functions/sync-onlyfans`, { method: 'POST' });

    console.log('Daily automated syncs completed successfully.');
  } catch (err) {
    console.error('Error during scheduled syncs:', err);
  }

  return {
    statusCode: 200,
  };
});
