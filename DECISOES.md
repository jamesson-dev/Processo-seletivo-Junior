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

## B2 — temConflito não detectava sobreposição real de intervalos

**O que eu vi**

A função `temConflito` em `apps/api/src/agenda.ts` comparava apenas `marcada.hora === nova.hora`. Dois agendamentos com horas de início diferentes mas intervalos sobrepostos passavam sem conflito.

**O que achei que era**

Uma consulta `primeira` (60 min) marcada às 09:00 termina às 10:00. Um `retorno` (30 min) às 09:30 termina às 10:00. Os dois se sobrepõem, mas a função antiga não detectava o conflito porque 09:00 ≠ 09:30. Esse era o cenário relatado pela clínica: "o doutor ficou com dois pacientes no mesmo horário".

**Como confirmei**

Lendo o código de `apps/api/src/agenda.ts` e cruzando com as durações definidas em `packages/shared/src/index.ts` (`primeira: 60, retorno: 30`).

**O que fiz e por quê**

Substituí a comparação de igualdade por uma verificação de sobreposição de intervalos:

```ts
const novoInicio = paraMinutos(nova.hora)
const novoFim = novoInicio + DURACAO_MINUTOS[nova.tipo]
return marcadas.some((marcada) => {
  const marcadaInicio = paraMinutos(marcada.hora)
  const marcadaFim = marcadaInicio + DURACAO_MINUTOS[marcada.tipo]
  return novoInicio < marcadaFim && novoFim > marcadaInicio
})
```

A condição `A < B_fim && A_fim > B` é o teste padrão de sobreposição de intervalos: dois intervalos se sobrepõem quando um começa antes do outro terminar e termina depois do outro começar.

**Como testei**

Verificação de código. Casos cobertos pela lógica:
- 09:00 `primeira` (até 10:00) vs 09:30 `retorno` → conflito ✓
- 09:00 `primeira` (até 10:00) vs 10:00 `retorno` → sem conflito ✓
- 09:00 `retorno` (até 09:30) vs 09:30 `primeira` → sem conflito ✓
- 09:00 `retorno` vs 09:00 `primeira` → conflito ✓

**O que considerei e descartei**

Manter a comparação por hora de início e exigir que a grade fosse suficientemente espaçada para evitar o problema — descartado porque a regra de negócio tem duas durações diferentes (30 e 60 min) e a grade de 30 min não é suficiente para garantir isso.

**Quanto tempo levou**

~15 minutos

---

## B3 — Consultas canceladas bloqueavam horários disponíveis

**O que eu vi**

A rota `GET /profissionais/:id/horarios` em `apps/api/src/rotas/profissionais.ts` buscava todas as consultas do profissional na data informada sem filtrar por `status`. Consultas canceladas ou com status `faltou` entravam no cálculo de horários disponíveis e bloqueavam slots que deveriam estar livres.

**O que achei que era**

Filtro de status ausente na query do Prisma. O relato da clínica era exatamente este: "quando alguém cancela, ninguém mais consegue marcar naquele horário".

**Como confirmei**

Lendo `apps/api/src/rotas/profissionais.ts`: `prisma.consulta.findMany({ where: { profissionalId, data } })` — sem `status: 'agendada'`. O teste de B3 que escrevi (`horário cancelado fica disponível para nova marcação`) confirmou o comportamento: a rota `POST /consultas` já filtrava corretamente, mas a rota `GET /horarios` não filtrava, então o frontend mostrava o horário como indisponível mesmo após o cancelamento.

**O que fiz e por quê**

Adicionei `status: 'agendada'` ao filtro da query em `GET /profissionais/:id/horarios`. Assim apenas consultas ativas bloqueiam horários na grade.

**Como testei**

O teste `horário cancelado fica disponível para nova marcação` em `consultas.test.ts` já cobre esse cenário e passa.

**O que considerei e descartei**

Também considerei filtrar `status: { in: ['agendada'] }` para ser mais explícito, mas `status: 'agendada'` é equivalente e mais simples.

**Quanto tempo levou**

~10 minutos

---

## B4 — MinhasConsultas mostrava "Carregando..." para lista vazia

