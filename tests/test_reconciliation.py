import pytest

from reconciliation import compute_reconciliation


def test_assets_and_liabilities_calculate_closing():
    entries = [
        {"entry_type": "receivable", "amount": 1000},
        {"entry_type": "cash", "amount": 500},
        {"entry_type": "contract_liability", "amount": 300},
        {"entry_type": "revenue", "amount": 700},
    ]
    opening = {
        "receivable": 200,
        "cash": 100,
        "contract_liability": 50,
        "revenue": 0,
    }

    result = compute_reconciliation(entries, opening)

    assert result["receivable"] == {"opening": 200, "debit": 1000, "credit": 0, "closing": 1200}
    assert result["cash"] == {"opening": 100, "debit": 500, "credit": 0, "closing": 600}
    # Liabilities/revenue are credit-nature: closing = opening - debit + credit
    assert result["contract_liability"] == {"opening": 50, "debit": 0, "credit": 300, "closing": 350}
    assert result["revenue"] == {"opening": 0, "debit": 0, "credit": 700, "closing": 700}


def test_defaults_to_zero_opening_and_debit_nature_for_unknown_accounts():
    entries = [
        {"entry_type": "unknown_account", "amount": 250},
    ]

    result = compute_reconciliation(entries, opening_balances=None)

    assert result["unknown_account"] == {"opening": 0.0, "debit": 250.0, "credit": 0.0, "closing": 250.0}


def test_handles_empty_entries():
    assert compute_reconciliation([]) == {}
