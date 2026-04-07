import { redirect } from 'next/navigation'

/** Antigua URL del dashboard MDA: ahora vive dentro de Reportes. */
export default function AnalyticsMdaRedirect() {
  redirect('/reports#mda')
}
