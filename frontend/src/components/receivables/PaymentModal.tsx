'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { paymentSchema, PaymentFormData } from '@/schemas/payment.schema'
import { PaymentMethod, Receivable } from '@/types'
import { usePayReceivable } from '@/hooks/useReceivables'
import { formatBRL } from '@/utils/format'

interface PaymentModalProps {
  receivable: Receivable | null
  open: boolean
  onClose: () => void
}

const paymentMethodOptions = Object.values(PaymentMethod).map((method) => ({
  value: method,
  label: method === 'BOLETO' ? 'Boleto'
    : method === 'PIX' ? 'PIX'
    : method === 'CARD' ? 'Cartão'
    : method === 'CASH' ? 'Dinheiro'
    : method === 'TRANSFER' ? 'Transferência'
    : method === 'CHECK' ? 'Cheque'
    : method === 'TERM' ? 'A Prazo'
    : 'Outro',
}))

export default function PaymentModal({ receivable, open, onClose }: PaymentModalProps) {
  const payMutation = usePayReceivable()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      valorPago: receivable?.valorReceber ?? 0,
      paymentMethod: PaymentMethod.PIX,
      dataPagamento: new Date().toISOString().split('T')[0],
      juros: 0,
      multa: 0,
      observacao: '',
    },
  })

  useEffect(() => {
    if (receivable) {
      reset({
        valorPago: receivable.valorReceber,
        paymentMethod: PaymentMethod.PIX,
        dataPagamento: new Date().toISOString().split('T')[0],
        juros: 0,
        multa: 0,
        observacao: '',
      })
    }
  }, [receivable, reset])

  const valorPago = watch('valorPago') || 0
  const juros = watch('juros') || 0
  const multa = watch('multa') || 0
  const total = useMemo(
    () => Number(valorPago) + Number(juros) + Number(multa),
    [valorPago, juros, multa]
  )

  const onSubmit = async (formData: PaymentFormData) => {
    if (!receivable) return
    await payMutation.mutateAsync({
      id: receivable.id,
      ...formData,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Receber Pagamento - Parcela ${receivable?.parcela || ''}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Valor a Pagar"
          type="number"
          step="0.01"
          mono
          error={errors.valorPago?.message}
          {...register('valorPago')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Juros"
            type="number"
            step="0.01"
            mono
            error={errors.juros?.message}
            {...register('juros')}
          />
          <Input
            label="Multa"
            type="number"
            step="0.01"
            mono
            error={errors.multa?.message}
            {...register('multa')}
          />
        </div>

        <div className="card p-3 flex items-center justify-between">
          <span className="text-sm text-text-muted">Total</span>
          <span className="text-lg font-bold font-mono text-text-primary">
            {formatBRL(total)}
          </span>
        </div>

        <Select
          label="Forma de Pagamento"
          options={paymentMethodOptions}
          placeholder="Selecione"
          error={errors.paymentMethod?.message}
          {...register('paymentMethod')}
        />

        <Input
          label="Data do Pagamento"
          type="date"
          error={errors.dataPagamento?.message}
          {...register('dataPagamento')}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-muted">
            Observação
          </label>
          <textarea
            className="input-field resize-none h-24"
            {...register('observacao')}
          />
          {errors.observacao && (
            <span className="text-xs text-danger">{errors.observacao.message}</span>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" loading={isSubmitting || payMutation.isPending}>
            Confirmar Pagamento
          </Button>
        </div>
      </form>
    </Modal>
  )
}
