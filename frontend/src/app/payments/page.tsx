'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Table, { Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { usePayments } from '@/hooks/useReceivables'
import type { Payment } from '@/types'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(date))

export default function PaymentsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading } = usePayments({
    page,
    limit: 20,
  })

  const columns: Column<Payment>[] = [
    {
      key: 'cliente',
      label: 'Cliente',
      render: (item) =>
        item.receivable?.customer?.razaoSocial || '—',
    },
    {
      key: 'nf',
      label: 'NF-e',
      render: (item) =>
        item.receivable?.invoice
          ? `${item.receivable.invoice.numero}/${item.receivable.invoice.serie}`
          : '—',
    },
    {
      key: 'dataPagamento',
      label: 'Data',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm">{formatDate(item.dataPagamento)}</span>
      ),
    },
    {
      key: 'valorPago',
      label: 'Valor Pago',
      sortable: true,
      className: 'text-right font-mono',
      render: (item) => formatBRL(item.valorPago),
    },
    {
      key: 'juros',
      label: 'Juros',
      className: 'text-right font-mono',
      render: (item) => (item.juros ? formatBRL(item.juros) : '—'),
    },
    {
      key: 'multa',
      label: 'Multa',
      className: 'text-right font-mono',
      render: (item) => (item.multa ? formatBRL(item.multa) : '—'),
    },
    {
      key: 'paymentMethod',
      label: 'Método',
      render: (item) => (
        <span className="text-sm text-text-muted">{item.paymentMethod}</span>
      ),
    },
    {
      key: 'observacao',
      label: 'Obs',
      render: (item) =>
        item.observacao ? (
          <span className="text-xs text-text-muted truncate max-w-[120px] block">
            {item.observacao}
          </span>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <PageWrapper title="Pagamentos">
      <div className="space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar pagamentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <Table
          columns={columns}
          data={(data?.data ?? []) as any}
          loading={isLoading}
          emptyMessage="Nenhum pagamento encontrado"
          pagination={
            data
              ? {
                  page: data.page,
                  totalPages: data.totalPages,
                  total: data.total,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      </div>
    </PageWrapper>
  )
}
