# Contract Liability vs Deferred Revenue - Análise e Correção

## Resposta Direta

**SIM, Contract Liability é igual a Deferred Revenue (Receita Diferida).**

Segundo IFRS 15:
- **Contract Liability** = termo técnico do padrão IFRS 15
- **Deferred Revenue** = nome comum usado em muitos ERPs e sistemas contábeis
- **São o mesmo conceito**: Representam a obrigação de entregar bens/serviços quando já foi recebido pagamento/faturamento ANTES da performance

## Problema Identificado: Inconsistência de Contas

O sistema está usando **DUAS contas diferentes** para o mesmo conceito:

1. **Ledger V2** (`ledger-v2.ts`):
   - Usa: `"2600 - Contract Liability"` ✅ (padrão IFRS 15)

2. **Initial Ledger Entries** (`initial-ledger-entries.ts`):
   - Usa: `"2500 - Deferred Revenue"` ❌ (inconsistente!)

3. **Accounting Reconciliation** (`accounting-reconciliation.tsx`):
   - Linha 321: `clNet = netByCode("2600") + netByCode("2500")`
   - Está somando ambas porque sabe que são a mesma coisa, mas isso é uma **workaround**

## Documentação do Projeto

No arquivo `IFRS15_LEDGER_V2.md` linha 20:
> **2600 - Contract Liability** (também conhecido como "Deferred Revenue" em alguns ERPs)

Isso confirma que são a mesma coisa, mas o padrão do projeto é usar **2600 - Contract Liability**.

## Impacto da Inconsistência

1. **Confusão**: Duas contas para o mesmo conceito
2. **Relatórios**: Precisa somar ambas as contas para obter o valor correto
3. **Manutenção**: Mais difícil de entender e manter
4. **Conformidade**: Não segue um padrão único

## Correção Implementada

**Padronizado para usar apenas `"2600 - Contract Liability"`:**

1. ✅ **Corrigido `initial-ledger-entries.ts`:**
   - Mudado de `"2500 - Deferred Revenue"` para `"2600 - Contract Liability"` (linha 138, 220)

2. ✅ **Corrigido `engine.ts`:**
   - Mudado de `"2500 - Deferred Revenue"` para `"2600 - Contract Liability"` (linha 996)

3. ⚠️ **`accounting-reconciliation.tsx`:**
   - Mantida soma de `netByCode("2500") + netByCode("2600")` para **compatibilidade com dados antigos**
   - Novos entries usarão apenas conta `2600`
   - Comentários adicionados explicando a compatibilidade

## Nota sobre Compatibilidade

Como já existem entries no banco de dados usando conta `2500`, o frontend mantém a soma de ambas as contas temporariamente. Isso garante que:
- Dados antigos continuam sendo exibidos corretamente
- Novos entries usarão apenas conta `2600`
- Gradualmente, todos os entries migrarão para `2600`

## Conformidade IFRS 15

✅ **Correto:** Usar apenas "2600 - Contract Liability" (termo técnico do padrão)
⚠️ **Aceitável:** Usar "Deferred Revenue" como nome alternativo em UI/documentação
❌ **Incorreto:** Usar contas diferentes no razão contábil

## Recomendação

**Padronizar para `"2600 - Contract Liability"` em todo o código**, mantendo "Deferred Revenue" apenas como:
- Nome de exibição na UI (se necessário)
- Descrição/explicação em documentação
- Mas sempre usando conta `2600` no razão contábil
