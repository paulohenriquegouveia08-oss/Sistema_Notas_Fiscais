'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import Badge from '@/components/ui/Badge'
import type { Invoice, PaginatedResponse, Receivable } from '@/types'
import { ReceivableStatus } from '@/types'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(date))

interface InvoiceTableProps {
  data?: PaginatedResponse<Invoice>
  loading?: boolean
  onPageChange: (page: number) => void
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
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Nº / Série
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Emissão
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">
                Parcelas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                Valor
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">
                Status
              </th>
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
                  onClick={() =>
                    setExpandedId(
                      expandedId === invoice.id ? null : invoice.id
                    )
                  }
                >
                  <td className="px-2 py-3">
                    {expandedId === invoice.id ? (
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/invoices/${invoice.id}`)
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
                {expandedId === invoice.id && (
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
