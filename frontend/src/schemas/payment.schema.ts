import { z } from 'zod'
import { PaymentMethod } from '@/types'

export const paymentSchema = z.object({
  valorPago: z.coerce.number().positive('Valor deve ser positivo'),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Selecione uma forma de pagamento' }),
  }),
  dataPagamento: z.string().min(1, 'Data é obrigatória'),
  juros: z.coerce.number().min(0, 'Juros não pode ser negativo').optional(),
  multa: z.coerce.number().min(0, 'Multa não pode ser negativa').optional(),
  observacao: z
    .string()
    .max(500, 'Máximo de 500 caracteres')
    .optional()
    .or(z.literal('')),
})

export type PaymentFormData = z.infer<typeof paymentSchema>
