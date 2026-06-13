'use client'

import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { useOverdueList } from '@/hooks/useDashboard'
import Spinner from '@/components/ui/Spinner'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

export default function OverdueList() {
  const router = useRouter()
  const { data, isLoading } = useOverdueList()

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Top Inadimplentes
      </h3>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-text-muted text-sm py-8 text-center">
          Nenhum cliente inadimplente
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div
              key={item.customerId}
              onClick={() => router.push(`/customers/${item.customerId}`)}
              className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-dark-border/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {item.razaoSocial}
                </p>
                <p className="text-xs text-text-muted">
                  {item.totalParcelasAtrasadas} parcela(s) atrasada(s)
                </p>
              </div>
              <span className="text-sm font-mono font-medium text-danger">
                {formatBRL(item.totalValorAtrasado)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
