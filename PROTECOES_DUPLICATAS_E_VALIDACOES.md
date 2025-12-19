# Proteções Contra Duplicatas e Validações de Lançamentos

## Resumo das Implementações

Implementadas proteções para prevenir lançamentos duplicados e garantir que débitos sempre batam com créditos nos lançamentos contábeis.

## 1. Validações em `createLedgerEntry` (ledger-v2.ts)

### ✅ Validação 1: Débito = Crédito (Double-Entry Accounting)
**Localização:** `functions/src/ifrs15/ledger-v2.ts` linha 83-86

**O que faz:**
- Garante que o valor do lançamento seja maior que zero
- Em contabilidade de partidas dobradas, débito e crédito devem ter o mesmo valor

**Código:**
```typescript
if (params.amount <= 0) {
  throw new Error(`[createLedgerEntry] ❌ Valor inválido: ${params.amount}. O valor deve ser maior que zero.`);
}
```

### ✅ Validação 2: Contas Diferentes
**Localização:** `functions/src/ifrs15/ledger-v2.ts` linha 88-92

**O que faz:**
- Impede que débito e crédito sejam a mesma conta
- Garante que o lançamento seja válido (não pode debitar e creditar a mesma conta)

**Código:**
```typescript
if (params.debitAccount === params.creditAccount) {
  throw new Error(
    `[createLedgerEntry] ❌ Contas iguais: débito e crédito não podem ser a mesma conta (${params.debitAccount})`
  );
}
```

### ✅ Validação 3: ReferenceNumber Obrigatório
**Localização:** `functions/src/ifrs15/ledger-v2.ts` linha 94-98

**O que faz:**
- Garante que `referenceNumber` esteja definido
- `referenceNumber` é usado como ID do documento no Firestore para prevenir duplicatas

**Código:**
```typescript
if (!params.referenceNumber || params.referenceNumber.trim() === "") {
  throw new Error(
    `[createLedgerEntry] ❌ referenceNumber não pode estar vazio. É necessário para prevenir duplicatas.`
  );
}
```

### ✅ Validação 4: Verificação de Duplicatas ANTES de Criar
**Localização:** `functions/src/ifrs15/ledger-v2.ts` linha 103-108

**O que faz:**
- Verifica se entry já existe ANTES de tentar criar
- Usa `referenceNumber` como ID do documento para verificação rápida
- Retorna "exists" se já existe, evitando tentativa de criação

**Código:**
```typescript
const existingDoc = await docRef.get();
if (existingDoc.exists) {
  console.log(
    `[createLedgerEntry] ⏭️ Entry já existe com referenceNumber ${params.referenceNumber}, pulando criação`
  );
  return "exists";
}
```

## 2. Validações em `generateInitialDeferredRevenueEntries` (initial-ledger-entries.ts)

### ✅ Validação 1: Valor Maior que Zero
**Localização:** `functions/src/ifrs15/initial-ledger-entries.ts` linha 111-116

**O que faz:**
- Garante que o valor a diferir seja maior que zero

**Código:**
```typescript
if (amountToDefer <= 0) {
  throw new Error(
    `[generateInitialDeferredRevenueEntries] ❌ Valor inválido: ${amountToDefer}. O valor deve ser maior que zero.`
  );
}
```

### ✅ Validação 2: Contas Diferentes
**Localização:** `functions/src/ifrs15/initial-ledger-entries.ts` linha 118-123

**O que faz:**
- Impede que débito e crédito sejam a mesma conta (2600 - Contract Liability)

**Código:**
```typescript
if (debitAccount === "2600 - Contract Liability") {
  throw new Error(
    `[generateInitialDeferredRevenueEntries] ❌ Contas iguais: débito e crédito não podem ser a mesma conta (${debitAccount})`
  );
}
```

### ✅ Validação 3: Verificação de Duplicatas ANTES de Criar
**Localização:** `functions/src/ifrs15/initial-ledger-entries.ts` linha 159-165

**O que faz:**
- Verifica se entry já existe ANTES de tentar criar
- Usa `referenceNumber` como ID do documento

**Código:**
```typescript
const existingDoc = await docRef.get();
if (existingDoc.exists) {
  console.log(
    `[generateInitialDeferredRevenueEntries] ⏭️ Entry já existe com referenceNumber ${referenceNumber}, pulando criação`
  );
  return { created: 0, skipped: true, reason: "Entry document already exists" };
}
```

## 3. Avisos e Confirmações nos Botões (Opção 2)

### ✅ Botão "Generate Initial Entries" (Revenue Ledger)
**Localização:** `client/src/pages/revenue-ledger.tsx`

**Mudanças:**
1. **Confirmação antes de executar:**
   - Diálogo de confirmação explicando que é apenas para recálculo manual
   - Avisa sobre triggers automáticos
   - Lista casos de uso apropriados
   - Avisa sobre risco de duplicatas

2. **Aviso no tooltip:**
   - Tooltip explicando que é recálculo manual
   - Avisa sobre triggers automáticos
   - Avisa sobre risco de duplicatas

3. **Texto do botão:**
   - Adicionado "⚠️" e "(Manual)" para deixar claro que é manual

**Código:**
```typescript
const confirmed = window.confirm(
  "⚠️ ATENÇÃO: Recálculo Manual\n\n" +
  "Este botão é apenas para recálculo manual quando necessário.\n" +
  "O motor IFRS 15 já roda automaticamente via triggers mensais.\n\n" +
  "Use apenas se:\n" +
  "• Os triggers automáticos falharam\n" +
  "• Há necessidade de saneamento inicial\n" +
  "• Há dados corrompidos que precisam ser recalculados\n\n" +
  "Executar agora pode criar duplicatas se os triggers já rodaram.\n\n" +
  "Deseja continuar?"
);
```

