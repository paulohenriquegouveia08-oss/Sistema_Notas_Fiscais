'use client'

import { DollarSign, TrendingUp, Clock, AlertTriangle, Users, FileText } from 'lucide-react'
import Card from '@/components/ui/Card'
import { formatBRL } from '@/utils/format'
import type { ReportSummary } from '@/types'

interface ReportSummaryProps {
  data: ReportSummary | undefined
  isLoading: boolean
}

export default function ReportSummary({ data, isLoading }: ReportSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
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

  const kpis = [
    {
      title: 'Faturamento',
      value: formatBRL(data?.totalFaturamento ?? 0),
      color: '#3B82F6',
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: 'Recebido',
      value: formatBRL(data?.totalRecebido ?? 0),
      color: '#22C55E',
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: 'A Receber',
      value: formatBRL(data?.totalAReceber ?? 0),
      color: '#3B82F6',
      icon: <Clock className="h-5 w-5" />,
    },
    {
      title: 'Atrasado',
      value: formatBRL(data?.totalAtrasado ?? 0),
      color: '#EF4444',
      icon: <AlertTriangle className="h-5 w-5" />,
    },
    {
      title: 'Ticket Médio',
      value: formatBRL(data?.ticketMedio ?? 0),
      color: '#F59E0B',
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: 'Qtd NFs',
      value: String(data?.qtdNf ?? 0),
      color: '#3B82F6',
      icon: <FileText className="h-5 w-5" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-text-muted">{kpi.title}</p>
              <p className="text-2xl font-bold font-mono" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
            </div>
            <div
              className="p-3 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}
            >
              {kpi.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
