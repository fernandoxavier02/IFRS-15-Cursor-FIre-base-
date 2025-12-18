# IFRS 15 — Modelo Contábil (Ledger v2)

Este documento descreve o **modelo mínimo correto** (MVP) de lançamentos contábeis para IFRS 15 utilizado pelo projeto, focado em:

- **Faturamento (Invoice / direito incondicional a receber)** → reconhecimento de **AR** e **posição contratual**.
- **Recebimento (Cash)** → baixa de **AR**.
- **Reconhecimento de Receita** (por PO, por período) → impacto em **Receita** e na **posição contratual** (**Contract Liability** ou **Contract Asset**).
- **Reclassificação Contract Asset → AR** quando o contrato é faturado após a receita já reconhecida.

> Nota importante: **“Receita diferida” como passivo (Contract Liability) não nasce “só porque existe contrato”**. Ela surge quando há **consideração recebida** ou **faturada** (direito incondicional) **antes** da satisfação de obrigações de performance.  
> O que independe de faturamento é a métrica de **obrigações de performance remanescentes (RPO/backlog)**, que é **relatório gerencial** e **não** lançamento no razão.

---

## 1) Contas contábeis usadas (padrão)

- **1000 - Cash**
- **1200 - Accounts Receivable (AR)**
- **1300 - Contract Asset**
- **2600 - Contract Liability** (também conhecido como “Deferred Revenue” em alguns ERPs)
- **4000 - Revenue**
- **1500 - Contract Costs Asset** (quando aplicável)
- **5000 - Cost of Revenue / Amortization** (quando aplicável)

---

## 2) Eventos e lançamentos (double-entry)

### 2.1 Faturamento (invoice emitida)

O faturamento cria o **direito incondicional a receber**:

- **Dr 1200 AR** (valor total da fatura)
- **Cr 1300 Contract Asset** *(somente até o limite do Contract Asset existente; reclassificação)*
- **Cr 2600 Contract Liability** *(o restante; faturamento em excesso à receita já reconhecida)*

Formalmente, no instante do faturamento:

- `ContractAsset_before = max(0, RecognizedToDate - BilledToDate_before)`
- `Cr_ContractAsset = min(InvoiceAmount, ContractAsset_before)`
- `Cr_ContractLiability = InvoiceAmount - Cr_ContractAsset`

Isso garante que **não existirá simultaneamente** Contract Asset “antigo” e AR para o mesmo direito.

---

### 2.2 Recebimento (cash)

O recebimento **baixa AR**:

- **Dr 1000 Cash**
- **Cr 1200 AR**

Se houver recebimento **antes do faturamento** (adiantamento), o correto é:

- **Dr 1000 Cash**
- **Cr 2600 Contract Liability**

No MVP, o motor trata isso como “split”: o que couber em AR aberto baixa AR; o excedente vai para Contract Liability.

---

### 2.3 Reconhecimento de Receita (por satisfação de PO)

Quando a entidade satisfaz (ou satisfaz ao longo do tempo) a obrigação, reconhece receita.

O débito **não é AR** (a menos que seja um lançamento combinado em um ERP; aqui o modelo separa eventos). O débito deve refletir a **posição contratual** no momento do reconhecimento:

- Se existe **Contract Liability** (cliente já pagou/foi faturado):  
  **Dr 2600 Contract Liability / Cr 4000 Revenue**
- Se não existe passivo (receita antes de faturar):  
  **Dr 1300 Contract Asset / Cr 4000 Revenue**

Se o reconhecimento do período “atravessar” o saldo de Contract Liability, faz-se split:

- `ContractLiability_before = max(0, BilledToDate - RecognizedToDate_before)`
- `Dr_ContractLiability = min(RecognizeAmount, ContractLiability_before)`
- `Dr_ContractAsset = RecognizeAmount - Dr_ContractLiability`

---

## 3) Regras de apuração (para cálculo e split)

O Ledger v2 funciona por uma linha do tempo (timeline) ordenando eventos por data:

1. **Invoices** (billed)  
2. **Cash** (received)  
3. **Revenue recognition** (recognized)

Mantém cumulativos:

- `BilledToDate` = soma de invoices processadas
- `CashToDate` = soma de recebimentos processados
- `RecognizedToDate` = soma de receitas reconhecidas processadas

Com isso:

- **AR (saldo)** = `BilledToDate - CashToDate`
- **Contract Liability (saldo)** = `max(0, BilledToDate - RecognizedToDate)`
- **Contract Asset (saldo)** = `max(0, RecognizedToDate - BilledToDate)`

---

## 4) Versionamento e idempotência

Para permitir recalcular e evitar duplicidade, cada lançamento v2 utiliza:

- `ledgerVersion = 2`
- `referenceNumber` determinístico (ex.: `V2-INV-CL-{billingId}`)

O gerador v2 **não cria** lançamentos já existentes com o mesmo `referenceNumber`.

---

## 5) O que fica fora do MVP (por enquanto)

- Alocação de invoice por PO com múltiplos elementos, descontos variáveis avançados, modificações contratuais com catch-up e alocação retrospectiva.
- Integração com contas a pagar/CPV completos para fulfillment costs.
- Contabilidade multi-moeda avançada (functionalAmount baseado em exchange rates por data).

