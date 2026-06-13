import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import toast from 'react-hot-toast'

export function useClearData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete('/admin/data')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Todos os dados foram removidos')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erro ao limpar dados'
      toast.error(msg)
    },
  })
}