**O que eu vi**

Em `apps/web/src/components/organisms/MinhasConsultas/minhasConsultas.tsx`, a condição `if (consultas.length === 0)` retornava a mensagem "Carregando suas consultas..." tanto durante o carregamento quanto quando o paciente genuinamente não tinha consultas agendadas. Um paciente sem consultas ficava preso nessa mensagem para sempre.

**O que achei que era**

Falta de um estado de loading separado. O estado inicial de `consultas` é `[]`, igual ao estado após a resposta vazia da API.

**Como confirmei**

Lendo o código: `useState<Consulta[]>([])` começa vazio, e a condição `consultas.length === 0` não distingue "ainda carregando" de "carregou e está vazio".

**O que fiz e por quê**

Adicionei um estado `carregando` inicializado em `true`. O `useEffect` seta `carregando(true)` antes de chamar a API e usa `.finally()` para setar `carregando(false)` ao terminar (com sucesso ou erro). A mensagem "Carregando..." só aparece enquanto `carregando === true`. Quando termina e `consultas.length === 0`, exibe "Você não tem consultas agendadas."

**Como testei**

Verificação de código e inspeção visual no browser com um paciente sem consultas futuras.

**O que considerei e descartei**

Usar `null` como estado inicial ao invés de `[]` para distinguir "não carregou" de "vazio" — válido, mas o estado `carregando` explícito é mais legível e consistente com o padrão dos outros componentes do projeto.

**Quanto tempo levou**

~10 minutos

---

## B6 e B7 — AgendaDoDia com dependência faltando e data exibida errada

**O que eu vi**

Dois bugs no mesmo componente `apps/web/src/components/organisms/AgendaDoDia/agendaDoDia.tsx`:

1. O `useEffect` que busca a agenda usava `[data, atualizacao]` como dependências, mas também usava `profissionalId` na URL. Ao trocar de profissional na recepção, a agenda não recarregava.

2. O título da agenda usava `new Date(agenda.data)` diretamente sobre a string `'AAAA-MM-DD'`. Essa string é interpretada como UTC meia-noite, que em Recife (-03:00) vira o dia anterior — a agenda do dia 15 aparecia como "dia 14".

**O que achei que era**

B6: dependência esquecida no array do `useEffect` — o componente não observava mudança de `profissionalId`.

B7: a lib `formato.ts` já tinha a função `formatarData` correta, que monta o `Date` a partir das partes `[ano, mes, dia]` sem passar por UTC. O componente simplesmente não a usava.

**Como confirmei**

Lendo o código: array de deps incompleto e `new Date(agenda.data)` ao invés de `formatarData(agenda.data)`.

**O que fiz e por quê**

B6: adicionei `profissionalId` ao array de dependências do `useEffect`.

B7: substituí `new Date(agenda.data).toLocaleDateString(...)` por `formatarData(agenda.data)` que já estava disponível no projeto.

**Como testei**

Todos os testes existentes (9) continuam passando após as mudanças.

**O que considerei e descartei**

Nada relevante — a solução em ambos os casos era usar o que o projeto já tinha corretamente implementado.

**Quanto tempo levou**

~10 minutos

---

**O que eu vi**

O componente `MarcarConsulta` em `apps/web/src/components/organisms/MarcarConsulta/marcarConsulta.tsx` usava a constante `GRADE` do shared para listar todos os horários possíveis, sem consultar a API. Isso fazia a recepção ver horários já ocupados, de dias de folga ou no passado — o erro só aparecia após tentar marcar.

**O que achei que era**

O componente precisava chamar `GET /profissionais/:id/horarios?data=...&tipo=...` para buscar apenas os horários realmente disponíveis, assim como o componente `AgendarConsulta` da área do paciente já faz.

**Como confirmei**

Lendo o código: o `Select` de horário iterava diretamente sobre `GRADE` sem nenhuma chamada à API.

**O que fiz e por quê**

