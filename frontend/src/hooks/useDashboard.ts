import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { DashboardSummary, MonthlyChartData, OverdueItem } from '@/types'

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/summary')
      return data
    },
    staleTime: 30 * 1000,
    retry: 2,
    retryDelay: 1000,
    refetchOnMount: true,
  })
}

export function useDashboardChart() {
  return useQuery<MonthlyChartData[]>({
    queryKey: ['dashboard', 'chart'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/chart/monthly')
      return data
    },
    staleTime: 30 * 1000,
    retry: 2,
    refetchOnMount: true,
  })
}

export function useOverdueList() {
  return useQuery<OverdueItem[]>({
    queryKey: ['dashboard', 'overdue-list'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/overdue-list')
      return data
    },
    staleTime: 30 * 1000,
    retry: 2,
    refetchOnMount: true,
  })
}
