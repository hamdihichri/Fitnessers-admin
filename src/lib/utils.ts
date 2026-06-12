import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) { return clsx(inputs) }

export function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString()
}
export function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}
export function timeAgo(d: string | null | undefined) {
  if (!d) return '—'
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
export function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}
export function fmtTND(cents: number) {
  return (cents / 100).toFixed(3) + ' TND'
}
export function stars(n: number | null) {
  if (!n) return '—'
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}

export function exportToCSV(filename: string, data: any[]) {
  if (!data?.length) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]
      const str = val === null || val === undefined ? '' : String(val)
      return `"${str.replace(/"/g, '""')}"`
    }).join(','))
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