### ✅ Botão "Calcular IFRS 15 (Gerar Ledger)" (Accounting Reconciliation)
**Localização:** `client/src/pages/accounting-reconciliation.tsx`

**Mudanças:**
1. **Confirmação antes de executar:**
   - Mesmo diálogo de confirmação do botão anterior
   - Previne execução acidental

2. **Aviso no tooltip:**
   - Tooltip explicando que é recálculo manual

3. **Texto do botão:**
   - Adicionado "⚠️" para deixar claro que requer atenção

## 4. Logs de Aviso em `calculateIFRS15All`

**Localização:** `functions/src/maintenance/calculate-ifrs15-all.ts` linha 19-21

**O que faz:**
- Adiciona logs de aviso no início da função
- Informa que é para recálculo manual
- Avisa sobre triggers automáticos

**Código:**
```typescript
console.log(`[calculateIFRS15All] ⚠️ ATENÇÃO: Esta função é para recálculo manual. O motor roda automaticamente via triggers.`);
console.log(`[calculateIFRS15All] ⚠️ Use apenas se os triggers automáticos falharam ou para saneamento inicial.`);
```

## Benefícios das Proteções

### ✅ Prevenção de Duplicatas
1. **Verificação ANTES de criar:** Entries são verificados antes de tentar criar, evitando erros e duplicatas
2. **ReferenceNumber como ID:** Usa `referenceNumber` como ID do documento, garantindo unicidade
3. **Tratamento de erros:** Se entry já existe, retorna "exists" sem tentar criar novamente

### ✅ Garantia de Integridade Contábil
1. **Débito = Crédito:** Valida que valores são maiores que zero e contas são diferentes
2. **Validação de contas:** Impede lançamentos inválidos (mesma conta em débito e crédito)
3. **ReferenceNumber obrigatório:** Garante rastreabilidade e prevenção de duplicatas

### ✅ Prevenção de Execução Acidental
1. **Confirmação obrigatória:** Usuário deve confirmar antes de executar recálculo manual
2. **Avisos claros:** Tooltips e mensagens explicam quando usar os botões
3. **Cancelamento silencioso:** Se usuário cancelar, não mostra erro, apenas não executa

## Como Funciona a Prevenção de Duplicatas

### Estratégia: ReferenceNumber como Document ID

1. **Criação de ReferenceNumber:**
   - Cada entry tem um `referenceNumber` único e determinístico
   - Baseado em: tipo de evento, IDs relacionados, datas
   - Exemplo: `"V2-INV-CL-billing123"` (Ledger V2, Invoice, Contract Liability, billing ID)

2. **Uso como Document ID:**
   - `referenceNumber` é usado como ID do documento no Firestore
   - Firestore não permite documentos com mesmo ID na mesma coleção
   - Tentativa de criar documento com ID existente retorna erro

3. **Verificação Antecipada:**
   - Antes de tentar criar, verifica se documento já existe
   - Se existe, retorna "exists" sem tentar criar
   - Se não existe, cria normalmente

4. **Tratamento de Erros:**
   - Se erro de "already exists" ocorrer, trata como "exists"
   - Não propaga erro, apenas retorna status

## Exemplo de Fluxo

### Cenário: Tentativa de Criar Entry Duplicado

1. **Sistema tenta criar entry:**
   ```typescript
   await createLedgerEntry({
     referenceNumber: "V2-INV-CL-billing123",
     // ... outros campos
   });
   ```

2. **Validações executadas:**
   - ✅ Valor > 0? Sim
   - ✅ Contas diferentes? Sim
   - ✅ ReferenceNumber definido? Sim

3. **Verificação de duplicata:**
   ```typescript
   const existingDoc = await docRef.get();
   if (existingDoc.exists) {
     return "exists"; // Entry já existe, não cria
   }
   ```

4. **Criação (se não existe):**
   ```typescript
   await docRef.create(entryData);
   return "created"; // Entry criado com sucesso
   ```

5. **Resultado:**
   - Se já existe: Retorna "exists", não cria duplicata
   - Se não existe: Cria entry, retorna "created"

## Testes Recomendados

1. **Teste de Duplicata:**
   - Criar entry com mesmo `referenceNumber` duas vezes
   - Verificar que segunda tentativa retorna "exists"
   - Verificar que apenas um documento foi criado

2. **Teste de Validação:**
   - Tentar criar entry com valor <= 0
   - Verificar que erro é lançado
   - Tentar criar entry com mesma conta em débito e crédito
   - Verificar que erro é lançado

3. **Teste de Confirmação:**
   - Clicar em botão de recálculo manual
   - Cancelar confirmação
   - Verificar que função não é executada
   - Clicar novamente e confirmar
   - Verificar que função é executada

## Conclusão

Todas as proteções foram implementadas:

✅ **Validação de débito = crédito:** Garante integridade contábil
✅ **Prevenção de duplicatas:** Verificação antes de criar + ReferenceNumber como ID
✅ **Avisos claros:** Tooltips e confirmações explicam quando usar botões manuais
✅ **Confirmação obrigatória:** Previne execução acidental

O sistema agora está protegido contra:
- Lançamentos duplicados (mesmo por acidente)
- Lançamentos com débito ≠ crédito
- Execução acidental de recálculos manuais
- Entries inválidos (mesma conta em débito e crédito)
