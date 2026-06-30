'use client'

import { useState, useEffect } from 'react'
import { Search, Download, Copy, ExternalLink, FileCode } from 'lucide-react'
import toast from 'react-hot-toast'
import PageWrapper from '@/components/layout/PageWrapper'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import { useXmlDocuments } from '@/hooks/useXmlDocuments'
import { XmlDocumentStatus } from '@/types'
import { clsx } from 'clsx'

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(y, m - 1, d))
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export default function XmlPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading } = useXmlDocuments({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
  })

  const statusOptions = [
    { value: '', label: 'Todos' },
    { value: XmlDocumentStatus.VINCULADO, label: 'Vinculado' },
    { value: XmlDocumentStatus.SEM_NOTA, label: 'Sem Nota' },
  ]

  const copyChave = (chave: string) => {
    navigator.clipboard.writeText(chave).then(() => {
      toast.success('Chave de acesso copiada')
    })
  }

  const downloadXml = (id: string, fileName: string) => {
    const link = document.createElement('a')
    link.href = `${API_URL}/xml-documents/${id}/download`
    link.download = fileName
    link.click()
  }

  return (
    <PageWrapper title="XML">
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por cliente, número, chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="w-40">
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="card overflow-hidden">
            <div className="animate-pulse space-y-4 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-6 bg-dark-border rounded w-32" />
                  <div className="h-6 bg-dark-border rounded flex-1" />
                  <div className="h-6 bg-dark-border rounded w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-12 text-text-muted">
            <FileCode className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum XML encontrado</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Nota
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Emissão
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Chave de Acesso
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      Importado em
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {data.data.map((xml) => (
                    <tr key={xml.id} className="hover:bg-dark-border/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-text-primary">
                        {xml.nomeCliente || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-text-primary">
                        {xml.numeroNota}/{xml.serie}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {formatDate(xml.dataEmissao)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-xs text-text-muted select-all max-w-[200px] truncate block">
                            {xml.chaveAcesso}
                          </code>
                          <button
                            onClick={() => copyChave(xml.chaveAcesso)}
                            className="p-1 rounded text-text-muted hover:text-primary transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {formatDate(xml.createdAt as any)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {xml.status === XmlDocumentStatus.VINCULADO ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-400">
                            Vinculado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/15 text-yellow-400">
                            Sem Nota
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => downloadXml(xml.id, xml.nomeArquivoSistema)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Baixar XML"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {xml.invoiceId && (
                            <button
                              onClick={() => window.open(`/invoices/${xml.invoiceId}`, '_blank')}
                              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Ver nota fiscal"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border">
                <span className="text-sm text-text-muted">
                  Total: {data.total} XMLs
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary text-xs px-3 py-1.5"
                    disabled={data.page <= 1}
                    onClick={() => setPage(data.page - 1)}
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-text-muted">
                    {data.page} de {data.totalPages}
                  </span>
                  <button
                    className="btn-secondary text-xs px-3 py-1.5"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage(data.page + 1)}
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
