'use client'

import PageWrapper from '@/components/layout/PageWrapper'
import CompanyForm from '@/components/settings/CompanyForm'
import Card from '@/components/ui/Card'
import { useSettings } from '@/hooks/useSettings'
import { useClearData } from '@/hooks/useAdmin'
import { useState, useRef } from 'react'
import api from '@/services/api'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [confirm, setConfirm] = useState(false)
  const clearMutation = useClearData()
  const { data: settings, refetch } = useSettings()
  const certInputRef = useRef<HTMLInputElement>(null)
  const [certPassword, setCertPassword] = useState('')
  const [certAmbiente, setCertAmbiente] = useState('homologacao')
  const [uploading, setUploading] = useState(false)

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!certPassword) {
      toast.error('Informe a senha do certificado')
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('password', certPassword)
      form.append('ambiente', certAmbiente)
      await api.post('/settings/certificate', form)
      toast.success('Certificado salvo com sucesso')
      refetch()
      setCertPassword('')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao salvar certificado'
      toast.error(msg)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveCert = async () => {
    try {
      await api.delete('/settings/certificate')
      toast.success('Certificado removido')
      refetch()
    } catch (err: any) {
      toast.error('Erro ao remover certificado')
    }
  }

  const hasCert = !!settings?.certificateB64

  return (
    <PageWrapper title="Configurações">
      <div className="space-y-6 max-w-3xl">
        <CompanyForm />

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Certificado A1 SEFAZ
          </h3>
          <p className="text-sm text-text-muted mb-4">
            Necessário para consultar NF-e na SEFAZ ao importar por PDF.
          </p>

          {hasCert && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-sm text-success font-medium">
                Certificado configurado ({settings?.sefazAmbiente === 'producao' ? 'Produção' : 'Homologação'})
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-text-muted mb-1">Senha do Certificado</label>
              <input
                type="password"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                className="input-field w-full"
                placeholder="Senha do arquivo .pfx"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Ambiente</label>
              <select
                value={certAmbiente}
                onChange={(e) => setCertAmbiente(e.target.value)}
                className="input-field w-full"
              >
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </div>
            <input
              ref={certInputRef}
              type="file"
              accept=".pfx,.p12"
              className="hidden"
              onChange={handleCertUpload}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => certInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary"
              >
                {uploading ? 'Enviando...' : hasCert ? 'Substituir Certificado' : 'Upload Certificado'}
              </button>
              {hasCert && (
                <button
                  onClick={handleRemoveCert}
                  className="px-4 py-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors text-sm"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-danger/30">
          <h3 className="text-lg font-semibold text-danger mb-2">Área de Perigo</h3>
          <p className="text-sm text-text-muted mb-4">
            Remove todos os dados do sistema (clientes, notas e recebíveis). Esta ação não pode ser desfeita.
          </p>
          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="px-4 py-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors text-sm font-medium"
            >
              Limpar todos os dados
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  clearMutation.mutate()
                  setConfirm(false)
                }}
                disabled={clearMutation.isPending}
                className="px-4 py-2 rounded-lg bg-danger text-white hover:bg-danger/90 transition-colors text-sm font-medium"
              >
                {clearMutation.isPending ? 'Limpando...' : 'Sim, limpar tudo'}
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="px-4 py-2 rounded-lg bg-dark-border text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
