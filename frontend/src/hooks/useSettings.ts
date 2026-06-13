import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Settings } from '@/types'
import toast from 'react-hot-toast'

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings')
      return data
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<Settings>) => {
      const { data } = await api.put('/settings', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Configurações salvas com sucesso')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erro ao salvar configurações'
      toast.error(msg)
    },
  })
}
