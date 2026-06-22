'use client'

import Card from '@/components/ui/Card'
import Table, { Column } from '@/components/ui/Table'
import { formatBRL } from '@/utils/format'
import type { CustomerBreakdown } from '@/types'

interface ReportTableProps {
  data: CustomerBreakdown[] | undefined
  isLoading: boolean
}

export default function ReportTable({ data, isLoading }: ReportTableProps) {
  const columns: Column<CustomerBreakdown>[] = [
    {
      key: 'razaoSocial',
      label: 'Cliente',
      sortable: true,
      sortValue: (item) => item.razaoSocial,
    },
    {
      key: 'qtdNf',
      label: 'Qtd NFs',
      sortable: true,
      sortValue: (item) => item.qtdNf,
      className: 'text-center',
    },
    {
      key: 'totalFaturado',
      label: 'Faturado',
      sortable: true,
      sortValue: (item) => item.totalFaturado,
      render: (item) => (
        <span className="font-mono">{formatBRL(item.totalFaturado)}</span>
      ),
    },
    {
      key: 'totalRecebido',
      label: 'Recebido',
      sortable: true,
      sortValue: (item) => item.totalRecebido,
      render: (item) => (
        <span className="font-mono text-green-400">{formatBRL(item.totalRecebido)}</span>
      ),
    },
    {
      key: 'pendente',
      label: 'Pendente',
      sortable: true,
      sortValue: (item) => item.pendente,
      render: (item) => (
        <span className={`font-mono ${item.pendente > 0 ? 'text-yellow-400' : 'text-text-muted'}`}>
          {formatBRL(item.pendente)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => {
        if (item.pendente <= 0) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
              Quitado
            </span>
          )
        }
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400">
            Pendente
          </span>
        )
      },
    },
  ]

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Detalhamento por Cliente
      </h3>
      <Table
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        emptyMessage="Nenhum dado encontrado para o período selecionado"
      />
    </Card>
  )
}
