'use client'

import { ReactNode } from 'react'
import Card from '@/components/ui/Card'

interface KpiCardProps {
  title: string
  value: string
  color: string
  icon: ReactNode
  subtitle?: string
}

export default function KpiCard({ title, value, color, icon, subtitle }: KpiCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-text-muted">{title}</p>
          <p className="text-2xl font-bold font-mono" style={{ color }}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
        <div
          className="p-3 rounded-lg flex-shrink-0"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
