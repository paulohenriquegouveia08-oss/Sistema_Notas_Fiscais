'use client'

import { useState } from 'react'
import { Download, Loader2, FileText, FileSpreadsheet } from 'lucide-react'
import api from '@/services/api'
import type { ReportParams } from '@/types'

interface ExportButtonProps {
  params: ReportParams
}

export default function ExportButton({ params }: ExportButtonProps) {
  const [loadingCsv, setLoadingCsv] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)

  const handleExportCsv = async () => {
    try {
      setLoadingCsv(true)
      const response = await api.get('/reports/export/csv', {
        params,
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio_${params.startDate}_${params.endDate}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Erro ao exportar CSV:', error)
    } finally {
      setLoadingCsv(false)
    }
  }

  const handleExportPdf = async () => {
    try {
      setLoadingPdf(true)
      const response = await api.get('/reports/export/pdf', {
        params,
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio_${params.startDate}_${params.endDate}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Erro ao exportar PDF:', error)
    } finally {
      setLoadingPdf(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCsv}
        disabled={loadingCsv}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingCsv ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        CSV
      </button>
      <button
        onClick={handleExportPdf}
        disabled={loadingPdf}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingPdf ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        PDF
      </button>
    </div>
  )
}
