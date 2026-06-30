import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { XmlDocument, PaginatedResponse } from '@/types'

interface XmlDocumentParams {
  page?: number
  limit?: number
  search?: string
  status?: string
}

export function useXmlDocuments(params: XmlDocumentParams = {}) {
  return useQuery<PaginatedResponse<XmlDocument>>({
    queryKey: ['xml-documents', params],
    queryFn: async () => {
      const { data } = await api.get('/xml-documents', { params })
      return data
    },
  })
}

export function useXmlDocument(id: string) {
  return useQuery<XmlDocument>({
    queryKey: ['xml-document', id],
    queryFn: async () => {
      const { data } = await api.get(`/xml-documents/${id}`)
      return data
    },
    enabled: !!id,
  })
}
