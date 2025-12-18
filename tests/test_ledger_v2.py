from __future__ import annotations

from datetime import datetime

from ledger_v2 import (
    ACC_AR,
    ACC_CASH,
    ACC_CONTRACT_ASSET,
    ACC_CONTRACT_LIABILITY,
    ACC_REVENUE,
    Event,
    post_ifrs15_ledger_v2,
    total_debits_credits,
    trial_balance,
)


def dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def test_double_entry_always_balances():
    entries = post_ifrs15_ledger_v2(
        [
            Event("invoice", dt("2025-01-01T10:00:00"), 100, key="inv-1"),
            Event("cash", dt("2025-01-10T10:00:00"), 40, key="pay-1"),
            Event("revenue", dt("2025-01-31T23:59:59"), 30, key="rev-jan"),
        ]
    )

    totals = total_debits_credits(entries)
    assert totals["debits"] == totals["credits"]


def test_invoice_before_revenue_creates_contract_liability_then_consumes_it():
    entries = post_ifrs15_ledger_v2(
        [
            Event("invoice", dt("2025-01-01T00:00:00"), 100, key="inv-1"),
            Event("revenue", dt("2025-01-31T00:00:00"), 30, key="rev-jan"),
        ]
    )
    tb = trial_balance(entries)

    # AR debited 100
    assert tb[ACC_AR] == {"debit": 100.0, "credit": 0.0, "net": 100.0}
    # Revenue credited 30
    assert tb[ACC_REVENUE] == {"debit": 0.0, "credit": 30.0, "net": -30.0}
    # Contract liability: +100 (invoice) -30 (revenue recognition debit) = credit 70
    assert tb[ACC_CONTRACT_LIABILITY] == {"debit": 30.0, "credit": 100.0, "net": -70.0}


def test_revenue_before_invoice_creates_contract_asset_then_reclasses_to_ar():
    entries = post_ifrs15_ledger_v2(
        [
            Event("revenue", dt("2025-01-15T00:00:00"), 30, key="rev-1"),
            Event("invoice", dt("2025-01-20T00:00:00"), 30, key="inv-1"),
            Event("cash", dt("2025-01-25T00:00:00"), 30, key="pay-1"),
        ]
    )
    tb = trial_balance(entries)

    # Revenue recognized
    assert tb[ACC_REVENUE]["credit"] == 30.0
    # Contract asset is created by revenue (debit) and cleared by invoice (credit)
    assert tb[ACC_CONTRACT_ASSET] == {"debit": 30.0, "credit": 30.0, "net": 0.0}
    # AR is created by invoice (debit) and cleared by cash (credit)
    assert tb[ACC_AR] == {"debit": 30.0, "credit": 30.0, "net": 0.0}
    assert tb[ACC_CASH] == {"debit": 30.0, "credit": 0.0, "net": 30.0}


def test_revenue_split_when_exceeds_contract_liability():
    entries = post_ifrs15_ledger_v2(
        [
            Event("invoice", dt("2025-01-01T00:00:00"), 100, key="inv-1"),
            Event("revenue", dt("2025-02-01T00:00:00"), 120, key="rev-1"),
        ]
    )
    tb = trial_balance(entries)

    # Contract liability fully consumed (debit 100), remaining revenue creates contract asset (debit 20)
    assert tb[ACC_CONTRACT_LIABILITY]["debit"] == 100.0
    assert tb[ACC_CONTRACT_ASSET]["debit"] == 20.0
    assert tb[ACC_REVENUE]["credit"] == 120.0


def test_invoice_split_when_contract_asset_exists():
    entries = post_ifrs15_ledger_v2(
        [
            Event("revenue", dt("2025-01-10T00:00:00"), 80, key="rev-1"),
            Event("invoice", dt("2025-01-20T00:00:00"), 100, key="inv-1"),
        ]
    )
    tb = trial_balance(entries)

    # Invoice should clear existing contract asset (80) and create contract liability for the remainder (20)
    assert tb[ACC_CONTRACT_ASSET] == {"debit": 80.0, "credit": 80.0, "net": 0.0}
    assert tb[ACC_CONTRACT_LIABILITY] == {"debit": 0.0, "credit": 20.0, "net": -20.0}
    assert tb[ACC_AR] == {"debit": 100.0, "credit": 0.0, "net": 100.0}


def test_advance_payment_before_invoice_posts_to_contract_liability():
    entries = post_ifrs15_ledger_v2(
        [
            Event("cash", dt("2025-01-01T00:00:00"), 50, key="pay-adv"),
            Event("invoice", dt("2025-01-05T00:00:00"), 100, key="inv-1"),
            Event("revenue", dt("2025-01-31T00:00:00"), 30, key="rev-jan"),
        ]
    )
    tb = trial_balance(entries)

    # Advance cash (50) increases contract liability credit-side (since no AR existed)
    # Invoice adds another 100 credit to CL; revenue consumes 30 debit. Net CL credit = 120.
    assert tb[ACC_CONTRACT_LIABILITY] == {"debit": 30.0, "credit": 150.0, "net": -120.0}
    assert tb[ACC_CASH]["debit"] == 50.0
    assert tb[ACC_AR]["debit"] == 100.0
    assert tb[ACC_REVENUE]["credit"] == 30.0

