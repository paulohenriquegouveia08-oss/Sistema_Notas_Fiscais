'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Trash2, X, Eye, Download } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import { usePdfDocuments, useUploadPdf, useDeletePdf } from '@/hooks/usePdfStorage'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PdfStoragePage() {
  const [observacao, setObservacao] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: documents, isLoading } = usePdfDocuments()
  const uploadMutation = useUploadPdf()
  const deleteMutation = useDeletePdf()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    uploadMutation.mutate(files, {
      onSettled: () => { setObservacao(''); e.target.value = '' },
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Remover "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  const previewDoc = documents?.find((d) => d.id === previewId)

  return (
    <PageWrapper title="PDFs Armazenados">
      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Upload de PDF
          </h2>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm text-text-muted mb-1">
                Observa&ccedil;&atilde;o (opcional)
              </label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: DANFE da compra de junho"
                className="input-field"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploadMutation.isPending ? 'Enviando...' : 'Selecionar PDFs'}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
          </div>
        ) : documents?.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="h-12 w-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">Nenhum PDF armazenado</p>
            <p className="text-sm text-text-muted/60 mt-1">
              Fa&ccedil;a upload do primeiro PDF acima
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents?.map((doc) => (
              <div
                key={doc.id}
                className="card p-4 flex flex-col hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => setPreviewId(doc.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-text-primary truncate">
                      {doc.originalName}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(doc.id, doc.originalName)
                    }}
                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1 text-xs text-text-muted mt-auto">
                  <p>Tamanho: {formatSize(doc.fileSize)}</p>
                  <p>Data: {formatDate(doc.createdAt)}</p>
                  {doc.observacao && (
                    <p className="text-text-muted truncate" title={doc.observacao}>
                      {doc.observacao}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewId && previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="bg-dark-surface rounded-lg w-full max-w-4xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-text-primary font-medium truncate">
                  {previewDoc.originalName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${API_URL}/pdf-storage/${previewDoc.id}/file`}
                  download={previewDoc.originalName}
                  className="btn-primary flex items-center gap-1 text-sm py-1.5 px-3"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <button
                  onClick={() => setPreviewId(null)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-b-lg overflow-hidden">
              <embed
                src={`${API_URL}/pdf-storage/${previewDoc.id}/file`}
                type="application/pdf"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
