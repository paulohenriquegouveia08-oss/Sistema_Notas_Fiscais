'use client'

import { useRouter } from 'next/navigation'
import Table, { Column } from '@/components/ui/Table'
import type { Customer, PaginatedResponse } from '@/types'
import { Eye } from 'lucide-react'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5'
  )
}

interface CustomerTableProps {
  data?: PaginatedResponse<Customer>
  loading?: boolean
  onPageChange: (page: number) => void
}

export default function CustomerTable({
  data,
  loading,
  onPageChange,
}: CustomerTableProps) {
  const router = useRouter()

  const columns: Column<Customer>[] = [
    {
      key: 'razaoSocial',
      label: 'Razão Social',
      sortable: true,
      render: (item) => (
        <span
          className="font-medium text-primary hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/customers/${item.id}`)
          }}
        >
          {item.razaoSocial}
        </span>
      ),
    },
    {
      key: 'cnpjCpf',
      label: 'CNPJ/CPF',
      render: (item) => (
        <span className="font-mono text-sm">{maskCpfCnpj(item.cnpj || item.cpf || '')}</span>
      ),
    },
    {
      key: 'telefone',
      label: 'Telefone',
      render: (item) => item.telefone || '-',
    },
    {
      key: 'totalComprado',
      label: 'Total Comprado',
      sortable: true,
      className: 'text-right font-mono',
      render: (item) =>
        formatBRL((item as any).totalComprado ?? 0),
    },
    {
      key: 'totalEmAberto',
      label: 'Em Aberto',
      sortable: true,
      className: 'text-right font-mono',
      render: (item) =>
        formatBRL((item as any).totalEmAberto ?? 0),
    },
    {
      key: 'acoes',
      label: 'Ações',
      className: 'text-right',
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/customers/${item.id}`)
          }}
          className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      data={(data?.data ?? []) as any}
      loading={loading}
      emptyMessage="Nenhum cliente encontrado"
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
