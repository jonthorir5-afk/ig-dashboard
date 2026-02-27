import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, ArrowUpRight, Copy } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { ACCOUNT_STATUSES } from '../utils/mockData';

const AccountTable = ({ accounts, onStatusChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'totalViews', direction: 'desc' });

    // Filter and Sort Logic
    const filteredData = useMemo(() => {
        let result = accounts;

        if (searchTerm) {
            result = result.filter(acc =>
                acc.username.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'All') {
            result = result.filter(acc => acc.status === statusFilter);
        }

        if (sortConfig.key) {
            result.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return result;
    }, [accounts, searchTerm, statusFilter, sortConfig]);

    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div className="table-wrapper">
            <div className="table-controls">
                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search accounts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <Filter size={18} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="status-dropdown"
                    >
                        <option value="All">All Statuses</option>
                        {Object.values(ACCOUNT_STATUSES).map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="table-responsive">
                <table className="accounts-table">
                    <thead>
                        <tr>
                            <th>Account</th>
                            <th className="sortable" onClick={() => requestSort('status')}>
                                Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('totalViews')}>
                                Total Views {sortConfig.key === 'totalViews' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('followers')}>
                                Followers {sortConfig.key === 'followers' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('engagementRate')}>
                                Engagement {sortConfig.key === 'engagementRate' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('hoursActive')}>
                                Hours Active {sortConfig.key === 'hoursActive' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('ofSubscribers')} style={{ color: 'var(--accent-secondary)' }}>
                                OF Subs {sortConfig.key === 'ofSubscribers' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length > 0 ? (
                            filteredData.map((account, index) => (
                                <tr key={account.id} className={account.status === ACCOUNT_STATUSES.WINNER ? 'highlight-row' : ''}>
                                    <td>
                                        <div className="account-identifier">
                                            <div className="account-avatar flex-center">
                                                {account.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="account-names">
                                                <strong>@{account.username}</strong>
                                                <span className="account-id">{account.id}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <StatusBadge status={account.status} />
                                        {account.isNew && <span className="new-tag ml-2">NEW</span>}
                                    </td>
                                    <td className="numeric font-semibold">
                                        {formatNumber(account.totalViews)}
                                    </td>
                                    <td className="numeric">
                                        <span className="font-semibold">{formatNumber(account.followers)}</span>
                                        <span className="velocity-badge">{account.velocity}</span>
                                    </td>
                                    <td className="numeric">
                                        {account.engagementRate}%
                                    </td>
                                    <td className="numeric">
                                        {account.hoursActive}h
                                    </td>
                                    <td className="numeric font-semibold" style={{ color: 'var(--accent-secondary)' }}>
                                        {formatNumber(account.ofSubscribers || 0)}
                                    </td>
                                    <td className="actions-cell">
                                        <button className="icon-btn tooltip" data-tip="Copy Link">
                                            <Copy size={16} />
                                        </button>
                                        <button className="icon-btn tooltip text-accent" data-tip="Open IG">
                                            <ArrowUpRight size={16} />
                                        </button>

                                        {account.status === ACCOUNT_STATUSES.WINNER && (
                                            <button
                                                className="btn btn-outline text-xs px-2 py-1 ml-2"
                                                onClick={() => onStatusChange(account.id, ACCOUNT_STATUSES.SCALING)}
                                            >
                                                Start Scaling
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="8" className="empty-state">
                                    No accounts found matching criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AccountTable;
