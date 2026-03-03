import Papa from 'papaparse';
import { ACCOUNT_STATUSES } from './mockData'; // Fallback statuses

/**
 * Fetches a public Google Sheets CSV URL and parses it using PapaParse.
 * Attempt to map common column names to our internal data model.
 */
export const fetchGoogleSheetData = (csvUrl) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors && results.errors.length > 0) {
                    console.error('PapaParse Errors:', results.errors);
                }

                const parsedData = results.data.map((row, index) => {
                    const usernameStr = row['Suggested Username'] || row['IG Link']?.split('/').pop() || `account_${index + 1}`;
                    const rawDate = row['Date Created'] || new Date().toISOString();

                    return {
                        id: row['Account ID'] || `ig-${index + 1}`,
                        username: usernameStr.replace('@', ''),
                        model: row['Model'] || row['Creator'] || 'Unknown Model',
                        createdAt: rawDate,

                        // Parse numbers if they exist, otherwise fallback to 0
                        followers: parseInt(row['Followers'] || 0, 10),
                        totalViews: parseInt(row['Total Views'] || 0, 10),
                        engagementRate: parseFloat(row['Engagement Rate'] || 0),
                        ofSubscribers: parseInt(row['OF Subs'] || 0, 10),
                        hoursActive: 0, // Keeping for internal logic compatibility if needed later
                        likes: 0,
                        comments: 0,

                        email: row['Hide My Email'] || '',
                        password: row['Password'] || '',
                        juicyLink: row['JuicyLink'] || '',
                        igLink: row['IG Link'] || '',
                        status: mapStatus(row['Status']),
                        velocity: 'N/A',
                        isNew: false,
                        originalRow: row // Save original for debugging or dynamic rendering
                    };
                });
                // Filter out accounts that are not currently active, scaling, or winners
                const activeData = parsedData.filter(account =>
                    account.status === ACCOUNT_STATUSES.ACTIVE ||
                    account.status === ACCOUNT_STATUSES.SCALING ||
                    account.status === ACCOUNT_STATUSES.WINNER
                );
                resolve(activeData);
            },
            error: (error) => {
                reject(error);
            }
        });
    });
};

const mapStatus = (rawStatus) => {
    if (!rawStatus) return ACCOUNT_STATUSES.CREATED;
    const lower = String(rawStatus).toLowerCase();

    if (lower.includes('winner')) return ACCOUNT_STATUSES.WINNER;
    if (lower.includes('scaling')) return ACCOUNT_STATUSES.SCALING;
    if (lower.includes('active')) return ACCOUNT_STATUSES.ACTIVE;

    // Default fallback
    return ACCOUNT_STATUSES.CREATED;
};
