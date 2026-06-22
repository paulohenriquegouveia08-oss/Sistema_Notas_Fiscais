'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth } from 'date-fns'
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import DateRangePicker from '@/components/reports/DateRangePicker'
import ReportSummary from '@/components/reports/ReportSummary'
import ReportChart from '@/components/reports/ReportChart'
import ReportTable from '@/components/reports/ReportTable'
import ExportButton from '@/components/reports/ExportButton'
import Card from '@/components/ui/Card'
import { formatBRL } from '@/utils/format'
import { useReportSummary, useReportByPeriod, useReportByCustomer, useReportByPeriodStatus } from '@/hooks/useReports'

function StatusCards({ data, isLoading }: { data: ReturnType<typeof useReportByPeriodStatus>['data']; isLoading: boolean }) {
  const totals = useMemo(() => {
    if (!data || data.length === 0) return { atrasado: 0, aberto: 0, pago: 0 }
    return data.reduce(
      (acc, item) => ({
        atrasado: acc.atrasado + item.atrasado,
        aberto: acc.aberto + item.aberto,
        pago: acc.pago + item.pago,
      }),
      { atrasado: 0, aberto: 0, pago: 0 },
    )
  }, [data])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-dark-border rounded w-20" />
              <div className="h-7 bg-dark-border rounded w-24" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Em Atraso',
      value: totals.atrasado,
      color: '#EF4444',
      icon: <AlertTriangle className="h-5 w-5" />,
    },
    {
      title: 'Em Aberto',
      value: totals.aberto,
      color: '#F59E0B',
      icon: <Clock className="h-5 w-5" />,
    },
    {
      title: 'Pago',
      value: totals.pago,
      color: '#22C55E',
      icon: <CheckCircle className="h-5 w-5" />,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-text-muted">{card.title}</p>
              <p className="text-2xl font-bold font-mono" style={{ color: card.color }}>
                {formatBRL(card.value)}
              </p>
            </div>
            <div
              className="p-3 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${card.color}15`, color: card.color }}
            >
              {card.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const firstDayOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')

  const params = { startDate, endDate, period }

  const { data: summary, isLoading: isLoadingSummary } = useReportSummary(params)
  const { data: periodData, isLoading: isLoadingPeriod } = useReportByPeriod(params)
  const { data: periodStatusData, isLoading: isLoadingPeriodStatus } = useReportByPeriodStatus(params)
  const { data: customerData, isLoading: isLoadingCustomer } = useReportByCustomer(params)

  return (
    <PageWrapper title="Relatórios">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            period={period}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onPeriodChange={setPeriod}
          />
          <ExportButton params={params} />
        </div>

        <ReportSummary data={summary} isLoading={isLoadingSummary} />

        <StatusCards data={periodStatusData} isLoading={isLoadingPeriodStatus} />

        <ReportChart data={periodData} isLoading={isLoadingPeriod} periodStatusData={periodStatusData} />

        <ReportTable data={customerData} isLoading={isLoadingCustomer} />
      </div>
    </PageWrapper>
  )
}
