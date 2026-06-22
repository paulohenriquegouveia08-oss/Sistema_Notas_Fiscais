'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import Card from '@/components/ui/Card'
import { formatBRL } from '@/utils/format'
import type { PeriodData, PeriodStatusData } from '@/types'

interface ReportChartProps {
  data: PeriodData[] | undefined
  isLoading: boolean
  periodStatusData?: PeriodStatusData[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null
  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-text-primary mb-2">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatBRL(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function ReportChart({ data, isLoading, periodStatusData }: ReportChartProps) {
  const chartData = useMemo(() => {
    if (!data) return []
    if (!periodStatusData || periodStatusData.length === 0) return data

    const statusMap = new Map<string, PeriodStatusData>()
    periodStatusData.forEach((item) => statusMap.set(item.periodo, item))

    return data.map((item) => ({
      ...item,
      atrasado: statusMap.get(item.periodo)?.atrasado ?? 0,
      aberto: statusMap.get(item.periodo)?.aberto ?? 0,
      pago: statusMap.get(item.periodo)?.pago ?? 0,
    }))
  }, [data, periodStatusData])

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Faturamento por Período
        </h3>
        <div className="h-80 animate-pulse bg-dark-border rounded-lg" />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Faturamento por Período
        </h3>
        <div className="h-80 flex items-center justify-center text-text-muted">
          Nenhum dado disponível para o período selecionado
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Faturamento por Período
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#2A2D3A"
              vertical={false}
            />
            <XAxis
              dataKey="periodo"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              axisLine={{ stroke: '#2A2D3A' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              axisLine={{ stroke: '#2A2D3A' }}
              tickLine={false}
              tickFormatter={(v: number) =>
                new Intl.NumberFormat('pt-BR', {
                  notation: 'compact',
                  currency: 'BRL',
                  style: 'currency',
                }).format(v)
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#94A3B8' }}
            />
            <Bar
              dataKey="faturamento"
              name="Faturamento"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="recebido"
              name="Recebido"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
            {periodStatusData && periodStatusData.length > 0 && (
              <>
                <Bar
                  dataKey="pago"
                  name="Pago"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  opacity={0.6}
                />
                <Bar
                  dataKey="aberto"
                  name="Em Aberto"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="atrasado"
                  name="Em Atraso"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
