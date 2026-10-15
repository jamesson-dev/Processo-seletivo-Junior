import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MinhasConsultas from '../src/components/organisms/MinhasConsultas/minhasConsultas'
import { entrarComo, simularApi } from './simular-api'

const consultaBase = {
  id: 'c1',
  profissionalId: 'p1',
  pacienteId: 'paciente-1',
  data: '2027-01-05',
  hora: '09:00',
  inicio: '2027-01-05T12:00:00.000Z',
  fim: '2027-01-05T12:30:00.000Z',
  tipo: 'retorno' as const,
  status: 'agendada' as const,
  criadaEm: '2026-10-14T10:00:00.000Z',
  canceladaEm: null,
  profissionalNome: 'Dra. Ana',
  especialidade: 'Clínica geral',
}

describe('MinhasConsultas', () => {
  it('exibe mensagem de carregando enquanto aguarda a resposta da API', () => {
    entrarComo('paciente')
    // Simula uma promise que nunca resolve — carregamento infinito
    simularApi(() => new Promise(() => {}))

    render(<MinhasConsultas />)

    expect(screen.getByText('Carregando suas consultas...')).toBeTruthy()
  })

  it('exibe mensagem de vazio quando paciente não tem consultas (B4)', async () => {
    entrarComo('paciente')
    simularApi(() => [])

    render(<MinhasConsultas />)

    await waitFor(() =>
      expect(screen.getByText('Você não tem consultas agendadas.')).toBeTruthy(),
    )
    expect(screen.queryByText('Carregando suas consultas...')).toBeNull()
  })

  it('lista as consultas quando a API retorna dados', async () => {
    entrarComo('paciente')
    simularApi(() => [consultaBase])

    render(<MinhasConsultas />)

    expect(await screen.findByText('Dra. Ana', { exact: false })).toBeTruthy()
    expect(screen.queryByText('Carregando suas consultas...')).toBeNull()
    expect(screen.queryByText('Você não tem consultas agendadas.')).toBeNull()
  })

  it('exibe mensagem de erro quando a API falha', async () => {
    entrarComo('paciente')
    simularApi(() => new Error('Erro de conexão'))

    render(<MinhasConsultas />)

    await waitFor(() => expect(screen.getByText('Erro de conexão')).toBeTruthy())
  })
})
