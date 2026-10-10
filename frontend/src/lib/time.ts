const formatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Lisbon',
})

export const clock = (ts: number | null) => (ts == null ? '--:--' : formatter.format(new Date(ts * 1000)))
