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

interface InvoiceDetail {
  products: any[]
  serie: string
  numero: string
  tipoPagamento: string
  qtdeParcelas: number
  valorTotal: number
  receivables: Array<{
    parcela: number
    valorReceber: number
    dataVencimento: string
    status: string
  }>
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
  const [numero, setNumero] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productCode, setProductCode] = useState('')
  const [serie, setSerie] = useState('')
  const [unitValue, setUnitValue] = useState('')
  const [quantity, setQuantity] = useState('')
  const [generatedPdf, setGeneratedPdf] = useState<GeneratedPdf | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoiceDetail(null)
      return
    }
    api
      .get<InvoiceDetail>(`/pdf-storage/date-editor/products/${selectedInvoiceId}`)
      .then((res) => {
        const data = res.data
        setInvoiceDetail(data)
        const first = data.products?.[0]
        if (first) {
          setProductDescription(first.descricao || '')
          setProductCode(first.codigo || '')
          setUnitValue(String(first.vUnCom ?? ''))
          setQuantity(String(first.qCom ?? ''))
        } else {
          setProductDescription('')
          setProductCode('')
          setUnitValue('')
          setQuantity('')
        }
        setSerie(data.serie || '')
        setNumero(data.numero || '')
      })
      .catch(() => {
        setProductDescription('')
        setProductCode('')
        setUnitValue('')
        setQuantity('')
        setSerie('')
        setNumero('')
        setInvoiceDetail(null)
      })
  }, [selectedInvoiceId])

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

  const calculatedTotal = unitValue && quantity ? Number(unitValue) * Number(quantity) : 0

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<GeneratedPdf>('/pdf-storage/date-editor', {
        invoiceId: selectedInvoiceId,
        date,
        time: time || undefined,
        productDescription: productDescription || undefined,
        productCode: productCode || undefined,
        serie: serie || undefined,
        numero: numero || undefined,
        unitValue: unitValue ? Number(unitValue) : undefined,
        quantity: quantity ? Number(quantity) : undefined,
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
    setProductDescription('')
    setProductCode('')
    setSerie('')
    setNumero('')
    setUnitValue('')
    setQuantity('')
  }

  const tipoPagamentoLabel = invoiceDetail?.tipoPagamento === '1' ? 'À Vista' : invoiceDetail?.tipoPagamento === '2' ? 'A Prazo' : invoiceDetail?.tipoPagamento || '-'

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
                Editar DANFE
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
                {invoiceDetail && (
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-text-muted">
                      Pagamento: <span className="text-text-primary font-medium">{tipoPagamentoLabel}</span>
                    </span>
                    {invoiceDetail.qtdeParcelas > 0 && (
                      <span className="text-text-muted">
                        Parcelas: <span className="text-text-primary font-medium">{invoiceDetail.qtdeParcelas}x</span>
                      </span>
                    )}
                  </div>
                )}
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

              {selectedInvoiceId && (
                <>
                  <label className="block">
                    <span className="block text-sm text-text-muted mb-1">
                      Número da nota
                    </span>
                    <input
                      type="text"
                      value={numero}
                      onChange={(event) => setNumero(event.target.value)}
                      placeholder="Ex: 2630"
                      className="input-field"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm text-text-muted mb-1">
                      Série
                    </span>
                    <input
                      type="text"
                      value={serie}
                      onChange={(event) => setSerie(event.target.value)}
                      placeholder="Ex: 1"
                      className="input-field"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm text-text-muted mb-1">
                      Código do produto
                    </span>
                    <input
                      type="text"
                      value={productCode}
                      onChange={(event) => setProductCode(event.target.value)}
                      placeholder="Ex: 001"
                      className="input-field"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm text-text-muted mb-1">
                      Descrição do produto
                    </span>
                    <input
                      type="text"
                      value={productDescription}
                      onChange={(event) => setProductDescription(event.target.value)}
                      placeholder="Ex: Bateria 12V 60Ah"
                      className="input-field"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm text-text-muted mb-1">
                        Valor unitário (R$)
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={unitValue}
                        onChange={(event) => setUnitValue(event.target.value)}
                        placeholder="0,00"
                        className="input-field"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-sm text-text-muted mb-1">
                        Quantidade
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        placeholder="1"
                        className="input-field"
                      />
                    </label>
                  </div>

                  {unitValue && quantity && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                      <div className="flex justify-between text-xs text-text-muted">
                        <span>Valor unitário × Quantidade</span>
                      </div>
                      <div className="text-center">
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(calculatedTotal)}
                        </span>
                      </div>
                    </div>
                  )}

                  {invoiceDetail && invoiceDetail.receivables.length > 0 && (
                    <div className="rounded-lg border border-dark-border p-3 space-y-2">
                      <p className="text-xs font-medium text-text-muted uppercase">
                        Duplicatas ({invoiceDetail.receivables.length}x)
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {invoiceDetail.receivables.map((r) => (
                          <div key={r.parcela} className="flex justify-between text-xs">
                            <span className="text-text-muted">
                              {String(r.parcela).padStart(3, '0')} — {formatDate(r.dataVencimento)}
                            </span>
                            <span className="text-text-primary font-medium">
                              {formatCurrency(r.valorReceber)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs font-semibold pt-1 border-t border-dark-border">
                        <span className="text-text-muted">Total nota</span>
                        <span className="text-text-primary">{formatCurrency(invoiceDetail.valorTotal)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
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
