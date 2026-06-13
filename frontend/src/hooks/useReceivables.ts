import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Receivable, PaginatedResponse, Payment } from '@/types'
import toast from 'react-hot-toast'

interface ReceivableParams {
  page?: number
  limit?: number
  status?: string
  customerId?: string
  startDate?: string
  endDate?: string
}

export function useReceivables(params: ReceivableParams = {}) {
  return useQuery<PaginatedResponse<Receivable>>({
    queryKey: ['receivables', params],
    queryFn: async () => {
      const { data } = await api.get('/receivables', { params })
      return data
    },
  })
}

export function usePayReceivable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string
      valorPago: number
      paymentMethod: string
      dataPagamento: string
      juros?: number
      multa?: number
      observacao?: string
    }) => {
      const { data } = await api.patch<Receivable>(
        `/receivables/${id}/pay`,
        payload
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Pagamento registrado com sucesso')
    },
  })
}

export function useUnpayReceivable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<Receivable>(`/receivables/${id}/unpay`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Pagamento desfeito')
    },
  })
}

export function useCancelReceivable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<Receivable>(`/receivables/${id}/cancel`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Recebível cancelado')
    },
  })
}

export function useOverdueReceivables() {
  return useQuery<Receivable[]>({
    queryKey: ['receivables', 'overdue'],
    queryFn: async () => {
      const { data } = await api.get('/receivables/overdue')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpcomingReceivables(days: number = 30) {
  return useQuery<Receivable[]>({
    queryKey: ['receivables', 'upcoming', days],
    queryFn: async () => {
      const { data } = await api.get('/receivables/upcoming', {
        params: { days },
      })
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCalendarReceivables() {
  return useQuery<Receivable[]>({
    queryKey: ['receivables', 'calendar'],
    queryFn: async () => {
      const { data } = await api.get('/receivables/calendar')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function usePayments(params: ReceivableParams = {}) {
  return useQuery<PaginatedResponse<Payment>>({
    queryKey: ['payments', params],
    queryFn: async () => {
      const { data } = await api.get('/payments', { params })
      return data
    },
  })
}
