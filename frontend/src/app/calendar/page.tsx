'use client'

import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  CalendarDays,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { useCalendarReceivables } from '@/hooks/useReceivables'
import type { Receivable } from '@/types'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(date))

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const { data: receivables, isLoading } = useCalendarReceivables()

  const daysWithEvents = useMemo(() => {
    if (!receivables) return new Map<string, Receivable[]>()
    const map = new Map<string, Receivable[]>()
    receivables.forEach((rec) => {
      const key = format(new Date(rec.dataVencimento), 'yyyy-MM-dd')
      const existing = map.get(key) || []
      existing.push(rec)
      map.set(key, existing)
    })
    return map
  }, [receivables])

  const selectedReceivables = useMemo(() => {
    if (!selectedDate) return []
    const key = format(selectedDate, 'yyyy-MM-dd')
    return daysWithEvents.get(key) || []
  }, [selectedDate, daysWithEvents])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
  }

  const monthTotals = useMemo(() => {
    let totalPendente = 0
    let totalAtrasado = 0
    if (!receivables) return { totalPendente: 0, totalAtrasado: 0 }
    receivables.forEach((rec) => {
      const d = new Date(rec.dataVencimento)
      if (isSameMonth(d, currentMonth)) {
        if (rec.status === 'PENDING') totalPendente += rec.valorReceber
        else if (rec.status === 'OVERDUE') totalAtrasado += rec.valorReceber
      }
    })
    return { totalPendente, totalAtrasado }
  }, [receivables, currentMonth])

  return (
    <PageWrapper title="Agenda Financeira">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold text-text-primary capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={goToday}
                className="btn-secondary text-sm"
              >
                Hoje
              </button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-dark-border rounded-lg overflow-hidden">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(
                (dayName) => (
                  <div
                    key={dayName}
                    className="bg-dark-surface px-2 py-2 text-center text-xs font-medium text-text-muted"
                  >
                    {dayName}
                  </div>
                )
              )}
              {days.map((d) => {
                const key = format(d, 'yyyy-MM-dd')
                const dayReceivables = daysWithEvents.get(key)
                const inMonth = isSameMonth(d, currentMonth)
                const today = isToday(d)
                const selected = selectedDate && isSameDay(d, selectedDate)
                const hasPending = dayReceivables?.some(
                  (r) => r.status === 'PENDING'
                )
                const hasOverdue = dayReceivables?.some(
                  (r) => r.status === 'OVERDUE'
                )
                const hasPaid = dayReceivables?.some(
                  (r) => r.status === 'PAID'
                )

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(d)}
                    className={clsx(
                      'px-2 py-3 text-sm transition-colors relative min-h-[72px]',
                      inMonth
                        ? 'bg-dark-surface hover:bg-dark-border/50'
                        : 'bg-dark-bg/50 text-text-muted/50',
                      selected && 'ring-2 ring-primary ring-inset',
                      today && 'bg-primary/5'
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm',
                        today && 'bg-primary text-white font-bold'
                      )}
                    >
                      {format(d, 'd')}
                    </span>
                    {inMonth && dayReceivables && (
                      <div className="flex justify-center gap-0.5 mt-1">
                        {hasOverdue && (
                          <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                        )}
                        {hasPending && (
                          <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                        )}
                        {hasPaid && (
                          <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-border">
              <div className="flex items-center gap-4 text-sm text-text-muted">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  Pendente
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-danger" />
                  Atrasado
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  Pago
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-text-muted">
                  Pendente:{' '}
                  <span className="font-mono text-warning-light">
                    {formatBRL(monthTotals.totalPendente)}
                  </span>
                </span>
                <span className="text-text-muted">
                  Atrasado:{' '}
                  <span className="font-mono text-danger-light">
                    {formatBRL(monthTotals.totalAtrasado)}
                  </span>
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              {selectedDate
                ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecione um dia'}
            </h3>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : selectedReceivables.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-8">
                {selectedDate
                  ? 'Nenhum recebível para esta data'
                  : 'Clique em um dia para ver os recebíveis'}
              </p>
            ) : (
              <div className="space-y-3">
                {selectedReceivables.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-lg bg-dark-border/30 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">
                        {rec.customer?.razaoSocial || '—'}
                      </span>
                      <Badge status={rec.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">
                        Parcela {rec.parcela}
                      </span>
                      <span className="font-mono">{formatBRL(rec.valorReceber)}</span>
                    </div>
                    {rec.invoice && (
                      <p className="text-xs text-text-muted">
                        NF-e {rec.invoice.numero}/{rec.invoice.serie}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageWrapper>
  )
}
