export function formatCents(centsMinor = 0, currency = 'USD') {
  const dollars = (centsMinor / 100).toFixed(2);
  if (currency === 'USD') return `$${dollars}`;
  return `${currency} ${dollars}`;
}

export function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}
