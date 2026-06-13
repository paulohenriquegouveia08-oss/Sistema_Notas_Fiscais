import { z } from 'zod'

export const settingsSchema = z.object({
  razaoSocial: z.string().max(200).optional(),
  nomeFantasia: z.string().max(200).optional(),
  cnpj: z.string().max(18).optional(),
  ie: z.string().max(20).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  telefone: z.string().max(20).optional(),
  cep: z.string().max(10).optional(),
  logradouro: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(200).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  uf: z.string().max(2).optional(),
})

export type SettingsFormData = z.infer<typeof settingsSchema>
