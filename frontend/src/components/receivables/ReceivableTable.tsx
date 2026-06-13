'use client'

import { useRouter } from 'next/navigation'
import { DollarSign, XCircle, Undo2 } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'
import type { Receivable, PaginatedResponse } from '@/types'
import { ReceivableStatus } from '@/types'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(date))

interface ReceivableTableProps {
  data?: PaginatedResponse<Receivable>
  loading?: boolean
  onPageChange: (page: number) => void
  onPay?: (receivable: Receivable) => void
  onUnpay?: (id: string) => void
  onCancel?: (id: string) => void
}

export default function ReceivableTable({
  data,
  loading,
  onPageChange,
  onPay,
  onUnpay,
  onCancel,
}: ReceivableTableProps) {
  const router = useRouter()

  const columns: Column<Receivable>[] = [
    {
      key: 'customer',
      label: 'Cliente',
      render: (item) => (
        <span
          className="text-primary hover:underline cursor-pointer font-medium"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/customers/${item.customerId}`)
          }}
        >
          {item.customer?.razaoSocial || '—'}
        </span>
      ),
    },
    {
      key: 'invoice',
      label: 'NF-e',
      sortable: true,
      sortValue: (item) => item.invoice?.numero ?? 0,
      render: (item) =>
        item.invoice ? (
          <span
            className="text-primary hover:underline cursor-pointer font-mono"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/invoices/${item.invoiceId}`)
            }}
          >
            {item.invoice.numero}/{item.invoice.serie}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'parcela',
      label: 'Parcela',
      render: (item) => (
        <span className="text-sm text-text-muted">
          {item.invoice?.tipoPagamento === 'AVISTA' ? 'À Vista' : `Parcela ${item.parcela}`}
        </span>
      ),
    },
    {
      key: 'dataVencimento',
      label: 'Vencimento',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm">{formatDate(item.dataVencimento)}</span>
      ),
    },
    {
      key: 'valorReceber',
      label: 'Valor',
      sortable: true,
      className: 'text-right font-mono',
      render: (item) => formatBRL(item.valorReceber),
    },
    {
      key: 'paymentMethod',
      label: 'Método',
      render: (item) =>
        item.paymentMethod ? (
          <span className="text-sm text-text-muted">{item.paymentMethod}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'text-center',
      render: (item) => <Badge status={item.status} />,
    },
    {
      key: 'acoes',
      label: 'Ações',
      className: 'text-right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          {item.status !== ReceivableStatus.PAID &&
            item.status !== ReceivableStatus.CANCELLED && onPay && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPay(item)
              }}
              className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors"
              title="Registrar Pagamento"
            >
              <DollarSign className="h-4 w-4" />
            </button>
          )}
          {item.status === ReceivableStatus.PAID && onUnpay && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUnpay(item.id)
              }}
              className="p-1.5 rounded-lg text-warning hover:bg-warning/10 transition-colors"
              title="Desfazer Pagamento"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          )}
          {(item.status === ReceivableStatus.PENDING ||
            item.status === ReceivableStatus.OVERDUE) &&
            onCancel && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel(item.id)
                }}
                className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                title="Cancelar"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
        </div>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      data={(data?.data ?? []) as any}
      loading={loading}
      emptyMessage="Nenhum recebível encontrado"
      pagination={
        data
          ? {
              page: data.page,
              totalPages: data.totalPages,
              total: data.total,
              onPageChange,
            }
          : undefined
      }
    />
  )
}
