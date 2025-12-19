# Quando a Conta 2600 (Contract Liability) Deve Aparecer?

## Resposta Direta

A conta **2600 - Contract Liability** DEVE aparecer quando há **billing ou payment ANTES da revenue recognition**. Isso é **CORRETO** segundo IFRS 15.

## Quando a Conta 2600 DEVE Aparecer (Correto)

### Cenário 1: Billing Antes de Revenue Recognition

**Situação:**
- Contrato faturado em jan/2025: R$1.000
- Revenue recognition só acontece mensalmente (over-time)
- Em jan/2025: Billing criado, mas revenue ainda não reconhecida

**Lançamento correto (Ledger V2):**
```
Dr 1200 AR R$1.000
Cr 2600 Contract Liability R$1.000
```

**Por quê?** O cliente foi faturado antes da performance ser realizada. Isso cria uma obrigação (Contract Liability).

### Cenário 2: Payment Antes de Billing

**Situação:**
- Cliente paga R$1.000 em jan/2025
- Billing ainda não foi criado
- Revenue ainda não reconhecida

**Lançamento correto (Ledger V2):**
```
Dr 1000 Cash R$1.000
Cr 2600 Contract Liability R$1.000
```

**Por quê?** O cliente pagou antes de ser faturado e antes da performance. Isso cria uma obrigação (Contract Liability).

### Cenário 3: Revenue Recognition Reduz Contract Liability

**Situação:**
- Há Contract Liability de R$1.000 (de billing anterior)
- Revenue recognition de R$500 acontece em fev/2025

**Lançamento correto (Ledger V2):**
```
Dr 2600 Contract Liability R$500
Cr 4000 Revenue R$500
```

**Por quê?** A performance realizada reduz a obrigação (Contract Liability) e reconhece receita.

## Quando a Conta 2600 NÃO Deve Aparecer

### ❌ Cenário Incorreto: Contrato Criado Sem Billing/Payment

**Situação:**
- Contrato criado em jan/2025
- Nenhum billing criado ainda
- Nenhum payment recebido ainda

**Lançamento INCORRETO (não deve criar):**
```
Dr ??? 
Cr 2600 Contract Liability R$12.000  ❌ ERRADO!
```

**Por quê?** Segundo IFRS 15, Contract Liability só surge quando há **consideração recebida ou faturada**. Apenas existir um contrato não cria Contract Liability.

## Lógica do Ledger V2

### 1. Invoice Event (Billing)

```typescript
// Linha 300-351 do ledger-v2.ts
if (event.kind === "invoice") {
  const contractAssetBefore = Math.max(0, recognizedToDate - billedToDate);
  const creditToCA = Math.min(event.amount, contractAssetBefore);
  const creditToCL = event.amount - creditToCA;  // Restante vai para CL
  
  if (creditToCL > 0) {
    // Cria: Dr AR / Cr Contract Liability
    // Isso é CORRETO quando há billing antes de revenue recognition
  }
}
```

**Quando cria Contract Liability:**
- Quando `creditToCL > 0`
- Isso acontece quando: `InvoiceAmount > ContractAsset_before`
- Ou seja: quando o billing é maior que a receita já reconhecida

### 2. Cash Event (Payment)

```typescript
// Linha 357-407 do ledger-v2.ts
if (event.kind === "cash") {
  const arOpen = Math.max(0, billedToDate - cashToDate);
  const creditToAR = Math.min(event.amount, arOpen);
  const creditToCL = event.amount - creditToAR;  // Excesso vai para CL
  
  if (creditToCL > 0) {
    // Cria: Dr Cash / Cr Contract Liability
    // Isso é CORRETO quando há payment antes de billing
  }
}
```

**Quando cria Contract Liability:**
- Quando `creditToCL > 0`
- Isso acontece quando: `PaymentAmount > AR_open`
- Ou seja: quando o pagamento é maior que o AR em aberto (pagamento antecipado)

### 3. Revenue Recognition Event

