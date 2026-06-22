'use client'

import { useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import PageWrapper from '@/components/layout/PageWrapper'
import DateRangePicker from '@/components/reports/DateRangePicker'
import ReportSummary from '@/components/reports/ReportSummary'
import ReportChart from '@/components/reports/ReportChart'
import ReportTable from '@/components/reports/ReportTable'
import ExportButton from '@/components/reports/ExportButton'
import { useReportSummary, useReportByPeriod, useReportByCustomer } from '@/hooks/useReports'

export default function ReportsPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const firstDayOfMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')

  const params = { startDate, endDate, period }

  const { data: summary, isLoading: isLoadingSummary } = useReportSummary(params)
  const { data: periodData, isLoading: isLoadingPeriod } = useReportByPeriod(params)
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

        <ReportChart data={periodData} isLoading={isLoadingPeriod} />

        <ReportTable data={customerData} isLoading={isLoadingCustomer} />
      </div>
    </PageWrapper>
  )
}
