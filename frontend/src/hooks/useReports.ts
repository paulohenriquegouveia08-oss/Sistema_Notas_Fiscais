import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { ReportSummary, PeriodData, CustomerBreakdown, ReportParams, PeriodStatusData } from '@/types'

export function useReportSummary(params: ReportParams) {
  return useQuery<ReportSummary>({
    queryKey: ['reports', 'summary', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/summary', { params })
      return data
    },
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 30000,
    retry: 2,
  })
}

export function useReportByPeriod(params: ReportParams) {
  return useQuery<PeriodData[]>({
    queryKey: ['reports', 'by-period', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/by-period', { params })
      return data
    },
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 30000,
    retry: 2,
  })
}

export function useReportByPeriodStatus(params: ReportParams) {
  return useQuery<PeriodStatusData[]>({
    queryKey: ['reports', 'by-period-status', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/by-period-status', { params })
      return data
    },
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 30000,
    retry: 2,
  })
}

export function useReportByCustomer(params: ReportParams) {
  return useQuery<CustomerBreakdown[]>({
    queryKey: ['reports', 'by-customer', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/by-customer', { params })
      return data
    },
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 30000,
    retry: 2,
  })
}
