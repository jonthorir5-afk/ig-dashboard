import React, { useState, useEffect, useMemo } from 'react';
import { generateMockAccounts, ACCOUNT_STATUSES } from '../utils/mockData';
import { evaluateAccountThresholds, dispatchTelegramAlert } from '../utils/alertSystem';
import AccountTable from './AccountTable';
import { TrendingUp, Users, Eye, AlertCircle, BarChart3, Target } from 'lucide-react';
import '../App.css';

const Dashboard = () => {
    const [accounts, setAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize Data
    useEffect(() => {
        // Simulate API load
        setTimeout(() => {
            const initialAccounts = generateMockAccounts(124);

            // Check for newly hit thresholds on load
            initialAccounts.forEach(account => {
                if (evaluateAccountThresholds(account)) {
                    // Update to winner if we caught a threshold crossing early
                    if (account.status !== ACCOUNT_STATUSES.WINNER) {
                        account.status = ACCOUNT_STATUSES.WINNER;
                        const trigger = account.totalViews > 15000 ? '> 15k Views in <48 hrs' : '> 500 Followers in <48 hrs';
                        dispatchTelegramAlert(account, trigger);
                        console.log(`[UI] Alert Triggered for @${account.username}`);
                    }
                }
            });

            setAccounts(initialAccounts);
            setIsLoading(false);
        }, 800);
    }, []);

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

        const totalViews = accounts.reduce((acc, curr) => acc + curr.totalViews, 0);
        const totalFollowers = accounts.reduce((acc, curr) => acc + curr.followers, 0);
        const totalOfSubscribers = accounts.reduce((acc, curr) => acc + (curr.ofSubscribers || 0), 0);
        const winnersCount = accounts.filter(a => a.status === ACCOUNT_STATUSES.WINNER).length;
        const scalingCount = accounts.filter(a => a.status === ACCOUNT_STATUSES.SCALING).length;

        // Avg engagement purely across active accounts
        const activeAccounts = accounts.filter(a => a.status !== ACCOUNT_STATUSES.CREATED);
        const avgEngagement = activeAccounts.length
            ? (activeAccounts.reduce((acc, curr) => acc + curr.engagementRate, 0) / activeAccounts.length).toFixed(1)
            : 0;

        return { totalViews, totalFollowers, winnersCount, scalingCount, avgEngagement, totalOfSubscribers };
    }, [accounts]);

    const handleStatusChange = (accountId, newStatus) => {
        setAccounts(prev =>
            prev.map(acc => acc.id === accountId ? { ...acc, status: newStatus } : acc)
        );
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
                <p style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Syncing Accounts...</p>
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

                <button className="btn btn-primary" onClick={() => setAccounts(generateMockAccounts(124))}>
                    <TrendingUp size={16} />
                    Refresh Data
                </button>
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
                        <span className="metric-trend positive">From Juicy.bio Links</span>
                    </div>
                </div>
            </div>

            {/* Leaderboard Section */}
            <div className="leaderboard-section glass-panel">
                <div className="section-header">
                    <h2>Account Leaderboard</h2>
                    <div className="header-actions">
                        {/* We will build out filters here inside AccountTable */}
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
