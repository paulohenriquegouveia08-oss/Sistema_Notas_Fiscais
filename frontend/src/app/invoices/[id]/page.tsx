'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  FileText,
  Copy,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  FileDown,
  Hash,
  ArrowLeft,
  Barcode,
  CreditCard,
  Package,
  Scale,
  Truck,
  Percent,
  Receipt,
  Save,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { useInvoice, useUpdateInvoice } from '@/hooks/useInvoices'
import { formatBRL } from '@/utils/format'

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(y, m - 1, d))
}

const toInputDate = (dateStr: string) => {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

const paymentMethodLabel: Record<string, string> = {
  AVISTA: 'À Vista',
  PARCELADO: 'Parcelado',
  DINHEIRO: 'Dinheiro',
  CHEQUE: 'Cheque',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  BOLETO: 'Boleto',
  PIX: 'Pix',
  CREDIARIO: 'Crediário',
  VALE_ALIMENTACAO: 'Vale Alimentação',
  VALE_REFEICAO: 'Vale Refeição',
  OUTRO: 'Outro',
}

function parseXmlProducts(xmlStr: string): any[] {
  try {
    const parser = new DOMParser()
    const xml = parser.parseFromString(xmlStr, 'text/xml')
    const dets = xml.querySelectorAll('det')
    if (!dets.length) return []

    return Array.from(dets).map((det) => {
      const prod = det.querySelector('prod')
      if (!prod) return null
      return {
        codigo: prod.querySelector('cProd')?.textContent || '',
        descricao: prod.querySelector('xProd')?.textContent || '',
        ncm: prod.querySelector('NCM')?.textContent || '',
        cfop: prod.querySelector('CFOP')?.textContent || '',
        unidade: prod.querySelector('uCom')?.textContent || '',
        quantidade: parseFloat(prod.querySelector('qCom')?.textContent || '0'),
        valorUnitario: parseFloat(prod.querySelector('vUnCom')?.textContent || '0'),
        valorTotal: parseFloat(prod.querySelector('vProd')?.textContent || '0'),
      }
    }).filter(Boolean)
  } catch {
    return []
  }
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {icon && <span className="text-text-muted w-4 h-4 flex-shrink-0">{icon}</span>}
      <span className="text-xs text-text-muted min-w-[120px]">{label}</span>
      <span className="text-sm text-text-primary font-medium">{value}</span>
    </div>
  )
}

function EditableRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {icon && <span className="text-text-muted w-4 h-4 flex-shrink-0">{icon}</span>}
      <span className="text-xs text-text-muted min-w-[120px]">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: invoice, isLoading } = useInvoice(id)
  const updateMutation = useUpdateInvoice()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})

  const startEdit = () => {
    if (!invoice) return
    setForm({
      dataEmissao: toInputDate(invoice.dataEmissao),
      dataEntrada: toInputDate(invoice.dataEntrada || ''),
      valorTotal: invoice.valorTotal ?? '',
      valorProdutos: invoice.valorProdutos ?? '',
      valorFrete: invoice.valorFrete ?? '',
      valorDesconto: invoice.valorDesconto ?? '',
      valorTotalTributos: invoice.valorTotalTributos ?? '',
      tipoPagamento: invoice.tipoPagamento || '',
      qtdeParcelas: invoice.qtdeParcelas ?? '',
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm({})
  }

  const saveEdit = () => {
    const payload: Record<string, any> = {}
    if (form.dataEmissao) payload.dataEmissao = form.dataEmissao
    if (form.dataEntrada) payload.dataEntrada = form.dataEntrada
    if (form.valorTotal !== '' && form.valorTotal != null) payload.valorTotal = Number(form.valorTotal)
    if (form.valorProdutos !== '' && form.valorProdutos != null) payload.valorProdutos = Number(form.valorProdutos)
    if (form.valorFrete !== '' && form.valorFrete != null) payload.valorFrete = Number(form.valorFrete)
    if (form.valorDesconto !== '' && form.valorDesconto != null) payload.valorDesconto = Number(form.valorDesconto)
    if (form.valorTotalTributos !== '' && form.valorTotalTributos != null) payload.valorTotalTributos = Number(form.valorTotalTributos)
    if (form.tipoPagamento) payload.tipoPagamento = form.tipoPagamento
    if (form.qtdeParcelas !== '' && form.qtdeParcelas != null) payload.qtdeParcelas = Number(form.qtdeParcelas)

    updateMutation.mutate(
      { id, ...payload },
      { onSuccess: () => setEditing(false) }
    )
  }

  const copyChave = () => {
    if (!invoice) return
    navigator.clipboard.writeText(invoice.chaveAcesso).then(() => {
      toast.success('Chave de acesso copiada')
    })
  }

  const products = invoice?.xmlCompleto ? parseXmlProducts(invoice.xmlCompleto) : []
  const hasProducts = products.length > 0

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

  const inputClass = 'input-field w-full text-sm py-1 px-2'
  const selectClass = 'input-field w-full text-sm py-1 px-2'

  return (
    <PageWrapper
      title={`NF-e ${invoice.numero}/${invoice.serie}`}
    >
      <div className="space-y-6 max-w-4xl">
        {/* ── Back button ── */}
        <button
          onClick={() => router.push('/invoices')}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para notas fiscais
        </button>

        {/* ── Header ── */}
        <Card className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
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
                <div className="flex items-center gap-4 mt-2 text-sm text-text-muted flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Emissão: {formatDate(invoice.dataEmissao as any)}
                  </span>
                  {invoice.dataEntrada && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Entrada: {formatDate(invoice.dataEntrada as any)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {formatBRL(invoice.valorTotal)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={updateMutation.isPending}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={startEdit}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  Editar dados
                </button>
              )}
            </div>
          </div>

          {/* Chave de Acesso */}
          <div className="mt-6 p-4 rounded-lg bg-dark-border/50 border border-dark-border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Barcode className="h-3 w-3" />
                  Chave de Acesso
                </p>
                <code className="font-mono text-sm text-text-primary select-all break-all">
                  {invoice.chaveAcesso}
                </code>
              </div>
              <button
                onClick={copyChave}
                className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors ml-2 flex-shrink-0"
                title="Copiar chave de acesso"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>

        {/* ── Cliente ── */}
        {invoice.customer && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Destinatário
              </h3>
              <button
                onClick={() => router.push(`/customers/${invoice.customerId}`)}
                className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow label="Razão Social" value={invoice.customer.razaoSocial} icon={<Building2 className="h-3.5 w-3.5" />} />
              <InfoRow label="CNPJ/CPF" value={invoice.customer.cnpj || invoice.customer.cpf || '-'} icon={<Hash className="h-3.5 w-3.5" />} />
              {invoice.customer.telefone && <InfoRow label="Telefone" value={invoice.customer.telefone} />}
              {invoice.customer.email && <InfoRow label="E-mail" value={invoice.customer.email} />}
              {(invoice.customer.logradouro || invoice.customer.cidade) && (
                <InfoRow
                  label="Endereço"
                  value={[invoice.customer.logradouro, invoice.customer.numero, invoice.customer.cidade, invoice.customer.uf].filter(Boolean).join(', ')}
                />
              )}
            </div>
          </Card>
        )}

        {/* ── Dados Adicionais (editáveis) ── */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Dados Adicionais
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {editing ? (
              <>
                <EditableRow label="Data Emissão" icon={<Calendar className="h-3.5 w-3.5" />}>
                  <input
                    type="date"
                    value={form.dataEmissao || ''}
                    onChange={(e) => setForm({ ...form, dataEmissao: e.target.value })}
                    className={inputClass}
                  />
                </EditableRow>
                <EditableRow label="Data Entrada" icon={<Calendar className="h-3.5 w-3.5" />}>
                  <input
                    type="date"
                    value={form.dataEntrada || ''}
                    onChange={(e) => setForm({ ...form, dataEntrada: e.target.value })}
                    className={inputClass}
                  />
                </EditableRow>
                <EditableRow label="Valor Total" icon={<DollarSign className="h-3.5 w-3.5" />}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valorTotal ?? ''}
                    onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
                    className={inputClass}
                  />
                </EditableRow>
                <EditableRow label="Valor Produtos" icon={<Package className="h-3.5 w-3.5" />}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valorProdutos ?? ''}
                    onChange={(e) => setForm({ ...form, valorProdutos: e.target.value })}
                    className={inputClass}
                  />
                </EditableRow>
                <EditableRow label="Frete" icon={<Truck className="h-3.5 w-3.5" />}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valorFrete ?? ''}
                    onChange={(e) => setForm({ ...form, valorFrete: e.target.value })}
                    className={inputClass}
                  />
                </EditableRow>
                <EditableRow label="Desconto" icon={<Percent className="h-3.5 w-3.5" />}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valorDesconto ?? ''}
                    onChange={(e) => setForm({ ...form, valorDesconto: e.target.value })}
                    className={inputClass}
                  />
                </EditableRow>
                <EditableRow label="Total Tributos">
                  <input
                    type="number"
                    step="0.01"
                    value={form.valorTotalTributos ?? ''}
                    onChange={(e) => setForm({ ...form, valorTotalTributos: e.target.value })}
                    className={inputClass}
                  />
                </EditableRow>
                <EditableRow label="Tipo Pagamento" icon={<CreditCard className="h-3.5 w-3.5" />}>
                  <select
                    value={form.tipoPagamento || ''}
                    onChange={(e) => setForm({ ...form, tipoPagamento: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">-</option>
                    <option value="AVISTA">À Vista</option>
                    <option value="PARCELADO">Parcelado</option>
                  </select>
                </EditableRow>
                <EditableRow label="Qtde Parcelas">
                  <input
                    type="number"
                    value={form.qtdeParcelas ?? ''}
                    onChange={(e) => setForm({ ...form, qtdeParcelas: e.target.value })}
                    className={inputClass}
                  />
                </EditableRow>
              </>
            ) : (
              <>
                <InfoRow label="Data Emissão" value={formatDate(invoice.dataEmissao as any)} icon={<Calendar className="h-3.5 w-3.5" />} />
                {invoice.dataEntrada && (
                  <InfoRow label="Data Entrada" value={formatDate(invoice.dataEntrada as any)} icon={<Calendar className="h-3.5 w-3.5" />} />
                )}
                <InfoRow label="Valor Total" value={formatBRL(invoice.valorTotal)} icon={<DollarSign className="h-3.5 w-3.5" />} />
                {invoice.valorProdutos != null && (
                  <InfoRow label="Valor Produtos" value={formatBRL(invoice.valorProdutos)} icon={<Package className="h-3.5 w-3.5" />} />
                )}
                {invoice.valorFrete != null && Number(invoice.valorFrete) > 0 && (
                  <InfoRow label="Frete" value={formatBRL(invoice.valorFrete)} icon={<Truck className="h-3.5 w-3.5" />} />
                )}
                {invoice.valorDesconto != null && Number(invoice.valorDesconto) > 0 && (
                  <InfoRow label="Desconto" value={formatBRL(invoice.valorDesconto)} icon={<Percent className="h-3.5 w-3.5" />} />
                )}
                {invoice.valorTotalTributos != null && Number(invoice.valorTotalTributos) > 0 && (
                  <InfoRow label="Total Tributos" value={formatBRL(invoice.valorTotalTributos)} />
                )}
                {invoice.tipoPagamento && (
                  <InfoRow label="Tipo Pagamento" value={paymentMethodLabel[invoice.tipoPagamento] || invoice.tipoPagamento} icon={<CreditCard className="h-3.5 w-3.5" />} />
                )}
                {invoice.qtdeParcelas != null && Number(invoice.qtdeParcelas) > 0 && (
                  <InfoRow label="Parcelas" value={String(invoice.qtdeParcelas)} />
                )}
              </>
            )}
          </div>
        </Card>

        {/* ── Produtos ── */}
        {hasProducts && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Produtos
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border">
                    <th className="text-left py-2 px-2 text-xs text-text-muted uppercase">Código</th>
                    <th className="text-left py-2 px-2 text-xs text-text-muted uppercase">Descrição</th>
                    <th className="text-right py-2 px-2 text-xs text-text-muted uppercase">Qtd</th>
                    <th className="text-right py-2 px-2 text-xs text-text-muted uppercase">Valor Unit.</th>
                    <th className="text-right py-2 px-2 text-xs text-text-muted uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border/50">
                  {products.map((prod, i) => (
                    <tr key={i} className="hover:bg-dark-border/20">
                      <td className="py-2 px-2 text-text-muted font-mono text-xs">{prod.codigo}</td>
                      <td className="py-2 px-2 text-text-primary">{prod.descricao}</td>
                      <td className="py-2 px-2 text-right text-text-muted">{prod.quantidade} {prod.unidade}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatBRL(prod.valorUnitario)}</td>
                      <td className="py-2 px-2 text-right font-mono font-medium">{formatBRL(prod.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Pagamento ── */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Pagamento
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {invoice.tipoPagamento && (
              <InfoRow label="Tipo" value={paymentMethodLabel[invoice.tipoPagamento] || invoice.tipoPagamento} icon={<CreditCard className="h-3.5 w-3.5" />} />
            )}
            {invoice.qtdeParcelas != null && Number(invoice.qtdeParcelas) > 0 && (
              <InfoRow label="Parcelas" value={String(invoice.qtdeParcelas)} />
            )}
          </div>

          {invoice.receivables && invoice.receivables.length > 0 && (
            <div className="space-y-2 mt-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Parcelas</p>
              {invoice.receivables.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-border/30"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-text-muted">
                      {rec.parcela === 1 && invoice.tipoPagamento === 'AVISTA' ? 'À Vista' : `Parcela ${rec.parcela}`}
                    </span>
                    <Badge status={rec.status} />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-text-muted">
                      Venc: {formatDate(rec.dataVencimento)}
                    </span>
                    <span className="text-sm font-mono font-medium">
                      {formatBRL(rec.valorReceber)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── PDF ── */}
        {invoice.pdfPath && (
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <FileDown className="h-5 w-5 text-primary" />
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL}/invoices/${invoice.id}/pdf`}
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
              >
                Download PDF da NF-e
              </a>
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}
