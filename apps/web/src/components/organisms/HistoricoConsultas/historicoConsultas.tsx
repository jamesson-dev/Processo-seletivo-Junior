'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Consulta } from '@bemviver/shared'
import Alert from '@/components/atoms/Alert/alert'
import CartaoConsulta from '@/components/molecules/CartaoConsulta/cartaoConsulta'
import { api } from '@/lib/api'

export default function HistoricoConsultas() {
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    setCarregando(true)
    api<Consulta[]>('/consultas/historico')
      .then(setConsultas)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) return <p className="text-gray-500">Carregando histórico...</p>

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Histórico de consultas</h1>
        <Link href="/paciente" className="text-sm text-teal-700 underline">
          Voltar
        </Link>
      </div>

      {erro && <Alert>{erro}</Alert>}

      {consultas.length === 0 ? (
        <p className="text-gray-500">Nenhuma consulta anterior encontrada.</p>
      ) : (
        <ul className="space-y-3">
          {consultas.map((consulta) => (
            <li key={consulta.id}>
              {/* Histórico é somente leitura — sem ação de cancelamento */}
              <CartaoConsulta consulta={consulta} onCancelar={() => {}} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
