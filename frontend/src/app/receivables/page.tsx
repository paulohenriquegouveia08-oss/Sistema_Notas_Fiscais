'use client'

import { useState } from 'react'
import { DollarSign, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import ReceivableTable from '@/components/receivables/ReceivableTable'
import PaymentModal from '@/components/receivables/PaymentModal'
import { useReceivables, useCancelReceivable, useUnpayReceivable } from '@/hooks/useReceivables'
import { useDashboardSummary } from '@/hooks/useDashboard'
import type { Receivable, ReceivableStatus } from '@/types'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const tabs = [
  { key: '', label: 'Todas' },
  { key: 'PENDING', label: 'Pendente' },
  { key: 'OVERDUE', label: 'Atrasado' },
  { key: 'PAID', label: 'Pago' },
  { key: 'CANCELLED', label: 'Cancelado' },
]

export default function ReceivablesPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null)

  const { data, isLoading } = useReceivables({
    page,
    limit: 200,
    status: status || undefined,
  })

  const { data: summary } = useDashboardSummary()
  const cancelMutation = useCancelReceivable()
  const unpayMutation = useUnpayReceivable()

  const pills = [
    {
      label: 'Pendente',
      value: summary?.totalPendente ?? 0,
      color: '#F59E0B',
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: 'Atrasado',
      value: summary?.totalAtrasado ?? 0,
      color: '#EF4444',
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    {
      label: 'Pago',
      value: summary?.totalRecebido ?? 0,
      color: '#22C55E',
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: 'Total a Receber',
      value: summary?.totalAReceber ?? 0,
      color: '#3B82F6',
      icon: <DollarSign className="h-4 w-4" />,
    },
  ]

  return (
    <PageWrapper title="Contas a Receber">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {pills.map((pill) => (
            <Card key={pill.label} className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${pill.color}15`, color: pill.color }}
                >
                  {pill.icon}
                </div>
                <div>
                  <p className="text-xs text-text-muted">{pill.label}</p>
                  <p className="text-lg font-bold font-mono" style={{ color: pill.color }}>
                    {formatBRL(pill.value)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-1 border-b border-dark-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatus(tab.key)
                setPage(1)
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                status === tab.key
                  ? 'text-primary border-primary'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ReceivableTable
          data={data}
          loading={isLoading}
          onPageChange={setPage}
          onPay={(rec) => setSelectedReceivable(rec)}
          onUnpay={(id) => unpayMutation.mutate(id)}
          onCancel={(id) => cancelMutation.mutate(id)}
        />
      </div>

      <PaymentModal
        receivable={selectedReceivable}
        open={!!selectedReceivable}
        onClose={() => setSelectedReceivable(null)}
      />
    </PageWrapper>
  )
}
