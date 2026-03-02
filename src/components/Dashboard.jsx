import React, { useState, useEffect, useMemo } from 'react';
import { generateMockAccounts, ACCOUNT_STATUSES } from '../utils/mockData';
import { fetchGoogleSheetData } from '../utils/googleSheetsAPI';
import { evaluateAccountThresholds, dispatchTelegramAlert } from '../utils/alertSystem';
import AccountTable from './AccountTable';
import { TrendingUp, Users, Eye, AlertCircle, BarChart3, Target, Link as LinkIcon, Save, Database } from 'lucide-react';
import '../App.css';

const Dashboard = () => {
    const [accounts, setAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sheetUrl, setSheetUrl] = useState(localStorage.getItem('igdash_sheet_url') || '');
    const [isConfiguring, setIsConfiguring] = useState(!localStorage.getItem('igdash_sheet_url'));
    const [fetchError, setFetchError] = useState('');

    // Load Data Strategy
    const loadData = async (urlToFetch) => {
        setIsLoading(true);
        setFetchError('');
        try {
            if (!urlToFetch) throw new Error("No URL provided");
            const liveData = await fetchGoogleSheetData(urlToFetch);

            // Check thresholds upon loading live data
            liveData.forEach(account => {
                if (evaluateAccountThresholds(account)) {
                    if (account.status !== ACCOUNT_STATUSES.WINNER) {
                        account.status = ACCOUNT_STATUSES.WINNER;
                        const trigger = 'Data Threshold Triggered in Live Sheet';
                        dispatchTelegramAlert(account, trigger);
                        console.log(`[UI] Alert Triggered for @${account.username}`);
                    }
                }
            });

            setAccounts(liveData);
            setIsConfiguring(false);
        } catch (error) {
            console.error("Failed to load Google Sheet data", error);
            setFetchError("Failed to load data. Please ensure it is a valid public CSV link.");
            // If it fails, fallback to rendering nothing or keep them in config mode
            setIsConfiguring(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Initialize Data
    useEffect(() => {
        if (!isConfiguring && sheetUrl) {
            loadData(sheetUrl);
        } else {
            setIsLoading(false);
        }
    }, []);

    const handleSaveUrl = () => {
        if (sheetUrl.trim()) {
            localStorage.setItem('igdash_sheet_url', sheetUrl.trim());
            loadData(sheetUrl.trim());
        }
    };

    const loadMockData = () => {
        setIsLoading(true);
        setTimeout(() => {
            setAccounts(generateMockAccounts(50));
            setIsConfiguring(false);
            setIsLoading(false);
            setFetchError('');
        }, 800);
    };

    // Calculate Summary Metrics
    const metrics = useMemo(() => {
        if (!accounts.length) return {
            totalViews: 0,
            totalFollowers: 0,
            winnersCount: 0,
            scalingCount: 0,
            avgEngagement: 0,
            totalOfSubscribers: 0
        };

        const totalViews = accounts.reduce((acc, curr) => acc + (curr.totalViews || 0), 0);
        const totalFollowers = accounts.reduce((acc, curr) => acc + (curr.followers || 0), 0);
        const totalOfSubscribers = accounts.reduce((acc, curr) => acc + (curr.ofSubscribers || 0), 0);
        const winnersCount = accounts.filter(a => a.status === ACCOUNT_STATUSES.WINNER).length;
        const scalingCount = accounts.filter(a => a.status === ACCOUNT_STATUSES.SCALING).length;

        // Avg engagement purely across active accounts
        const activeAccounts = accounts.filter(a => a.status !== ACCOUNT_STATUSES.CREATED);
        const avgEngagement = activeAccounts.length
            ? (activeAccounts.reduce((acc, curr) => acc + (curr.engagementRate || 0), 0) / activeAccounts.length).toFixed(1)
            : 0;

        return { totalViews, totalFollowers, winnersCount, scalingCount, avgEngagement, totalOfSubscribers };
    }, [accounts]);

    const handleStatusChange = (accountId, newStatus) => {
        setAccounts(prev =>
            prev.map(acc => acc.id === accountId ? { ...acc, status: newStatus } : acc)
        );
        // Note: In a real system, changing status here should hit a backend to update the Google Sheet,
        // or trigger a webhook. For now it is only local to the UI.
    };

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    if (isLoading) {
        return (
            <div className="flex-center" style={{ height: '100%', minHeight: '60vh' }}>
                <div className="loader"></div>
                <p style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Syncing Data from Remote Source...</p>
            </div>
        );
    }

    if (isConfiguring) {
        return (
            <div className="dashboard-container">
                <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '30px', textAlign: 'center' }}>
                    <div className="flex-center" style={{ marginBottom: '20px', color: 'var(--accent-primary)' }}>
                        <Database size={48} />
                    </div>
                    <h2 style={{ marginBottom: '10px' }}>Connect Data Source</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', lineHeight: '1.6' }}>
                        To power this dashboard, please provide a public Google Sheets CSV link.
                        <br />(File &gt; Share &gt; Publish to web &gt; CSV)
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="search-bar"
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                        />
                        {fetchError && <p style={{ color: 'var(--alert-error)', fontSize: '14px', margin: 0 }}>{fetchError}</p>}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', width: '100%' }}>
                            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveUrl}>
                                <Save size={18} /> Connect Data
                            </button>
                            <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={loadMockData}>
                                Use Demo Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1 className="text-gradient">Performance Overview</h1>
                    <p>Tracking {accounts.length} active Instagram accounts</p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-outline tooltip" data-tip="Change Data Source" onClick={() => setIsConfiguring(true)}>
                        <LinkIcon size={16} />
                    </button>
                    <button className="btn btn-primary" onClick={() => loadData(sheetUrl)}>
                        <TrendingUp size={16} />
                        Sync Now
                    </button>
                </div>
            </div>

            {/* Summary Cards Grid */}
            <div className="metrics-grid">
                <div className="metric-card glass-panel">
                    <div className="metric-icon views">
                        <Eye size={24} />
                    </div>
                    <div className="metric-data">
                        <p className="metric-label">Total Network Views</p>
                        <h3 className="metric-value">{formatNumber(metrics.totalViews)}</h3>
                        <span className="metric-trend positive">+12.5% today</span>
                    </div>
                </div>

                <div className="metric-card glass-panel">
                    <div className="metric-icon followers">
                        <Users size={24} />
                    </div>
                    <div className="metric-data">
                        <p className="metric-label">Total Gained Followers</p>
                        <h3 className="metric-value">{formatNumber(metrics.totalFollowers)}</h3>
                        <span className="metric-trend positive">+8.2% today</span>
                    </div>
                </div>

                <div className="metric-card glass-panel">
                    <div className="metric-icon engagement">
                        <BarChart3 size={24} />
                    </div>
                    <div className="metric-data">
                        <p className="metric-label">Avg Engagement Rate</p>
                        <h3 className="metric-value">{metrics.avgEngagement}%</h3>
                        <span className="metric-trend neutral">Stable</span>
                    </div>
                </div>

                <div className="metric-card glass-panel highlight">
                    <div className="metric-icon winners">
                        <Target size={24} />
                    </div>
                    <div className="metric-data">
                        <p className="metric-label">Identified Winners</p>
                        <h3 className="metric-value">{metrics.winnersCount}</h3>
                        <span className="metric-text">{metrics.scalingCount} currently scaling</span>
                    </div>
                </div>

                <div className="metric-card glass-panel" style={{ borderColor: 'var(--accent-secondary)' }}>
                    <div className="metric-icon" style={{ background: 'rgba(236, 72, 153, 0.2)', color: 'var(--accent-secondary)' }}>
                        <Users size={24} />
                    </div>
                    <div className="metric-data">
                        <p className="metric-label">Total OF Subscribers</p>
                        <h3 className="metric-value">{formatNumber(metrics.totalOfSubscribers)}</h3>
                        <span className="metric-trend positive">Estimated Conversions</span>
                    </div>
                </div>
            </div>

            {/* Leaderboard Section */}
            <div className="leaderboard-section glass-panel">
                <div className="section-header">
                    <h2>Account Leaderboard</h2>
                    <div className="header-actions">
                    </div>
                </div>

                <AccountTable
                    accounts={accounts}
                    onStatusChange={handleStatusChange}
                />
            </div>
        </div>
    );
};

export default Dashboard;
