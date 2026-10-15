import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { criarConsulta, criarUsuario, proximaSegunda, somarDias } from './ajuda'

describe('consultas', () => {
  describe('POST /consultas/:id/cancelar', () => {
    it('paciente cancela a própria consulta com sucesso', async () => {
      const paciente = await criarUsuario('paciente')
      const profissional = await criarUsuario('profissional')
      const data = proximaSegunda()
      const consulta = await criarConsulta({ profissionalId: profissional.id, pacienteId: paciente.id, data, hora: '09:00' })

      const resposta = await request(app)
        .post(`/consultas/${consulta.id}/cancelar`)
        .set('Authorization', paciente.auth)

      expect(resposta.status).toBe(200)
      expect(resposta.body.status).toBe('cancelada')
    })

    it('paciente não pode cancelar consulta de outro paciente (B1)', async () => {
      const paciente1 = await criarUsuario('paciente')
      const paciente2 = await criarUsuario('paciente')
      const profissional = await criarUsuario('profissional')
      const data = proximaSegunda()
      const consultaDoPaciente1 = await criarConsulta({
        profissionalId: profissional.id,
        pacienteId: paciente1.id,
        data,
        hora: '10:00',
      })

      // paciente2 tenta cancelar a consulta de paciente1
      const resposta = await request(app)
        .post(`/consultas/${consultaDoPaciente1.id}/cancelar`)
        .set('Authorization', paciente2.auth)

      expect(resposta.status).toBe(403)
    })

    it('recepção pode cancelar consulta de qualquer paciente', async () => {
      const paciente = await criarUsuario('paciente')
      const profissional = await criarUsuario('profissional')
      const recepcao = await criarUsuario('recepcao')
      const data = proximaSegunda()
      const consulta = await criarConsulta({ profissionalId: profissional.id, pacienteId: paciente.id, data, hora: '11:00' })

      const resposta = await request(app)
        .post(`/consultas/${consulta.id}/cancelar`)
        .set('Authorization', recepcao.auth)

      expect(resposta.status).toBe(200)
      expect(resposta.body.status).toBe('cancelada')
    })

    it('não cancela consulta já cancelada', async () => {
      const paciente = await criarUsuario('paciente')
      const profissional = await criarUsuario('profissional')
      const data = proximaSegunda()
      const consulta = await criarConsulta({
        profissionalId: profissional.id,
        pacienteId: paciente.id,
        data,
        hora: '13:00',
        status: 'cancelada',
      })

      const resposta = await request(app)
        .post(`/consultas/${consulta.id}/cancelar`)
        .set('Authorization', paciente.auth)

      expect(resposta.status).toBe(409)
    })
  })

  describe('POST /consultas — conflito de horários (B2)', () => {
    it('impede marcar retorno (30 min) sobreposto a uma primeira (60 min)', async () => {
      const paciente1 = await criarUsuario('paciente')
      const paciente2 = await criarUsuario('paciente')
      const profissional = await criarUsuario('profissional')
      const data = proximaSegunda()

      // Marca uma primeira consulta às 09:00 (ocupa 09:00–10:00)
      await criarConsulta({ profissionalId: profissional.id, pacienteId: paciente1.id, data, hora: '09:00', tipo: 'primeira' })

      // Tenta marcar um retorno às 09:30 (ocuparia 09:30–10:00 — sobreposto)
      const recepcao = await criarUsuario('recepcao')
      const resposta = await request(app)
        .post('/consultas')
        .set('Authorization', recepcao.auth)
        .send({ profissionalId: profissional.id, pacienteId: paciente2.id, data, hora: '09:30', tipo: 'retorno' })

      expect(resposta.status).toBe(409)
    })

    it('impede marcar retorno (30 min) com início idêntico a consulta existente', async () => {
      const paciente1 = await criarUsuario('paciente')
      const paciente2 = await criarUsuario('paciente')
      const profissional = await criarUsuario('profissional')
      const data = proximaSegunda()

      await criarConsulta({ profissionalId: profissional.id, pacienteId: paciente1.id, data, hora: '10:00', tipo: 'retorno' })

      const recepcao = await criarUsuario('recepcao')
      const resposta = await request(app)
        .post('/consultas')
        .set('Authorization', recepcao.auth)
        .send({ profissionalId: profissional.id, pacienteId: paciente2.id, data, hora: '10:00', tipo: 'retorno' })

      expect(resposta.status).toBe(409)
    })

    it('permite marcar retorno imediatamente após o fim de uma primeira (não sobreposição)', async () => {
      const paciente1 = await criarUsuario('paciente')
      const paciente2 = await criarUsuario('paciente')
      const profissional = await criarUsuario('profissional')
      const data = proximaSegunda()

      // Primeira às 08:00 termina às 09:00
      await criarConsulta({ profissionalId: profissional.id, pacienteId: paciente1.id, data, hora: '08:00', tipo: 'primeira' })

      // Retorno às 09:00 deve ser permitido (sem sobreposição)
      const recepcao = await criarUsuario('recepcao')
      const resposta = await request(app)
        .post('/consultas')
        .set('Authorization', recepcao.auth)
        .send({ profissionalId: profissional.id, pacienteId: paciente2.id, data, hora: '09:00', tipo: 'retorno' })

      expect(resposta.status).toBe(201)
    })

    it('horário cancelado fica disponível para nova marcação (B3)', async () => {
      const paciente1 = await criarUsuario('paciente')
      const paciente2 = await criarUsuario('paciente')
      const profissional = await criarUsuario('profissional')
      const data = somarDias(proximaSegunda(), 7)

      // Cria e cancela uma consulta às 14:00
      await criarConsulta({
        profissionalId: profissional.id,
        pacienteId: paciente1.id,
        data,
        hora: '14:00',
        tipo: 'retorno',
        status: 'cancelada',
      })

      // Tenta marcar no mesmo horário — deve ser permitido
      const recepcao = await criarUsuario('recepcao')
      const resposta = await request(app)
        .post('/consultas')
        .set('Authorization', recepcao.auth)
        .send({ profissionalId: profissional.id, pacienteId: paciente2.id, data, hora: '14:00', tipo: 'retorno' })

      expect(resposta.status).toBe(201)
    })
  })
})
