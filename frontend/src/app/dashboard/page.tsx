'use client'

import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import OverdueList from '@/components/dashboard/OverdueList'
import { useDashboardSummary } from '@/hooks/useDashboard'
import Spinner from '@/components/ui/Spinner'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

export default function DashboardPage() {
  const { data: summary, isLoading, error } = useDashboardSummary()

  if (isLoading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="flex items-center justify-center h-96">
          <Spinner size="lg" />
        </div>
      </PageWrapper>
    )
  }

  const kpis = [
    {
      title: 'Total a Receber',
      value: formatBRL(summary?.totalAReceber ?? 0),
      color: '#3B82F6',
      icon: <DollarSign className="h-5 w-5" />,
      subtitle: 'Valor total em aberto',
    },
    {
      title: 'Recebido no Mês',
      value: formatBRL(summary?.totalRecebido ?? 0),
      color: '#22C55E',
      icon: <ArrowUpRight className="h-5 w-5" />,
      subtitle: 'Recebimentos deste mês',
    },
    {
      title: 'Em Atraso',
      value: formatBRL(summary?.totalAtrasado ?? 0),
      color: '#EF4444',
      icon: <ArrowDownRight className="h-5 w-5" />,
      subtitle: 'Valor total em atraso',
    },
    {
      title: 'Pendente',
      value: formatBRL(summary?.totalPendente ?? 0),
      color: '#F59E0B',
      icon: <Clock className="h-5 w-5" />,
      subtitle: 'A vencer',
    },
    {
      title: 'Próximos 30 Dias',
      value: formatBRL(summary?.recebimentoProximos30Dias ?? 0),
      color: '#3B82F6',
      icon: <TrendingUp className="h-5 w-5" />,
      subtitle: 'Previsão de recebimento',
    },
    {
      title: 'Clientes',
      value: String(summary?.totalClientes ?? 0),
      color: '#22C55E',
      icon: <Users className="h-5 w-5" />,
      subtitle: 'Clientes cadastrados',
    },
    {
      title: 'Notas Fiscais',
      value: String(summary?.totalNfes ?? 0),
      color: '#3B82F6',
      icon: <FileText className="h-5 w-5" />,
      subtitle: 'NF-e importadas',
    },
    {
      title: 'Inadimplência',
      value: `${(summary?.percentualInadimplencia ?? 0).toFixed(1)}%`,
      color:
        (summary?.percentualInadimplencia ?? 0) > 20
          ? '#EF4444'
          : (summary?.percentualInadimplencia ?? 0) > 10
          ? '#F59E0B'
          : '#22C55E',
      icon: <AlertTriangle className="h-5 w-5" />,
      subtitle: `${formatBRL(summary?.totalAtrasado ?? 0)} em atraso`,
    },
  ]

  return (
    <PageWrapper title="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <div>
            <OverdueList />
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
