'use client'

import { useParams, useRouter } from 'next/navigation'
import {
  FileText,
  Copy,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  FileDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { useInvoice } from '@/hooks/useInvoices'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(date))

const labelMap: Record<string, string> = {
  EMITIDA: 'Emitida',
  AUTORIZADA: 'Autorizada',
  CANCELADA: 'Cancelada',
  DENEGADA: 'Denegada',
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: invoice, isLoading } = useInvoice(id)

  const copyChave = () => {
    if (!invoice) return
    navigator.clipboard.writeText(invoice.chaveAcesso).then(() => {
      toast.success('Chave de acesso copiada')
    })
  }

  if (isLoading) {
    return (
      <PageWrapper title="Carregando...">
        <div className="flex items-center justify-center h-96">
          <Spinner size="lg" />
        </div>
      </PageWrapper>
    )
  }

  if (!invoice) {
    return (
      <PageWrapper title="Nota não encontrada">
        <p className="text-text-muted">Nota fiscal não encontrada</p>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title={`NF-e ${invoice.numero}/${invoice.serie}`}>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-text-primary">
                    NF-e {invoice.numero}/{invoice.serie}
                  </h2>
                  <Badge status={invoice.status} />
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(invoice.dataEmissao)}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {formatBRL(invoice.valorTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-dark-border/50 border border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                  Chave de Acesso
                </p>
                <code className="font-mono text-sm text-text-primary select-all">
                  {invoice.chaveAcesso}
                </code>
              </div>
              <button
                onClick={copyChave}
                className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                title="Copiar chave de acesso"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          {invoice.pdfPath && (
            <div className="mt-4">
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL}/invoices/${invoice.id}/pdf`}
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
              >
                <FileDown className="h-4 w-4" />
                Download PDF
              </a>
            </div>
          )}

        </Card>

        {invoice.customer && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-text-muted">Cliente</p>
                  <p className="text-base font-medium text-text-primary">
                    {invoice.customer.razaoSocial}
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/customers/${invoice.customerId}`)}
                className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </Card>
        )}

        {invoice.receivables && invoice.receivables.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Parcelas
            </h3>
            <div className="space-y-3">
              {invoice.receivables.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-border/30"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-text-muted">
                      Parcela {rec.parcela}
                    </span>
                    <Badge status={rec.status} />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-text-muted">
                      Vence: {formatDate(rec.dataVencimento)}
                    </span>
                    <span className="text-sm font-mono font-medium">
                      {formatBRL(rec.valorReceber)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {invoice.xmlCompleto && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              XML Original
            </h3>
            <pre className="text-xs text-text-muted bg-dark-border/30 p-4 rounded-lg overflow-auto max-h-96 leading-relaxed font-mono whitespace-pre-wrap break-all">
              {invoice.xmlCompleto}
            </pre>
          </Card>
        )}

      </div>
    </PageWrapper>
  )
}
