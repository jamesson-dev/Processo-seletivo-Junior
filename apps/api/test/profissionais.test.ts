import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { criarUsuario } from './ajuda'

describe('profissionais', () => {
  it('lista os profissionais com nome e especialidade', async () => {
    const paciente = await criarUsuario('paciente')
    const profissional = await criarUsuario('profissional', 'Dra. Teste')

    const resposta = await request(app).get('/profissionais').set('Authorization', paciente.auth)

    expect(resposta.status).toBe(200)
    expect(resposta.body).toEqual([{ id: profissional.id, nome: 'Dra. Teste', especialidade: 'Clínica geral' }])
  })

  it('filtra profissionais por especialidade', async () => {
    const paciente = await criarUsuario('paciente')
    // criarUsuario cria sempre com especialidade 'Clínica geral'
    const clinico = await criarUsuario('profissional', 'Dr. Clínico')

    // Cria um profissional com especialidade diferente diretamente
    const { prisma } = await import('../src/prisma')
    const { gerarHashSenha, gerarToken } = await import('../src/auth')
    const { randomUUID } = await import('node:crypto')
    const senhaHash = gerarHashSenha('senha')
    const usuarioCardio = await prisma.usuario.create({
      data: { nome: 'Dr. Cardio', email: `${randomUUID()}@teste.com`, senhaHash, perfil: 'profissional' },
    })
    await prisma.profissional.create({ data: { id: usuarioCardio.id, especialidade: 'Cardiologia' } })

    const respostaFiltrada = await request(app)
      .get('/profissionais?especialidade=Cardiologia')
      .set('Authorization', paciente.auth)

    expect(respostaFiltrada.status).toBe(200)
    expect(respostaFiltrada.body).toHaveLength(1)
    expect(respostaFiltrada.body[0].especialidade).toBe('Cardiologia')
    expect(respostaFiltrada.body[0].nome).toBe('Dr. Cardio')

    // Sem filtro retorna todos
    const respostaTodos = await request(app).get('/profissionais').set('Authorization', paciente.auth)
    expect(respostaTodos.body.length).toBeGreaterThanOrEqual(2)

    // Filtro que não bate com nenhum retorna lista vazia
    const respostaVazia = await request(app)
      .get('/profissionais?especialidade=Dermatologia')
      .set('Authorization', paciente.auth)
    expect(respostaVazia.status).toBe(200)
    expect(respostaVazia.body).toHaveLength(0)

    // Filtro case-insensitive
    const respostaCaseInsensitive = await request(app)
      .get('/profissionais?especialidade=cardiologia')
      .set('Authorization', paciente.auth)
    expect(respostaCaseInsensitive.status).toBe(200)
    expect(respostaCaseInsensitive.body).toHaveLength(1)
  })
})
