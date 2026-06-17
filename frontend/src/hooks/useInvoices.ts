import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Invoice, PaginatedResponse, ImportResponse } from '@/types'
import toast from 'react-hot-toast'

interface InvoiceParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  customerId?: string
  dataInicio?: string
  dataFim?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function useInvoices(params: InvoiceParams = {}) {
  return useQuery<PaginatedResponse<Invoice>>({
    queryKey: ['invoices', params],
    queryFn: async () => {
      const { data } = await api.get('/invoices', { params })
      return data
    },
  })
}

export function useInvoice(id: string) {
  return useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data } = await api.get(`/invoices/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useImportXml() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      const { data } = await api.post<ImportResponse>('/xml/import', formData, {
        timeout: 60000,
        headers: { 'Content-Type': undefined },
      })
      return data
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })

      if (result.imported > 0) {
        const parts = [`${result.imported} nota(s) importada(s)`]
        if (result.duplicated > 0) parts.push(`${result.duplicated} já existente(s)`)
        if (result.errors > 0) parts.push(`${result.errors} com erro`)
        toast.success(parts.join(', '), { duration: 5000 })
      } else if (result.errors > 0) {
        const parts = [`${result.errors} arquivo(s) com erro`]
        if (result.duplicated > 0) parts.push(`${result.duplicated} já existente(s)`)
        toast.error(parts.join(', '), { duration: 5000 })
      } else {
        toast(`${result.duplicated} nota(s) já existente(s) — nenhuma nova importada`, { icon: 'ℹ️' })
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erro ao importar XML'
      toast.error(msg)
    },
  })
}
