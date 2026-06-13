'use client'

import { clsx } from 'clsx'

interface BadgeProps {
  status?: string | null
  className?: string
}

const statusMap: Record<string, string> = {
  PENDING: 'badge-pending',
  PAID: 'badge-paid',
  OVERDUE: 'badge-overdue',
  CANCELLED: 'badge-cancelled',
  AUTHORIZED: 'badge-authorized',
  DENIED: 'badge-denied',
}

const labelMap: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Atrasado',
  CANCELLED: 'Cancelado',
  AUTHORIZED: 'Autorizada',
  DENIED: 'Denegada',
  PRODUCAO: 'Produção',
  HOMOLOGACAO: 'Homologação',
}

export default function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        status ? statusMap[status] || 'bg-gray-800 text-gray-300' : 'bg-gray-800 text-gray-300',
        className
      )}
    >
      {status ? labelMap[status] || status : '—'}
    </span>
  )
}
