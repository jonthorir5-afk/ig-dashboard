export const StatusBadge = ({ status }) => {
    let badgeStyle = '';

    switch (status) {
        case 'Created':
            badgeStyle = 'badge-created';
            break;
        case 'Active':
            badgeStyle = 'badge-active';
            break;
        case 'Winner':
            badgeStyle = 'badge-winner';
            break;
        case 'Scaling on Pixel':
            badgeStyle = 'badge-scaling';
            break;
        default:
            badgeStyle = 'badge-default';
    }

    return (
        <span className={`status-badge ${badgeStyle}`}>
            {status}
        </span>
    );
};

export default StatusBadge;
