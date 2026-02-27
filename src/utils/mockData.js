export const ACCOUNT_STATUSES = {
    CREATED: 'Created',
    ACTIVE: 'Active',
    WINNER: 'Winner',
    SCALING: 'Scaling on Pixel'
};

const firstNames = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Avery', 'Sam', 'Skyler'];
const niches = ['travel', 'fitness', 'finance', 'luxury', 'tech', 'quotes', 'motivation'];

export const generateMockAccounts = (count = 100) => {
    const accounts = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
        // Distribute creation dates between now and 7 days ago
        const hoursAgo = Math.floor(Math.random() * (7 * 24));
        const createdAt = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
        const isNew = hoursAgo < 48;

        // Generate realistic metrics
        // Winners should be 10-15% of accounts
        const isPotentialWinner = Math.random() < 0.15;

        // Base views depending on if it's hitting the algorithm
        const totalViews = isPotentialWinner
            ? Math.floor(Math.random() * 80000) + 10000
            : Math.floor(Math.random() * 5000);

        // Followers correlate somewhat with views
        const conversionRate = (Math.random() * 0.02) + 0.005; // 0.5% to 2.5% conversion
        const followers = Math.floor(totalViews * conversionRate) + (Math.floor(Math.random() * 50));

        // Engagement
        const likes = Math.floor(totalViews * ((Math.random() * 0.1) + 0.02)); // 2% to 12% like rate
        const comments = Math.floor(likes * ((Math.random() * 0.05) + 0.01)); // 1% to 6% comment rate
        const engagementRate = ((likes + comments) / totalViews * 100).toFixed(2);

        // Initial status logic
        let status = ACCOUNT_STATUSES.CREATED;
        if (hoursAgo > 12) status = ACCOUNT_STATUSES.ACTIVE;

        // Mark as winner if metrics exceed arbitrary thresholds and it's somewhat new
        if ((totalViews > 15000 || followers > 500) && status !== ACCOUNT_STATUSES.CREATED) {
            status = ACCOUNT_STATUSES.WINNER;
        }

        // Simulate OnlyFans Subscribers (Juicy.bio Conversion)
        // Only Active/Winner/Scaling accounts start converting traffic
        let ofSubscribers = 0;
        if (status !== ACCOUNT_STATUSES.CREATED) {
            // Conversion from views->click->sub is typically very small. ~0.01% to 0.1% of views
            const ofConversionRate = (Math.random() * 0.001) + 0.0001;
            ofSubscribers = Math.floor(totalViews * ofConversionRate);

            // Winners naturally convert slightly better due to audience engagement
            if (status === ACCOUNT_STATUSES.WINNER || status === ACCOUNT_STATUSES.SCALING) {
                ofSubscribers += Math.floor(Math.random() * 5) + 2;
            }
        }

        // Small chance a winner was already moved to scaling
        if (status === ACCOUNT_STATUSES.WINNER && hoursAgo > 72 && Math.random() > 0.5) {
            status = ACCOUNT_STATUSES.SCALING;
        }

        const niche = niches[Math.floor(Math.random() * niches.length)];
        const username = `${firstNames[Math.floor(Math.random() * firstNames.length)]}_${niche}_${Math.floor(Math.random() * 999)}`;

        accounts.push({
            id: `ig-${1000 + i}`,
            username: username.toLowerCase(),
            createdAt: createdAt.toISOString(),
            hoursActive: hoursAgo,
            totalViews,
            followers,
            engagementRate: parseFloat(engagementRate) || 0,
            likes,
            comments,
            ofSubscribers,
            status,
            // Velocity: followers gained in last 24h as a percentage of total
            velocity: isNew ? '+' + followers : '+' + Math.floor(followers * (Math.random() * 0.4)),
            isNew // Flag for < 48hrs
        });
    }

    return accounts;
};
