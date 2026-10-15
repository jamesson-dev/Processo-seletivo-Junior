import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MarcarConsulta from '../src/components/organisms/MarcarConsulta/marcarConsulta'
import { entrarComo, simularApi } from './simular-api'

const pacientes = [{ id: 'p1', nome: 'Maria Clara', email: 'maria@exemplo.com' }]
const horarios = ['09:00', '09:30', '10:00']

function simularRespostas(horariosRetornados: string[]) {
  simularApi((caminho) => {
    if (caminho.includes('/pacientes')) return pacientes
    if (caminho.includes('/horarios')) return { horarios: horariosRetornados }
    return {}
  })
}

describe('MarcarConsulta', () => {
  it('exibe carregando enquanto busca horários', () => {
    entrarComo('recepcao')
    simularApi(() => new Promise(() => {}))

    render(<MarcarConsulta profissionalId="prof-1" data="2027-01-05" onMarcada={() => {}} />)

    expect(screen.getByText('Carregando horários...')).toBeTruthy()
  })

  it('lista apenas os horários disponíveis retornados pela API (B5)', async () => {
    entrarComo('recepcao')
    simularRespostas(horarios)

    render(<MarcarConsulta profissionalId="prof-1" data="2027-01-05" onMarcada={() => {}} />)

    // Aguarda os horários aparecerem
    expect(await screen.findByText('09:00')).toBeTruthy()
    expect(screen.getByText('09:30')).toBeTruthy()
    expect(screen.getByText('10:00')).toBeTruthy()
    // Horários fora da lista não devem aparecer
    expect(screen.queryByText('08:00')).toBeNull()
    expect(screen.queryByText('17:30')).toBeNull()
  })

  it('exibe mensagem quando não há horários disponíveis', async () => {
    entrarComo('recepcao')
    simularRespostas([])

    render(<MarcarConsulta profissionalId="prof-1" data="2027-01-05" onMarcada={() => {}} />)

    expect(await screen.findByText('Nenhum horário disponível para este dia.')).toBeTruthy()
  })

  it('desabilita o botão quando não há horários disponíveis', async () => {
    entrarComo('recepcao')
    simularRespostas([])

    render(<MarcarConsulta profissionalId="prof-1" data="2027-01-05" onMarcada={() => {}} />)

    await screen.findByText('Nenhum horário disponível para este dia.')
    const botao = screen.getByRole('button', { name: 'Marcar' })
    expect((botao as HTMLButtonElement).disabled).toBe(true)
  })
})
