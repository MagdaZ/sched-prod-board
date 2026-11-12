// R5: the viewer's own time zone and their locale's date order (en-GB, de-DE, fr-FR … give dd/mm).
const locale = navigator.languages?.[0] || navigator.language || 'en-GB';

const fmt = new Intl.DateTimeFormat(locale, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});
const fmtSeconds = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function formatLocal(iso, { seconds = false } = {}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (seconds ? fmtSeconds : fmt).format(d);
}
