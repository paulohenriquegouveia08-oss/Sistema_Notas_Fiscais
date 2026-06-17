'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Upload } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import InvoiceTable from '@/components/invoices/InvoiceTable'
import Select from '@/components/ui/Select'
import { useInvoices, useImportXml } from '@/hooks/useInvoices'
import { InvoiceStatus } from '@/types'

export default function InvoicesPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('dataEmissao')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importMutation = useImportXml()

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading } = useInvoices({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    dataInicio: startDate || undefined,
    dataFim: endDate || undefined,
    sortBy,
    sortOrder,
  })

  const statusOptions = [
    { value: '', label: 'Todos' },
    ...Object.values(InvoiceStatus).map((s) => ({ value: s, label: s })),
  ]

  return (
    <PageWrapper title="Notas Fiscais">
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por número, cliente, chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="w-40">
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
            className="input-field w-40"
            placeholder="Data início"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
            className="input-field w-40"
            placeholder="Data fim"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length) importMutation.mutate(files)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {importMutation.isPending ? 'Importando...' : 'Importar XML'}
          </button>
        </div>
        <InvoiceTable
          data={data}
          loading={isLoading}
          onPageChange={setPage}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={toggleSort}
        />
      </div>
    </PageWrapper>
  )
}
