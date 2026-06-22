'use client'

import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns'
import Card from '@/components/ui/Card'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  period: 'day' | 'week' | 'month'
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onPeriodChange: (period: 'day' | 'week' | 'month') => void
}

export default function DateRangePicker({
  startDate,
  endDate,
  period,
  onStartDateChange,
  onEndDateChange,
  onPeriodChange,
}: DateRangePickerProps) {
  const presets = [
    {
      label: 'Hoje',
      onClick: () => {
        const today = format(new Date(), 'yyyy-MM-dd')
        onStartDateChange(today)
        onEndDateChange(today)
      },
    },
    {
      label: 'Esta Semana',
      onClick: () => {
        const now = new Date()
        onStartDateChange(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      },
    },
    {
      label: 'Este Mês',
      onClick: () => {
        const now = new Date()
        onStartDateChange(format(startOfMonth(now), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfMonth(now), 'yyyy-MM-dd'))
      },
    },
    {
      label: 'Último Mês',
      onClick: () => {
        const lastMonth = subMonths(new Date(), 1)
        onStartDateChange(format(startOfMonth(lastMonth), 'yyyy-MM-dd'))
        onEndDateChange(format(endOfMonth(lastMonth), 'yyyy-MM-dd'))
      },
    },
  ]

  const periods: { value: 'day' | 'week' | 'month'; label: string }[] = [
    { value: 'day', label: 'Dia' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mês' },
  ]

  return (
    <Card className="p-4">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-muted mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-muted mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={preset.onClick}
                className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-dark-border rounded-lg transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-dark-bg rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => onPeriodChange(p.value)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p.value
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
