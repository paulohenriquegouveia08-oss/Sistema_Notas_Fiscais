'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { settingsSchema, SettingsFormData } from '@/schemas/settings.schema'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'

export default function CompanyForm() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  })

  useEffect(() => {
    if (settings) {
      reset({
        razaoSocial: settings.razaoSocial || '',
        cnpj: settings.cnpj || '',
      })
    }
  }, [settings, reset])

  const onSubmit = async (data: SettingsFormData) => {
    await updateMutation.mutateAsync(data)
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-dark-border rounded w-48" />
          <div className="h-10 bg-dark-border rounded" />
          <div className="h-10 bg-dark-border rounded" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Dados da Empresa
      </h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <Input
          label="Razão Social"
          error={errors.razaoSocial?.message}
          {...register('razaoSocial')}
        />
        <Input
          label="CNPJ"
          error={errors.cnpj?.message}
          {...register('cnpj')}
        />
        <Button
          type="submit"
          loading={updateMutation.isPending}
          disabled={!isDirty}
        >
          Salvar
        </Button>
      </form>
    </Card>
  )
}
