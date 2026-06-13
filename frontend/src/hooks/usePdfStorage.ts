'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { PdfDocument } from '@/types'
import toast from 'react-hot-toast'

export function usePdfDocuments() {
  return useQuery<PdfDocument[]>({
    queryKey: ['pdf-storage'],
    queryFn: async () => {
      const { data } = await api.get('/pdf-storage')
      return data
    },
  })
}

export function useUploadPdf() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      const { data } = await api.post('/pdf-storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pdf-storage'] })
      toast.success(`${data.total} PDF(s) enviado(s) com sucesso`)
    },
    onError: () => {
      toast.error('Erro ao enviar PDFs')
    },
  })
}

export function useDeletePdf() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pdf-storage/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-storage'] })
      toast.success('PDF removido')
    },
    onError: () => {
      toast.error('Erro ao remover PDF')
    },
  })
}
