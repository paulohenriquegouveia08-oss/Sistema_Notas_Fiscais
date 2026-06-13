'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import CustomerTable from '@/components/customers/CustomerTable'
import { useCustomers } from '@/hooks/useCustomers'

export default function CustomersPage() {
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

  const { data, isLoading } = useCustomers({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  })

  return (
    <PageWrapper title="Clientes">
      <div className="space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por razão social, CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <CustomerTable
          data={data}
          loading={isLoading}
          onPageChange={setPage}
        />
      </div>
    </PageWrapper>
  )
}
