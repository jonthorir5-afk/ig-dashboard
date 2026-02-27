// Mock Telegram Alert Dispatcher

export const evaluateAccountThresholds = (account) => {
    // Threshold Rule: > 15,000 views AND < 48 hours old
    // Or > 500 followers AND < 48 hours old

    if (account.status === 'Created' || account.status === 'Active') {
        if ((account.totalViews > 15000 || account.followers > 500) && account.hoursActive <= 48) {
            return true; // Threshold hit
        }
    }
    return false;
};

export const dispatchTelegramAlert = async (account, metricTriggerMessage) => {
    // In a real application, this would be an API fetch to a backend endpoint 
    // that securely holds the Telegram Bot Token. 

    const payload = {
        chat_id: 'YOUR_PRIVATE_CHANNEL_ID',
        text: `🚨 NEW WINNER DETECTED 🚨\n\n` +
            `Account: @${account.username}\n` +
            `ID: ${account.id}\n` +
            `Trigger: ${metricTriggerMessage}\n\n` +
            `📊 Metrics:\n` +
            `- Views: ${account.totalViews.toLocaleString()}\n` +
            `- Followers: ${account.followers.toLocaleString()}\n` +
            `- Age: ${account.hoursActive} hours\n\n` +
            `🔗 Link: https://instagram.com/${account.username}`
    };

    console.group('🚀 [MOCK] Telegram Alert Dispatched');
    console.log('Sending message to Telegram API...', payload);
    console.groupEnd();

    // Simulate network delay
    return new Promise(resolve => setTimeout(() => resolve(true), 500));
};
