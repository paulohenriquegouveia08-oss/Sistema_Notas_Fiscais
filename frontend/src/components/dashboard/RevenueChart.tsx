'use client'

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
import type { MonthlyChartData } from '@/types'
import { useDashboardChart } from '@/hooks/useDashboard'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

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

export default function RevenueChart() {
  const { data, isLoading } = useDashboardChart()

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Receitas Mensais
      </h3>
      {isLoading ? (
        <div className="h-80 animate-pulse bg-dark-border rounded-lg" />
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#2A2D3A"
                vertical={false}
              />
              <XAxis
                dataKey="mes"
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
                dataKey="recebido"
                name="Recebido"
                fill="#22C55E"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="pendente"
                name="Em Aberto"
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="atrasado"
                name="Atrasado"
                fill="#EF4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
