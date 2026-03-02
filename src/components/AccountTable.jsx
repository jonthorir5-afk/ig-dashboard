import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, Copy, ExternalLink, Mail, Lock } from 'lucide-react';
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
                acc.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                acc.id.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'All') {
            result = result.filter(acc => acc.status === statusFilter);
        }

        if (sortConfig.key) {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                // Allow empty strings to sort to bottom usually
                if (aVal == null) aVal = '';
                if (bVal == null) bVal = '';

                if (aVal < bVal) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
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

    const copyToClipboard = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        // Could add a toast notification here
    };

    const formatNumber = (num) => {
        if (!num) return '0';
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
                        placeholder="Search handles or IDs..."
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
                <table className="accounts-table" style={{ minWidth: '1000px' }}>
                    <thead>
                        <tr>
                            <th className="sortable" onClick={() => requestSort('id')}>
                                Account {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable" onClick={() => requestSort('status')}>
                                Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('followers')}>
                                Followers {sortConfig.key === 'followers' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('totalViews')}>
                                Total Views {sortConfig.key === 'totalViews' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('engagementRate')} style={{ whiteSpace: 'nowrap' }}>
                                Eng. Rate {sortConfig.key === 'engagementRate' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable numeric" onClick={() => requestSort('ofSubscribers')} style={{ color: 'var(--accent-secondary)' }}>
                                OF Subs {sortConfig.key === 'ofSubscribers' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th>Credentials</th>
                            <th>Links</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length > 0 ? (
                            filteredData.map((account) => (
                                <tr key={account.id} className={account.status === ACCOUNT_STATUSES.WINNER ? 'highlight-row' : ''}>
                                    <td>
                                        <div className="account-identifier">
                                            <div className="account-avatar flex-center">
                                                {account.username ? account.username.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div className="account-names">
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <strong>@{account.username}</strong>
                                                    <button className="icon-btn tooltip" style={{ padding: '0 4px', background: 'none' }} data-tip="Copy Username" onClick={() => copyToClipboard(account.username)}>
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                                <span className="account-id">{account.id}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <StatusBadge status={account.status} />
                                        {account.status === ACCOUNT_STATUSES.WINNER && (
                                            <button
                                                className="btn btn-outline text-xs px-2 py-1 mt-1"
                                                onClick={() => onStatusChange(account.id, ACCOUNT_STATUSES.SCALING)}
                                                style={{ display: 'block', padding: '2px 6px', fontSize: '10px' }}
                                            >
                                                Scale
                                            </button>
                                        )}
                                    </td>
                                    <td className="numeric">
                                        <span className="font-semibold">{formatNumber(account.followers)}</span>
                                    </td>
                                    <td className="numeric font-semibold">
                                        {formatNumber(account.totalViews)}
                                    </td>
                                    <td className="numeric">
                                        {account.engagementRate || 0}%
                                    </td>
                                    <td className="numeric font-semibold" style={{ color: 'var(--accent-secondary)' }}>
                                        {formatNumber(account.ofSubscribers)}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                                            {account.email && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="tooltip" data-tip="Copy Email" onClick={() => copyToClipboard(account.email)}>
                                                    <Mail size={12} className="text-secondary" />
                                                    <span style={{ cursor: 'pointer', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.email}</span>
                                                </div>
                                            )}
                                            {account.password && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="tooltip" data-tip="Copy Password" onClick={() => copyToClipboard(account.password)}>
                                                    <Lock size={12} className="text-secondary" />
                                                    <span style={{ cursor: 'pointer' }}>••••••••</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {account.juicyLink && (
                                                <a href={account.juicyLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-xs px-2 py-1 tooltip" data-tip="Juicy Bio">
                                                    <ExternalLink size={12} style={{ marginRight: '4px' }} /> Bio
                                                </a>
                                            )}
                                            {account.igLink && (
                                                <a href={account.igLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary text-xs px-2 py-1 tooltip" data-tip="Instagram Profile">
                                                    <ExternalLink size={12} style={{ marginRight: '4px' }} /> IG
                                                </a>
                                            )}
                                        </div>
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