```typescript
// Linha 413-465 do ledger-v2.ts
if (event.kind === "revenue") {
  const contractLiabilityBefore = Math.max(0, billedToDate - recognizedToDate);
  const debitFromCL = Math.min(event.amount, contractLiabilityBefore);
  
  if (debitFromCL > 0) {
    // Cria: Dr Contract Liability / Cr Revenue
    // Isso REDUZ o Contract Liability quando há revenue recognition
  }
}
```

**Quando reduz Contract Liability:**
- Quando `debitFromCL > 0`
- Isso acontece quando há Contract Liability existente e revenue é reconhecida
- Reduz o passivo e reconhece receita

## Exemplo Prático: Contrato de 12 Meses

**Contrato:** R$12.000, jan/2025 a dez/2025

### Mês 1 (Jan/2025):
- **Billing criado:** R$1.000
- **Revenue reconhecida:** R$0 (ainda não começou)
- **Lançamento:**
  ```
  Dr AR R$1.000
  Cr Contract Liability R$1.000  ✅ CORRETO
  ```
- **Contract Liability:** R$1.000 ✅

### Mês 2 (Fev/2025):
- **Billing criado:** R$1.000
- **Revenue reconhecida:** R$1.000 (1 mês de 12)
- **Lançamentos:**
  ```
  Dr AR R$1.000
  Cr Contract Liability R$1.000  ✅ (novo billing)
  
  Dr Contract Liability R$1.000
  Cr Revenue R$1.000  ✅ (revenue recognition reduz CL)
  ```
- **Contract Liability:** R$1.000 ✅ (mantém-se porque novo billing = nova revenue)

### Mês 12 (Dez/2025):
- **Billing criado:** R$1.000
- **Revenue reconhecida:** R$1.000 (último mês)
- **Lançamentos:**
  ```
  Dr AR R$1.000
  Cr Contract Liability R$1.000  ✅ (novo billing)
  
  Dr Contract Liability R$1.000
  Cr Revenue R$1.000  ✅ (revenue recognition reduz CL)
  ```
- **Contract Liability:** R$1.000 ✅ (se billing de dez ainda não foi pago)

## Por Que a Conta 2600 Ainda Aparece?

A conta 2600 **DEVE aparecer** quando:

1. ✅ Há billing criado antes da revenue recognition
2. ✅ Há payment recebido antes do billing
3. ✅ Há billing/payment que ainda não foi "consumido" por revenue recognition

**Isso é CORRETO e esperado!**

A conta 2600 só **NÃO deve aparecer** quando:
- ❌ Não há billing nem payment
- ❌ Toda a revenue já foi reconhecida e todo o billing já foi pago

## Verificação

Para verificar se a conta 2600 está aparecendo corretamente:

1. **Verifique se há billings criados:**
   - Se há billing com status "invoiced" → Contract Liability DEVE aparecer

2. **Verifique se há payments recebidos:**
   - Se há payment antes de billing → Contract Liability DEVE aparecer

3. **Verifique se revenue foi reconhecida:**
   - Se revenue reconhecida < billing total → Contract Liability DEVE aparecer
   - Se revenue reconhecida = billing total → Contract Liability deve ser 0

## Fórmula de Verificação

```
Contract Liability = max(0, Total Billed - Total Revenue Recognized)
```

Se `Total Billed > Total Revenue Recognized` → Contract Liability DEVE aparecer ✅

Se `Total Billed <= Total Revenue Recognized` → Contract Liability deve ser 0

## Conclusão

A conta 2600 (Contract Liability) **DEVE aparecer** quando há billing ou payment antes da revenue recognition. Isso é **correto** segundo IFRS 15.

Se você está vendo a conta 2600 aparecer, verifique:
1. Há billings criados?
2. Há payments recebidos?
3. A revenue já foi toda reconhecida?

Se a resposta para 1 ou 2 for "sim" e para 3 for "não", então a conta 2600 **deve aparecer** e está correto! ✅
