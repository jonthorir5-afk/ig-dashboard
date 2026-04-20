import { inputStyle, labelStyle } from './styles'

export default function NumField({ label, value, prev, onChange }) {
  const displayPrev = prev != null && prev !== '' ? `prev: ${prev}` : null

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        placeholder={displayPrev || '0'}
        style={inputStyle}
      />
      {displayPrev && (
        <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
          {displayPrev}
        </p>
      )}
    </div>
  )
}
