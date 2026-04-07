'use client'
import AppLayout from '@/components/layout/AppLayout'
import MdaCsvDashboard from '@/components/reports/MdaCsvDashboard'

export default function ReportsPage() {
  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="mb-6">
          <h1 className="page-title">Reportes MDA</h1>
          <p className="text-slate-500 text-sm mt-1">Carga el CSV de Jira, configura el informe y guárdalo para compartir con clientes</p>
        </div>

        <MdaCsvDashboard />
      </div>
    </AppLayout>
  )
}
