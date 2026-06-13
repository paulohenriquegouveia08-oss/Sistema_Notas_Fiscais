import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Customer, PaginatedResponse } from '@/types'
import toast from 'react-hot-toast'

interface CustomerParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function useCustomers(params: CustomerParams = {}) {
  return useQuery<PaginatedResponse<Customer>>({
    queryKey: ['customers', params],
    queryFn: async () => {
      const { data } = await api.get('/customers', { params })
      return data
    },
  })
}

export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Customer> & { id: string }) => {
      const { data } = await api.patch(`/customers/${id}`, payload)
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] })
      toast.success('Cliente atualizado com sucesso')
    },
  })
}
