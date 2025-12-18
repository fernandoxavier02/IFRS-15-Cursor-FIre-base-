from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import DefaultDict, Dict, Iterable, List, Literal, Tuple


ACC_CASH = "1000 - Cash"
ACC_AR = "1200 - Accounts Receivable (AR)"
ACC_CONTRACT_ASSET = "1300 - Contract Asset"
ACC_CONTRACT_LIABILITY = "2600 - Contract Liability"
ACC_REVENUE = "4000 - Revenue"


EventKind = Literal["invoice", "cash", "revenue"]


@dataclass(frozen=True)
class Event:
    kind: EventKind
    date: datetime
    amount: float
    key: str = ""


@dataclass(frozen=True)
class JournalEntry:
    debit: str
    credit: str
    amount: float
    event_kind: EventKind
    event_key: str = ""


def _event_sort_key(event: Event) -> Tuple[int, int]:
    # Deterministic ordering when multiple events share the same timestamp.
    # Rationale:
    # - invoice typically precedes cash (cash settles AR)
    # - revenue recognition can occur independently; ordering doesn't change the net in this model
    kind_order: Dict[EventKind, int] = {"invoice": 0, "cash": 1, "revenue": 2}
    return (int(event.date.timestamp()), kind_order[event.kind])


def post_ifrs15_ledger_v2(events: Iterable[Event]) -> List[JournalEntry]:
    """
    Minimal IFRS 15 posting engine (spec) based on the Ledger v2 model:

    - Invoice: Dr AR; Cr Contract Asset up to existing CA; remainder Cr Contract Liability.
    - Cash: Dr Cash; Cr AR up to open AR; remainder Cr Contract Liability (advance payment).
    - Revenue: Dr Contract Liability up to existing CL; remainder Dr Contract Asset; Cr Revenue.
    """
    sorted_events = sorted(list(events), key=_event_sort_key)

    billed = 0.0
    cash = 0.0
    recognized = 0.0

    entries: List[JournalEntry] = []

    for event in sorted_events:
        amt = float(event.amount or 0)
        if amt <= 0:
            continue

        if event.kind == "invoice":
            contract_asset_before = max(0.0, recognized - billed)
            credit_to_ca = min(amt, contract_asset_before)
            credit_to_cl = amt - credit_to_ca

            if credit_to_ca > 0:
                entries.append(
                    JournalEntry(
                        debit=ACC_AR,
                        credit=ACC_CONTRACT_ASSET,
                        amount=round(credit_to_ca, 2),
                        event_kind=event.kind,
                        event_key=event.key,
                    )
                )
            if credit_to_cl > 0:
                entries.append(
                    JournalEntry(
                        debit=ACC_AR,
                        credit=ACC_CONTRACT_LIABILITY,
                        amount=round(credit_to_cl, 2),
                        event_kind=event.kind,
                        event_key=event.key,
                    )
                )

            billed = round(billed + amt, 2)
            continue

        if event.kind == "cash":
            ar_open = max(0.0, billed - cash)
            credit_to_ar = min(amt, ar_open)
            credit_to_cl = amt - credit_to_ar

            if credit_to_ar > 0:
                entries.append(
                    JournalEntry(
                        debit=ACC_CASH,
                        credit=ACC_AR,
                        amount=round(credit_to_ar, 2),
                        event_kind=event.kind,
                        event_key=event.key,
                    )
                )
            if credit_to_cl > 0:
                entries.append(
                    JournalEntry(
                        debit=ACC_CASH,
                        credit=ACC_CONTRACT_LIABILITY,
                        amount=round(credit_to_cl, 2),
                        event_kind=event.kind,
                        event_key=event.key,
                    )
                )

            cash = round(cash + amt, 2)
            continue

        if event.kind == "revenue":
            contract_liability_before = max(0.0, billed - recognized)
            debit_from_cl = min(amt, contract_liability_before)
            debit_to_ca = amt - debit_from_cl

            if debit_from_cl > 0:
                entries.append(
                    JournalEntry(
                        debit=ACC_CONTRACT_LIABILITY,
                        credit=ACC_REVENUE,
                        amount=round(debit_from_cl, 2),
                        event_kind=event.kind,
                        event_key=event.key,
                    )
                )
            if debit_to_ca > 0:
                entries.append(
                    JournalEntry(
                        debit=ACC_CONTRACT_ASSET,
                        credit=ACC_REVENUE,
                        amount=round(debit_to_ca, 2),
                        event_kind=event.kind,
                        event_key=event.key,
                    )
                )

            recognized = round(recognized + amt, 2)
            continue

        raise ValueError(f"Unsupported event kind: {event.kind}")

    return entries


def trial_balance(entries: Iterable[JournalEntry]) -> Dict[str, Dict[str, float]]:
    """
    Returns per-account debits/credits and net (debit-positive).
    """
    dr: DefaultDict[str, float] = defaultdict(float)
    cr: DefaultDict[str, float] = defaultdict(float)

    for entry in entries:
        amount = float(entry.amount or 0)
        if amount <= 0:
            continue
        dr[entry.debit] += amount
        cr[entry.credit] += amount

    accounts = sorted(set(list(dr.keys()) + list(cr.keys())))
    out: Dict[str, Dict[str, float]] = {}
    for acc in accounts:
        debit = round(dr[acc], 2)
        credit = round(cr[acc], 2)
        out[acc] = {
            "debit": debit,
            "credit": credit,
            "net": round(debit - credit, 2),
        }
    return out


def total_debits_credits(entries: Iterable[JournalEntry]) -> Dict[str, float]:
    total_dr = 0.0
    total_cr = 0.0
    for entry in entries:
        amount = float(entry.amount or 0)
        if amount <= 0:
            continue
        total_dr += amount
        total_cr += amount
    return {"debits": round(total_dr, 2), "credits": round(total_cr, 2)}

