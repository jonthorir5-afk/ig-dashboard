import React, { useState, useEffect, useMemo } from 'react';
import { generateMockAccounts, ACCOUNT_STATUSES } from '../utils/mockData';
import { fetchGoogleSheetData } from '../utils/googleSheetsAPI';
import { evaluateAccountThresholds, dispatchTelegramAlert } from '../utils/alertSystem';
import AccountTable from './AccountTable';
import { TrendingUp, Users, Eye, AlertCircle, BarChart3, Target, Link as LinkIcon, Save, Database, Lock } from 'lucide-react';
import '../App.css';

const Dashboard = () => {
    const [accounts, setAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('igdash_auth') === 'true');
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');

    // Pre-configured Creators List
    const defaultCreators = [
        { name: 'Rose', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTrMyFopCThtzSKPIOuR5UF0m0StNugd-CFGWx1SxJBxp5KVvHuk-FZPH9afUAGMF3NTPey5IvtjAvs/pub?gid=1012951077&single=true&output=csv' },
        { name: 'Ariana', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJhDhB9GkbCSa9Udt2BAYyzbejqSP8MCvANrQastqV66JFXesocstJDw9fekVeurp_Iug8BneyKUtY/pub?gid=1012951077&single=true&output=csv' }
    ];

    const [creators, setCreators] = useState(() => {
        const saved = localStorage.getItem('igdash_creators');
        return saved ? JSON.parse(saved) : defaultCreators;
    });

    const [isAddingCreator, setIsAddingCreator] = useState(false);
    const [newCreatorName, setNewCreatorName] = useState('');
    const [newCreatorLink, setNewCreatorLink] = useState('');
    const [fetchError, setFetchError] = useState('');
    const [selectedModel, setSelectedModel] = useState('All');

    // Load Data Strategy
    const loadData = async () => {
        setIsLoading(true);
        setFetchError('');
        try {
            if (creators.length === 0) {
                setAccounts([]);
                setIsLoading(false);
                return;
            }

            // Fetch all creators concurrently
            const fetchPromises = creators.map(creator => fetchGoogleSheetData(creator.url, creator.name));
            const results = await Promise.all(fetchPromises);
            
            // Flatten the results into a single array
            let combinedData = results.flat();

            // Check thresholds upon loading live data
            combinedData.forEach(account => {
                if (evaluateAccountThresholds(account)) {
                    if (account.status !== ACCOUNT_STATUSES.WINNER) {
                        account.status = ACCOUNT_STATUSES.WINNER;
                        const trigger = 'Data Threshold Triggered in Live Sheet';
                        dispatchTelegramAlert(account, trigger);
                        console.log(`[UI] Alert Triggered for @${account.username}`);
                    }
                }
            });

            setAccounts(combinedData);
        } catch (error) {
            console.error("Failed to load Google Sheet data", error);
            setFetchError("Failed to load data for one or more creators. Please check the links.");
        } finally {
            setIsLoading(false);
        }
    };

    // Initialize Data
    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        } else {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, creators]);

    const handlePinSubmit = (e) => {
        e.preventDefault();
        if (pinInput === '5555') {
            localStorage.setItem('igdash_auth', 'true');
            setIsAuthenticated(true);
            setPinError('');
        } else {
            setPinError('Invalid PIN code');
            setPinInput('');
        }
    };

    const handleAddCreator = (e) => {
        e.preventDefault();
        if (newCreatorName && newCreatorLink) {
            const updatedCreators = [...creators, { name: newCreatorName, url: newCreatorLink }];
            setCreators(updatedCreators);
            localStorage.setItem('igdash_creators', JSON.stringify(updatedCreators));
            setIsAddingCreator(false);
            setNewCreatorName('');
            setNewCreatorLink('');
        }
    };

    const loadMockData = () => {
        setIsLoading(true);
        setTimeout(() => {
            setAccounts(generateMockAccounts(50));
            setIsLoading(false);
            setFetchError('');
        }, 800);
    };

    const availableModels = useMemo(() => {
        const models = new Set(accounts.map(acc => acc.model).filter(Boolean));
        return ['All', ...Array.from(models).sort()];
    }, [accounts]);

    const displayedAccounts = useMemo(() => {
        if (selectedModel === 'All') return accounts;
        return accounts.filter(acc => acc.model === selectedModel);
    }, [accounts, selectedModel]);

    // Calculate Summary Metrics
    const metrics = useMemo(() => {
        if (!displayedAccounts.length) return {
            totalViews: 0,
            totalFollowers: 0,
            winnersCount: 0,
            scalingCount: 0,
            avgEngagement: 0,
            totalOfSubscribers: 0
        };

        const totalViews = displayedAccounts.reduce((acc, curr) => acc + (curr.totalViews || 0), 0);
        const totalFollowers = displayedAccounts.reduce((acc, curr) => acc + (curr.followers || 0), 0);
        const totalOfSubscribers = displayedAccounts.reduce((acc, curr) => acc + (curr.ofSubscribers || 0), 0);
        const winnersCount = displayedAccounts.filter(a => a.status === ACCOUNT_STATUSES.WINNER).length;
        const scalingCount = displayedAccounts.filter(a => a.status === ACCOUNT_STATUSES.SCALING).length;

        // Avg engagement purely across active accounts
        const activeAccounts = displayedAccounts.filter(a => a.status !== ACCOUNT_STATUSES.CREATED);
        const avgEngagement = activeAccounts.length
            ? (activeAccounts.reduce((acc, curr) => acc + (curr.engagementRate || 0), 0) / activeAccounts.length).toFixed(1)
            : 0;

        return { totalViews, totalFollowers, winnersCount, scalingCount, avgEngagement, totalOfSubscribers };
    }, [displayedAccounts]);

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

    if (!isAuthenticated) {
        return (
            <div className="dashboard-container flex-center" style={{ height: '100vh' }}>
                <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '40px', textAlign: 'center' }}>
                    <div className="flex-center" style={{ marginBottom: '24px', color: 'var(--accent-primary)' }}>
                        <Lock size={48} />
                    </div>
                    <h2 style={{ marginBottom: '8px' }}>Private Access</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                        Please enter your PIN to continue
                    </p>

                    <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <input
                            type="password"
                            className="search-bar"
                            style={{ 
                                width: '100%', 
                                padding: '16px', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                background: 'rgba(0,0,0,0.2)', 
                                color: 'white',
                                textAlign: 'center',
                                fontSize: '24px',
                                letterSpacing: '8px'
                            }}
                            placeholder="••••"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            maxLength={4}
                            autoFocus
                        />
                        {pinError && <p style={{ color: 'var(--alert-error)', fontSize: '14px', margin: 0 }}>{pinError}</p>}
                        
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '16px' }}>
                            Unlock Dashboard
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1 className="text-gradient">Performance Overview</h1>
                    <p>Tracking {displayedAccounts.length} active Instagram accounts</p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-outline tooltip" data-tip="Add Creator CSV" onClick={() => setIsAddingCreator(true)}>
                        <Database size={16} /> Addition
                    </button>
                    <button className="btn btn-primary" onClick={() => loadData()}>
                        <TrendingUp size={16} />
                        Sync Now
                    </button>
                </div>
            </div>

            {/* Model Toggle Strip */}
            {availableModels.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {availableModels.map(model => (
                        <button
                            key={model}
                            className={`btn ${selectedModel === model ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setSelectedModel(model)}
                            style={{ whiteSpace: 'nowrap', borderRadius: '20px', padding: '6px 16px' }}
                        >
                            {model}
                        </button>
                    ))}
                </div>
            )}

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
                    accounts={displayedAccounts}
                    onStatusChange={handleStatusChange}
                />
            </div>

            {/* Add Creator Modal */}
            {isAddingCreator && (
                <div className="modal-overlay" onClick={() => setIsAddingCreator(false)}>
                    <div className="glass-panel" style={{ maxWidth: '500px', width: '90%', padding: '30px' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '20px' }}>Add New Creator Source</h3>
                        <form onSubmit={handleAddCreator} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Creator Name</label>
                                <input
                                    type="text"
                                    required
                                    className="search-bar"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                                    placeholder="e.g. Bella"
                                    value={newCreatorName}
                                    onChange={(e) => setNewCreatorName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Public CSV Link</label>
                                <input
                                    type="url"
                                    required
                                    className="search-bar"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                                    placeholder="https://docs.google.com/..."
                                    value={newCreatorLink}
                                    onChange={(e) => setNewCreatorLink(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIsAddingCreator(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                                    Add Source
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