Substituí a `GRADE` estática por um estado `horarios` preenchido via `useEffect` que dispara sempre que `profissionalId`, `data` ou `tipo` mudam. Adicionei também:
- Estado `carregandoHorarios` para feedback visual
- Mensagem "Nenhum horário disponível" quando a lista retorna vazia (folga, dia não útil, etc.)
- Botão "Marcar" desabilitado enquanto carrega ou sem horários disponíveis
- `hora` começa vazia e é preenchida com o primeiro horário disponível ao carregar

**Como testei**

Verificação de código. Testes automatizados serão adicionados a seguir.

**O que considerei e descartei**

Manter a `GRADE` como fallback inicial e só atualizar após a resposta — descartado porque mostraria horários inválidos por um instante, que é exatamente o problema original.

**Quanto tempo levou**

~20 minutos

---

**Como montei o fluxo**

**Como testei**

**O que mudaria para usar em produção**

## Funcionalidade 1 — Busca de profissionais por especialidade

**O que eu vi**

O fluxo de agendamento listava todos os profissionais juntos, sem nenhuma forma de filtrar. Com 6 especialidades e tendência de crescimento, o paciente (e a recepção) precisavam percorrer a lista completa para encontrar quem queriam.

**O que achei que era**

Filtro simples: na API, aceitar `?especialidade=` como query param opcional. No frontend, um `Select` de especialidade antes do `Select` de profissional que restringe a lista.

**Como confirmei**

Lendo o código: `GET /profissionais` não tinha nenhum filtro. Os componentes `AgendarConsulta` e `RecepcaoPage` listavam todos os profissionais sem filtragem.

**O que fiz e por quê**

API (`apps/api/src/rotas/profissionais.ts`): adicionei `where: { especialidade: { equals: especialidade, mode: 'insensitive' } }` condicional — sem o param, retorna todos. O `mode: 'insensitive'` garante que `cardiologia` e `Cardiologia` retornam o mesmo resultado.

Frontend: optei por filtrar no **cliente** (client-side com `useMemo`) ao invés de fazer uma nova chamada à API a cada troca de especialidade. Os profissionais já estão carregados — recalcular a lista filtrada em memória é instantâneo e evita latência desnecessária.

Adicionei o seletor de especialidade em dois lugares:
- `AgendarConsulta` (área do paciente) — antes do select de profissional
- `RecepcaoPage` (área da recepção) — antes do select de profissional, com seleção automática do primeiro profissional do filtro

Ao trocar de especialidade, o profissional selecionado é resetado para evitar estado inconsistente.

**Como testei**

Testes na API cobrindo: filtro exato, sem filtro retorna todos, filtro sem resultado retorna `[]`, e case-insensitive. 16 testes passando.

**O que considerei e descartei**

Filtrar na API a cada troca — descartado por desnecessário dado o volume pequeno de profissionais já carregados no cliente.

Criar um endpoint dedicado `GET /especialidades` — descartado por over-engineering; as especialidades são derivadas da lista de profissionais que já existe.

**Quanto tempo levou**

~30 minutos

---

## Ordem das funcionalidades, com justificativa

1. **Busca de profissionais por especialidade** — baixo esforço, alto impacto no fluxo principal de agendamento. Sem isso, o paciente vê uma lista plana sem contexto.
2. **Histórico de consultas do paciente** — o endpoint já existe (`GET /consultas/minhas`), só precisava remover o filtro de data futura e criar a tela.
3. **Confirmação de presença pelo paciente** — resolve o problema de cancelamentos no mesmo dia sem criar política complexa.
4. **Remarcação pelo próprio paciente** — reduz carga na recepção e melhora a autonomia do paciente.
5. **Lista de espera** — depende de cancelamentos funcionando corretamente (B3 precisava estar corrigido antes).
6. **Lembrete automático** (bônus n8n) — endpoint de integração já existe, é implementação pura de fluxo.
7. **Bloqueio de agenda por período** — extensão natural das folgas já implementadas.
8. **Relatório de faltas** — útil para gestão, mas só faz sentido com dados acumulados ao longo do tempo.
9. **Exportação da agenda em PDF** — operacional, não core do negócio.
10. **Tema escuro** — cosmético, nenhum impacto funcional.

## Como usei IA

## O que ficou de fora
