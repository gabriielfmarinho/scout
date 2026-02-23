# Round Table Prompt

Use this template to run a senior technical debate and end with a practical recommendation.

## Variant A - Project-Aware Debate
```text
Com base no contexto técnico já disponível deste projeto (arquitetura, integrações, fluxos, riscos e documentação),
faça uma mesa redonda entre 3 papéis:

1) Arquiteto de Software Sênior
2) Especialista da tecnologia em análise
3) Engenheiro de Software Sênior focado em operação e entrega

Tema: "<opção A> vs <opção B>" para "<problema>"
Exemplo: "Kafka vs SQS para mensageria assíncrona do domínio de pagamentos".

Regras:
- Todos os argumentos devem se basear no contexto/evidências disponíveis.
- Cada papel deve expor: benefícios, riscos, custo operacional, impacto em time, impacto em evolução futura.
- Mostrar trade-offs reais, sem resposta genérica.
- Quando faltar evidência, declarar explicitamente a lacuna.
- Máximo de 2 rodadas de réplica entre os papéis.

Formato de saída:
1) Posição inicial de cada papel
2) Tabela de trade-offs (critério | opção A | opção B | observação)
3) Síntese final com recomendação objetiva
4) Condições que mudariam a decisão
5) Próximos passos práticos (curto prazo)
6) Bloco de persistência estruturada para contexto (obrigatório):
   - `summary` claro e específico (sem termos vagos como TODO/TBD)
   - `rationale` explicando por que a decisão foi tomada
   - `evidence` no formato `<arquivo>:<linha-inicio>-<linha-fim>: <trecho>`
   - `owner` responsável pela decisão
   - `confidence` (`high|medium|low`) e `status` (`draft|reviewed|approved|deprecated`)
```

## Variant B - Debate Without Project Context
```text
Quero uma mesa redonda técnica com 3 papéis:

1) Arquiteto de Software Sênior
2) Especialista da tecnologia em análise
3) Engenheiro de Software Sênior focado em operação e entrega

Tema: "<tecnologia/opções>" para "<objetivo>".
Exemplo: "Estou em dúvida sobre tecnologia de dados, me ajude a analisar trade-offs."

Regras:
- Não assumir contexto de projeto específico.
- Explicitar premissas antes de discutir.
- Cada papel deve analisar: complexidade, custo, lock-in, escalabilidade, observabilidade, curva de aprendizagem, risco.
- Máximo de 2 rodadas de contraponto.
- Ao final, recomendar por cenário (startup pequena, time médio, escala alta).

Formato de saída:
1) Premissas adotadas
2) Debate por papel
3) Matriz de trade-offs
4) Recomendação por cenário
5) Checklist para decisão final
6) Bloco de persistência estruturada para contexto (obrigatório):
   - `summary` claro e específico (sem termos vagos como TODO/TBD)
   - `rationale` explicando por que a decisão foi tomada
   - `evidence` no formato `<arquivo>:<linha-inicio>-<linha-fim>: <trecho>`
   - `owner` responsável pela decisão
   - `confidence` (`high|medium|low`) e `status` (`draft|reviewed|approved|deprecated`)
```
