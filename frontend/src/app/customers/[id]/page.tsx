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
import type { Receivable } from '@/types'

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
  const [editForm, setEditForm] = useState({
    razaoSocial: '',
    email: '',
    telefone: '',
    endereco: '',
    cidade: '',
    estado: '',
  })

  const openEdit = () => {
    if (!customer) return
    setEditForm({
      razaoSocial: customer.razaoSocial,
      email: customer.email || '',
      telefone: customer.telefone || '',
      endereco: customer.endereco || '',
      cidade: customer.cidade || '',
      estado: customer.estado || '',
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
                  {maskCpfCnpj(customer.cnpjCpf || customer.cnpj || '')}
                </p>
                {customer.inscricaoEstadual && (
                  <p className="text-xs text-text-muted">
                    IE: {customer.inscricaoEstadual}
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
            {(customer.cidade || customer.estado) && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <MapPin className="h-4 w-4" />
                {[customer.cidade, customer.estado].filter(Boolean).join(' - ')}
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
            label="Endereço"
            value={editForm.endereco}
            onChange={(e) =>
              setEditForm({ ...editForm, endereco: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cidade"
              value={editForm.cidade}
              onChange={(e) =>
                setEditForm({ ...editForm, cidade: e.target.value })
              }
            />
            <Input
              label="Estado"
              value={editForm.estado}
              onChange={(e) =>
                setEditForm({ ...editForm, estado: e.target.value })
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
    </PageWrapper>
  )
}
