'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  Edit3,
} from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import InvoiceTable from '@/components/invoices/InvoiceTable'
import ReceivableTable from '@/components/receivables/ReceivableTable'
import PaymentModal from '@/components/receivables/PaymentModal'
import { useCustomer, useUpdateCustomer } from '@/hooks/useCustomers'
import { useInvoices } from '@/hooks/useInvoices'
import { useReceivables, useCancelReceivable } from '@/hooks/useReceivables'
import type { Receivable, Invoice } from '@/types'

function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5'
  )
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(y, m - 1, d))
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: customer, isLoading } = useCustomer(id)
  const { data: invoicesData } = useInvoices({ page: 1, limit: 10, customerId: id })
  const { data: receivablesData } = useReceivables({ customerId: id })
  const updateCustomer = useUpdateCustomer()
  const cancelReceivable = useCancelReceivable()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [paymentReceivable, setPaymentReceivable] = useState<Receivable | null>(null)
  const [invoiceModal, setInvoiceModal] = useState<Invoice | null>(null)
  const [editForm, setEditForm] = useState({
    razaoSocial: '',
    email: '',
    telefone: '',
    logradouro: '',
    bairro: '',
    numero: '',
    cidade: '',
    uf: '',
    cep: '',
  })

  const openEdit = () => {
    if (!customer) return
    setEditForm({
      razaoSocial: customer.razaoSocial,
      email: customer.email || '',
      telefone: customer.telefone || '',
      logradouro: customer.logradouro || '',
      bairro: customer.bairro || '',
      numero: customer.numero || '',
      cidade: customer.cidade || '',
      uf: customer.uf || '',
      cep: customer.cep || '',
    })
    setEditModalOpen(true)
  }

  const handleEditSave = async () => {
    await updateCustomer.mutateAsync({ id, ...editForm })
    setEditModalOpen(false)
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

  if (!customer) {
    return (
      <PageWrapper title="Cliente não encontrado">
        <p className="text-text-muted">Cliente não encontrado</p>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title={customer.razaoSocial}>
      <div className="space-y-6">
        <button
          onClick={() => router.push('/customers')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Clientes
        </button>
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {customer.razaoSocial}
                </h2>
                {customer.nomeFantasia && (
                  <p className="text-sm text-text-muted">{customer.nomeFantasia}</p>
                )}
                <p className="text-sm font-mono text-text-muted mt-1">
                  {maskCpfCnpj(customer.cnpj || customer.cpf || '')}
                </p>
                {customer.ie && (
                  <p className="text-xs text-text-muted">
                    IE: {customer.ie}
                  </p>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={openEdit}>
              <Edit3 className="h-4 w-4" />
              Editar
            </Button>
          </div>
          <div className="flex gap-6 mt-6 flex-wrap">
            {customer.email && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Mail className="h-4 w-4" />
                {customer.email}
              </div>
            )}
            {customer.telefone && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Phone className="h-4 w-4" />
                {customer.telefone}
              </div>
            )}
            {(customer.logradouro || customer.cidade || customer.uf) && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <MapPin className="h-4 w-4" />
                {[customer.logradouro, customer.numero, customer.cidade, customer.uf].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-text-muted">
                {(customer as any).totalNfes ?? 0} NF-e
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-warning" />
              <span className="text-text-muted">
                {(customer as any).totalEmAberto
                  ? formatBRL((customer as any).totalEmAberto)
                  : 'R$ 0,00'}{' '}
                em aberto
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Notas Fiscais
          </h3>
          <InvoiceTable
            data={invoicesData}
            onPageChange={() => {}}
            onViewInvoice={(inv) => setInvoiceModal(inv)}
          />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Contas a Receber
          </h3>
          <ReceivableTable
            data={receivablesData}
            onPageChange={() => {}}
            onPay={(rec) => setPaymentReceivable(rec)}
            onCancel={(recId) => cancelReceivable.mutate(recId)}
          />
        </Card>
      </div>

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Cliente"
      >
        <div className="space-y-4">
          <Input
            label="Razão Social"
            value={editForm.razaoSocial}
            onChange={(e) =>
              setEditForm({ ...editForm, razaoSocial: e.target.value })
            }
          />
          <Input
            label="Email"
            value={editForm.email}
            onChange={(e) =>
              setEditForm({ ...editForm, email: e.target.value })
            }
          />
          <Input
            label="Telefone"
            value={editForm.telefone}
            onChange={(e) =>
              setEditForm({ ...editForm, telefone: e.target.value })
            }
          />
          <Input
            label="Logradouro"
            value={editForm.logradouro}
            onChange={(e) =>
              setEditForm({ ...editForm, logradouro: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Número"
              value={editForm.numero}
              onChange={(e) =>
                setEditForm({ ...editForm, numero: e.target.value })
              }
            />
            <Input
              label="Bairro"
              value={editForm.bairro}
              onChange={(e) =>
                setEditForm({ ...editForm, bairro: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Cidade"
              value={editForm.cidade}
              onChange={(e) =>
                setEditForm({ ...editForm, cidade: e.target.value })
              }
            />
            <Input
              label="UF"
              value={editForm.uf}
              onChange={(e) =>
                setEditForm({ ...editForm, uf: e.target.value })
              }
            />
            <Input
              label="CEP"
              value={editForm.cep}
              onChange={(e) =>
                setEditForm({ ...editForm, cep: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setEditModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              loading={updateCustomer.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <PaymentModal
        receivable={paymentReceivable}
        open={!!paymentReceivable}
        onClose={() => setPaymentReceivable(null)}
      />

      <Modal
        open={!!invoiceModal}
        onClose={() => setInvoiceModal(null)}
        title={invoiceModal ? `NF-e ${invoiceModal.numero}/${invoiceModal.serie}` : ''}
        size="lg"
      >
        {invoiceModal && (
          <div className="space-y-6">
            <div className="bg-dark-border/20 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
                Cliente
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-muted">Razão Social</p>
                  <p className="text-sm font-medium text-text-primary">{customer?.razaoSocial}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">CNPJ/CPF</p>
                  <p className="text-sm font-mono text-text-primary">{maskCpfCnpj(customer?.cnpj || customer?.cpf || '')}</p>
                </div>
              </div>
            </div>

            <div className="bg-dark-border/20 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
                Nota Fiscal
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Chave de Acesso:</span>
                  <code className="font-mono text-xs text-text-primary bg-dark-bg px-2 py-1 rounded select-all">
                    {invoiceModal.chaveAcesso}
                  </code>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div>
                    <p className="text-xs text-text-muted">Valor Total</p>
                    <p className="text-lg font-bold text-text-primary">{formatBRL(invoiceModal.valorTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Parcelas</p>
                    <p className="text-lg font-bold text-text-primary">{invoiceModal.receivables?.length ?? 0}x</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Status</p>
                    <div className="mt-1"><Badge status={invoiceModal.status} /></div>
                  </div>
                </div>
              </div>
            </div>

            {invoiceModal.receivables && invoiceModal.receivables.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
                  Parcelas
                </h4>
                <div className="overflow-x-auto rounded-lg border border-dark-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-dark-border/20 border-b border-dark-border">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase">Parcela</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-text-muted uppercase">Valor</th>
                        <th className="px-4 py-2.5 text-center text-xs font-medium text-text-muted uppercase">Vencimento</th>
                        <th className="px-4 py-2.5 text-center text-xs font-medium text-text-muted uppercase">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border">
                      {invoiceModal.receivables
                        .sort((a, b) => a.parcela - b.parcela)
                        .map((rec) => (
                          <tr key={rec.id} className="hover:bg-dark-border/10">
                            <td className="px-4 py-2.5 text-text-primary font-medium">{rec.parcela}ª</td>
                            <td className="px-4 py-2.5 text-right font-mono text-text-primary">{formatBRL(rec.valorReceber)}</td>
                            <td className="px-4 py-2.5 text-center text-text-muted">{formatDate(rec.dataVencimento)}</td>
                            <td className="px-4 py-2.5 text-center"><Badge status={rec.status} /></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-dark-border">
              <Button variant="secondary" onClick={() => setInvoiceModal(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  )
}
