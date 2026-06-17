'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, Trash2, X, Download, Eye, AlertTriangle, Search } from 'lucide-react'
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
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [uploadQueue, setUploadQueue] = useState<File[]>([])
  const [uploadObservacao, setUploadObservacao] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: documents, isLoading } = usePdfDocuments(debouncedSearch || undefined)
  const uploadMutation = useUploadPdf()
  const deleteMutation = useDeletePdf()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadQueue(files)
    setUploadObservacao('')
    e.target.value = ''
  }

  const handleUpload = () => {
    if (!uploadQueue.length) return
    uploadMutation.mutate(uploadQueue, {
      onSettled: () => {
        setUploadQueue([])
        setUploadObservacao('')
      },
    })
  }

  const handleDelete = (id: string, _name: string) => {
    deleteMutation.mutate(id)
  }

  const previewDoc = documents?.find((d) => d.id === previewId)
  const selectedFile = uploadQueue[0] || null
  const previewUrl = selectedFile ? URL.createObjectURL(selectedFile) : null

  return (
    <PageWrapper title="PDFs Armazenados">
      <div className="space-y-6">
        {/* ── Upload Area ── */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Upload de PDF
          </h2>
          <div className="flex items-end gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
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

        {/* ── Upload Preview Modal ── */}
        {selectedFile && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => { setUploadQueue([]); setUploadObservacao('') }}
          >
            <div
              className="bg-dark-surface rounded-lg w-full max-w-4xl max-h-[95vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-dark-border">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-text-primary font-medium truncate">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-text-muted">
                    ({formatSize(selectedFile.size)})
                  </span>
                </div>
                <button
                  onClick={() => { setUploadQueue([]); setUploadObservacao('') }}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* PDF Preview */}
              <div className="flex-1 bg-white min-h-[400px] overflow-hidden">
                {previewUrl && (
                  <embed
                    src={previewUrl}
                    type="application/pdf"
                    className="w-full h-full"
                  />
                )}
              </div>

              {/* Observation + Upload */}
              <div className="p-4 border-t border-dark-border space-y-3">
                <div>
                  <label className="block text-sm text-text-muted mb-1">
                    Observação (opcional)
                  </label>
                  <input
                    type="text"
                    value={uploadObservacao}
                    onChange={(e) => setUploadObservacao(e.target.value)}
                    placeholder="Ex: DANFE da compra de junho"
                    className="input-field w-full"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setUploadQueue([]); setUploadObservacao('') }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploadMutation.isPending}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadMutation.isPending ? 'Enviando...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Search ── */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nome do arquivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {/* ── Document List ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
          </div>
        ) : documents?.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="h-12 w-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">Nenhum PDF armazenado</p>
            <p className="text-sm text-text-muted/60 mt-1">
              Faça o upload do primeiro PDF acima
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents?.map((doc) => (
              <div
                key={doc.id}
                className={`card p-4 flex flex-col transition-colors cursor-pointer group ${doc.fileExists === false ? 'border-danger/30 hover:border-danger/50' : 'hover:border-primary/50'}`}
                onClick={() => doc.fileExists !== false && setPreviewId(doc.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {doc.fileExists === false ? (
                      <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
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
                  {doc.fileExists === false && (
                    <p className="text-danger flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Arquivo não encontrado no servidor
                    </p>
                  )}
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

      {/* ── Preview Modal (existing docs) ── */}
      {previewId && previewDoc && !selectedFile && (
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
                {previewDoc.fileExists === false ? (
                  <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                )}
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
            <div className="flex-1 bg-white rounded-b-lg overflow-hidden flex items-center justify-center">
              {previewDoc.fileExists === false ? (
                <div className="text-center p-12">
                  <AlertTriangle className="h-16 w-16 text-danger mx-auto mb-4" />
                  <p className="text-lg font-medium text-text-muted">Arquivo não encontrado</p>
                  <p className="text-sm text-text-muted/60 mt-1">
                    O arquivo físico foi removido do servidor.
                  </p>
                </div>
              ) : (
                <embed
                  src={`${API_URL}/pdf-storage/${previewDoc.id}/file`}
                  type="application/pdf"
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
