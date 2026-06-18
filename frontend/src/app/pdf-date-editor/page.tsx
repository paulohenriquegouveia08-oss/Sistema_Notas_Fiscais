'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageWrapper from '@/components/layout/PageWrapper'
import { useInvoices } from '@/hooks/useInvoices'
import api from '@/services/api'
import type { Invoice } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

interface GeneratedPdf {
  fileName: string
  originalName: string
  fileSize: number
  fileUrl: string
  invoice: {
    id: string
    numero: string
    serie: string
    chaveAcesso: string
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatCurrency(value?: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function todayInputValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export default function PdfDateEditorPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [date, setDate] = useState(todayInputValue)
  const [time, setTime] = useState('')
  const [generatedPdf, setGeneratedPdf] = useState<GeneratedPdf | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: invoicesData, isLoading } = useInvoices({
    page: 1,
    limit: 30,
    search: debouncedSearch || undefined,
    sortBy: 'numero',
    sortOrder: 'desc',
  })

  const invoices = useMemo(
    () => (invoicesData?.data || []).filter((invoice) => invoice.pdfPath),
    [invoicesData?.data]
  )

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId)

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<GeneratedPdf>('/pdf-storage/date-editor', {
        invoiceId: selectedInvoiceId,
        date,
        time: time || undefined,
      })
      return data
    },
    onSuccess: (data) => {
      setGeneratedPdf(data)
      toast.success('PDF gerado')
    },
  })

  const generatedUrl = generatedPdf ? `${API_URL}${generatedPdf.fileUrl}` : ''

  const handleGenerate = () => {
    if (!selectedInvoiceId) {
      toast.error('Selecione uma nota fiscal')
      return
    }

    if (!date) {
      toast.error('Informe a nova data')
      return
    }

    setGeneratedPdf(null)
    generateMutation.mutate()
  }

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoiceId(invoice.id)
    setGeneratedPdf(null)
  }

  return (
    <PageWrapper title="Editor de Data da DANFE">
      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <section className="card p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-text-primary">
                Selecionar nota fiscal
              </h2>
              <p className="text-sm text-text-muted">
                O arquivo gerado é uma nova cópia da DANFE e não substitui o PDF oficial da nota.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por número, chave ou cliente..."
                className="input-field pl-10"
              />
            </div>

            <div className="border border-dark-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[96px_minmax(0,1fr)_120px_120px] gap-3 px-4 py-2 bg-dark-bg text-xs font-medium text-text-muted">
                <span>Nota</span>
                <span>Cliente</span>
                <span>Emissão</span>
                <span className="text-right">Valor</span>
              </div>

              <div className="divide-y divide-dark-border max-h-[460px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-text-muted">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando notas...
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="py-16 text-center text-text-muted">
                    Nenhuma nota com PDF encontrada
                  </div>
                ) : (
                  invoices.map((invoice) => {
                    const active = selectedInvoiceId === invoice.id

                    return (
                      <button
                        key={invoice.id}
                        type="button"
                        onClick={() => handleSelectInvoice(invoice)}
                        className={`w-full grid grid-cols-[96px_minmax(0,1fr)_120px_120px] gap-3 px-4 py-3 text-left transition-colors ${
                          active ? 'bg-primary/15' : 'hover:bg-dark-border/50'
                        }`}
                      >
                        <span className="font-medium text-text-primary">
                          {invoice.numero}/{invoice.serie}
                        </span>
                        <span className="text-sm text-text-primary truncate">
                          {invoice.customer?.razaoSocial || invoice.chaveAcesso}
                        </span>
                        <span className="text-sm text-text-muted">
                          {formatDate(invoice.dataEmissao)}
                        </span>
                        <span className="text-sm text-text-primary text-right">
                          {formatCurrency(invoice.valorTotal)}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </section>

          <aside className="card p-5 h-fit space-y-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-text-primary">
                Nova data
              </h2>
            </div>

            {selectedInvoice ? (
              <div className="rounded-lg border border-dark-border p-3 space-y-1">
                <p className="text-sm font-medium text-text-primary">
                  NF-e {selectedInvoice.numero}/{selectedInvoice.serie}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {selectedInvoice.customer?.razaoSocial || selectedInvoice.chaveAcesso}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dark-border p-3 text-sm text-text-muted">
                Escolha uma nota na lista.
              </div>
            )}

            <div className="space-y-3">
              <label className="block">
                <span className="block text-sm text-text-muted mb-1">
                  Data
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="input-field"
                />
              </label>

              <label className="block">
                <span className="block text-sm text-text-muted mb-1">
                  Horário opcional
                </span>
                <input
                  type="time"
                  step="1"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="input-field"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="btn-primary w-full gap-2"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {generateMutation.isPending ? 'Gerando...' : 'Gerar PDF'}
            </button>

            {generatedPdf && (
              <div className="rounded-lg border border-success/30 bg-success/10 p-3 space-y-3">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">PDF gerado</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={generatedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary gap-2 text-sm"
                  >
                    <Eye className="h-4 w-4" />
                    Abrir
                  </a>
                  <a
                    href={generatedUrl}
                    download={generatedPdf.originalName}
                    className="btn-primary gap-2 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Baixar
                  </a>
                </div>
              </div>
            )}
          </aside>
        </div>

        {generatedPdf && (
          <section className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-text-primary truncate">
                  {generatedPdf.originalName}
                </span>
              </div>
              <a
                href={generatedUrl}
                download={generatedPdf.originalName}
                className="btn-secondary gap-2 text-sm py-1.5 px-3"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            </div>
            <div className="bg-white h-[760px]">
              <embed
                src={generatedUrl}
                type="application/pdf"
                className="w-full h-full"
              />
            </div>
          </section>
        )}
      </div>
    </PageWrapper>
  )
}
