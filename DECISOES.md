# Decisões

Use uma seção para cada problema investigado ou decisão tomada, copiando o bloco abaixo quantas vezes precisar. Escreva do seu jeito, sem se preocupar com formalidade.

## B1 — Paciente conseguia cancelar consulta de outro paciente

**O que eu vi**

A rota `POST /consultas/:id/cancelar` busca a consulta pelo ID e cancela sem verificar se o paciente autenticado é o dono da consulta.

**O que achei que era**

Falha de autorização: o middleware `permitir('paciente', 'recepcao')` só verifica o perfil, não a propriedade do recurso. Qualquer paciente com um ID de consulta válido conseguia cancelar a consulta de outra pessoa.

**Como confirmei**

Lendo o código de `apps/api/src/rotas/consultas.ts`: após o `findUnique`, não há nenhuma comparação entre `consulta.pacienteId` e `req.usuario.id` antes de prosseguir com o cancelamento.

**O que fiz e por quê**

Adicionei a verificação logo após confirmar que a consulta existe:

```ts
if (req.usuario.perfil === 'paciente' && consulta.pacienteId !== req.usuario.id) {
  res.status(403).json({ erro: 'Você não tem permissão para cancelar esta consulta' })
  return
}
```

A verificação só se aplica ao perfil `paciente`. A recepção pode cancelar qualquer consulta — isso está dentro das regras de negócio descritas no README.

O 403 (Forbidden) é o código correto aqui: o recurso existe e foi encontrado, mas o usuário não tem permissão sobre ele. Usar 404 seria "security by obscurity", o que não se justifica nesse contexto.

**Como testei**

Verificação de código. O teste automatizado será adicionado junto com a cobertura de consultas.

**O que considerei e descartei**

Retornar 404 ao invés de 403 para não revelar que a consulta existe — descartei porque não há informação sensível sendo exposta e o 403 é semanticamente correto.

**Quanto tempo levou**

~10 minutos

---

## Título curto do problema ou da decisão

**O que eu vi**

**O que achei que era**

**Como confirmei**

**O que fiz e por quê**

**Como testei**

**O que considerei e descartei**

**Quanto tempo levou**

---

## Lembrete com n8n (bônus, se você fizer)

**Como montei o fluxo**

**Como testei**

**O que mudaria para usar em produção**

## Ordem das funcionalidades, com justificativa

## Como usei IA

## O que ficou de fora
