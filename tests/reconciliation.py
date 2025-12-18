from collections import defaultdict
from typing import Dict, Iterable, List, Literal, TypedDict

AccountNature = Literal["debit", "credit"]


class LedgerEntry(TypedDict):
    entry_type: str
    amount: float


# Natural side for each IFRS 15 ledger entry type
ACCOUNT_NATURE: Dict[str, AccountNature] = {
    "revenue": "credit",
    "deferred_revenue": "credit",
    "contract_liability": "credit",
    "financing_income": "credit",
    "receivable": "debit",
    "contract_asset": "debit",
    "cash": "debit",
    "commission_expense": "debit",
}


def compute_reconciliation(
    entries: Iterable[LedgerEntry],
    opening_balances: Dict[str, float] | None = None,
    default_nature: AccountNature = "debit",
) -> Dict[str, Dict[str, float]]:
    """
    Aggregate debits/credits and compute closing balance per account.

    - Assets/expenses (nature=debit): closing = opening + debits - credits
    - Liabilities/revenue (nature=credit): closing = opening - debits + credits
    """
    opening = defaultdict(float, opening_balances or {})
    debits = defaultdict(float)
    credits = defaultdict(float)

    for entry in entries:
        account = entry["entry_type"]
        amount = float(entry.get("amount", 0) or 0)
        nature = ACCOUNT_NATURE.get(account, default_nature)
        if nature == "debit":
            debits[account] += amount
        else:
            credits[account] += amount

    results: Dict[str, Dict[str, float]] = {}
    accounts: List[str] = list(
        set(list(opening.keys()) + list(debits.keys()) + list(credits.keys()))
    )

    for account in accounts:
        nature = ACCOUNT_NATURE.get(account, default_nature)
        opn = float(opening[account])
        dr = float(debits[account])
        cr = float(credits[account])
        if nature == "debit":
            closing = opn + dr - cr
        else:
            closing = opn - dr + cr
        results[account] = {
            "opening": round(opn, 2),
            "debit": round(dr, 2),
            "credit": round(cr, 2),
            "closing": round(closing, 2),
        }

    return results
