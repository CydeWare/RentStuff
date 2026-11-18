const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "3 Jun 2026" or "3 Jun – 5 Jun 2026" for inclusive date ranges. */
export function formatRangeId(start: Date, end: Date): string {
  if (start.getTime() === end.getTime()) return dateFmt.format(start);
  return `${dateFmt.format(start)} – ${dateFmt.format(end)}`;
}

export function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}
