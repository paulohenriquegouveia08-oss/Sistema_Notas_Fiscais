'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Copy,
  Eye,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import Badge from '@/components/ui/Badge'
import type { Invoice, PaginatedResponse, Receivable } from '@/types'
import { ReceivableStatus } from '@/types'
import { formatBRL } from '@/utils/format'

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(y, m - 1, d))
}

interface InvoiceTableProps {
  data?: PaginatedResponse<Invoice>
  loading?: boolean
  onPageChange: (page: number) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
  onViewInvoice?: (invoice: Invoice) => void
}

function SortIcon({ field, sortBy, sortOrder }: { field: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
  if (sortBy !== field) return <ChevronsUpDown className="h-3 w-3 text-text-muted/50 inline ml-1" />
  return sortOrder === 'asc'
    ? <ChevronUp className="h-3 w-3 inline ml-1" />
    : <ChevronDown className="h-3 w-3 inline ml-1" />
}

function SortableHeader({ children, field, sortBy, sortOrder, onSort, className }: {
  children: React.ReactNode
  field: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
  className?: string
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer select-none hover:text-text-primary transition-colors ${className || ''}`}
      onClick={() => onSort?.(field)}
    >
      {children}
      <SortIcon field={field} sortBy={sortBy} sortOrder={sortOrder} />
    </th>
  )
}

function ReceivableMiniRow({ item }: { item: Receivable }) {
  const statusMap: Record<string, string> = {
    PENDING: 'text-warning-light',
    PAID: 'text-success-light',
    OVERDUE: 'text-danger-light',
    CANCELLED: 'text-text-muted',
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-text-muted">
        Parcela {item.parcela}
      </span>
      <span className="font-mono">{formatBRL(item.valorReceber)}</span>
      <span className={clsx('font-mono', statusMap[item.status])}>
        <Badge status={item.status} />
      </span>
      <span className="text-text-muted">{formatDate(item.dataVencimento)}</span>
    </div>
  )
}

export default function InvoiceTable({
  data,
  loading,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
  onViewInvoice,
}: InvoiceTableProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const copyChave = (chave: string) => {
    navigator.clipboard.writeText(chave).then(() => {
      toast.success('Chave de acesso copiada')
    })
  }

  if (!data && loading) {
    return (
      <div className="card overflow-hidden">
        <div className="animate-pulse space-y-4 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-6 bg-dark-border rounded w-24" />
              <div className="h-6 bg-dark-border rounded flex-1" />
              <div className="h-6 bg-dark-border rounded w-32" />
              <div className="h-6 bg-dark-border rounded w-24" />
              <div className="h-6 bg-dark-border rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-12 text-text-muted">
        <p>Nenhuma nota fiscal encontrada</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border">
              <th className="w-8 px-2 py-3" />
              <SortableHeader field="numero" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort}>
                Nº / Série
              </SortableHeader>
              <SortableHeader field="razaoSocial" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort}>
                Cliente
              </SortableHeader>
              <SortableHeader field="dataEmissao" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort}>
                Emissão
              </SortableHeader>
              <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">
                Parcelas
              </th>
              <SortableHeader field="valorTotal" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="text-right">
                Valor
              </SortableHeader>
              <SortableHeader field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="text-center">
                Status
              </SortableHeader>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {data.data.map((invoice) => (
              <>
                <tr
                  key={invoice.id}
                  className="hover:bg-dark-border/30 transition-colors cursor-pointer"
                  onClick={() => {
                    if (onViewInvoice) {
                      onViewInvoice(invoice)
                    } else {
                      setExpandedId(
                        expandedId === invoice.id ? null : invoice.id
                      )
                    }
                  }}
                >
                  <td className="px-2 py-3">
                    {onViewInvoice ? (
                      <Eye className="h-4 w-4 text-text-muted" />
                    ) : expandedId === invoice.id ? (
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-text-muted" />
                    )} 
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {invoice.numero}/{invoice.serie}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary">
                    {invoice.customer?.razaoSocial || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatDate(invoice.dataEmissao)}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-text-muted">
                    {invoice.receivables?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-right">
                    {formatBRL(invoice.valorTotal)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!onViewInvoice && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/invoices/${invoice.id}`)
                        }}
                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
                {!onViewInvoice && expandedId === invoice.id && (
                  <tr key={`${invoice.id}-details`}>
                    <td colSpan={7} className="bg-dark-bg/50 px-6 py-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-text-muted">Chave de Acesso:</span>
                          <code className="font-mono text-xs text-text-primary bg-dark-border px-2 py-1 rounded select-all">
                            {invoice.chaveAcesso}
                          </code>
                          <button
                            onClick={() => copyChave(invoice.chaveAcesso)}
                            className="p-1 rounded text-text-muted hover:text-primary transition-colors"
                          >
                            {invoice.chaveAcesso ? <Copy className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        {invoice.receivables && invoice.receivables.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-text-muted uppercase mb-2">
                              Parcelas
                            </p>
                            {invoice.receivables.map((rec) => (
                              <ReceivableMiniRow
                                key={rec.id}
                                item={rec}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border">
          <span className="text-sm text-text-muted">
            Total: {data.total} notas
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-xs px-3 py-1.5"
              disabled={data.page <= 1}
              onClick={() => onPageChange(data.page - 1)}
            >
              Anterior
            </button>
            <span className="text-sm text-text-muted">
              {data.page} de {data.totalPages}
            </span>
            <button
              className="btn-secondary text-xs px-3 py-1.5"
              disabled={data.page >= data.totalPages}
              onClick={() => onPageChange(data.page + 1)}
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
