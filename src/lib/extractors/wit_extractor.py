"""
WIT Commission PDF Extractor

Extracts commission data from WIT commission PDFs for the Betsy & Melessa sections.
Handles full rows (with invoice date and order entry date) and continuation rows
(same invoice, different items).

European number format support (comma as decimal separator, space as thousands).
"""

import pdfplumber
import re
from typing import List, Dict


def parse_european_number(num_str: str) -> float:
    """
    Convert European format number to float.

    Examples:
        "1 596,80" -> 1596.80
        "731,00" -> 731.00
        "" -> 0.0

    Args:
        num_str: Number string in European format

    Returns:
        float: Parsed number
    """
    if not num_str or num_str.strip() == "":
        return 0.0
    # Remove spaces (thousands separator) and replace comma with dot
    cleaned = num_str.replace(" ", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def extract_wit_commissions(
    pdf_path: str,
    section_codes: List[str] = None
) -> List[Dict]:
    """
    Extract commission data from WIT PDF for Betsy & Melessa sections.

    Processes sections 5651 (AL) and 5652 (TN) by default. For each section:
    1. Finds customer headers (6-digit ID + name)
    2. Extracts full rows (contain two dates: invoice_date and order_entry_date)
    3. Extracts continuation rows (same invoice, different items)
    4. Skips zero-commission rows

    Args:
        pdf_path: Path to the WIT commission PDF
        section_codes: List of section codes to extract (default: ["5651", "5652"])

    Returns:
        List[Dict]: List of commission records with fields:
            - customer_name: str
            - po_number: str
            - invoice_number: str
            - invoice_date: str (YYYY-MM-DD)
            - order_number: str
            - item_code: str
            - description: str
            - net_amount: float
            - comm_rate: float (percentage)
            - comm_amount: float
    """
    if section_codes is None:
        section_codes = ["5651", "5652"]

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        # Extract text from all pages
        all_text = ""
        for page in pdf.pages:
            all_text += page.extract_text() + "\n"

    lines = all_text.split("\n")

    current_section = None
    current_section_code = None
    current_customer_name = None
    last_full_row_data = None

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        i += 1

        if not line.strip():
            continue

        # Skip page headers and column headers
        if any(x in line for x in ["US REPS COMMISSIONS PERIOD", "Project Customer P.O."]):
            continue

        # Detect section header: "XXXX BETSY & MELESSA (XX)"
        section_match = re.match(r"^(\d{4})\s+BETSY\s*&\s*MELESSA\s*\(([A-Z]{2})\)", line)
        if section_match:
            current_section_code = section_match.group(1)
            current_section = section_match.group(2)
            # Only process if in our target section codes
            if current_section_code not in section_codes:
                current_section_code = None
                current_section = None
            last_full_row_data = None
            continue

        # Skip if not in a target section
        if current_section is None:
            continue

        # Skip control lines
        if line.strip() in ["Sales rep", "Client"]:
            continue

        # Detect customer line: "6-digit-id CUSTOMER NAME"
        # Pattern: 6 digits (possibly -XX) followed by uppercase letter (start of name)
        # But exclude lines that have a date immediately after (those are data rows)
        customer_match = re.match(r"^(\d{6}(?:-[A-Z]+)?)\s+([A-Z].*)", line)
        if customer_match:
            potential_customer_part = customer_match.group(2)
            # If potential_customer_part starts with a date, this is NOT a customer line
            if not re.match(r"^\d{4}-\d{2}-\d{2}", potential_customer_part):
                current_customer_name = potential_customer_part
                last_full_row_data = None
                continue

        # Skip total/group lines and other non-data lines
        if any(x in line for x in ["Invoice total", "Customer total", "Group total", "5649 WIT", "5652 WIT"]):
            continue

        # Skip page footers
        if re.search(r"\d+:\d+:\d+\s+\d+ of \d+", line):
            continue

        # Extract trailing numbers (5 columns: list_price, net_amount, discount%, comm%, comm_amount)
        # Pattern matches from end of line: numbers with possible thousands separators (spaces)
        trailing_pattern = r"(\d+(?:\s\d{3})?,\d+)\s+(\d+(?:\s\d{3})?,\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s+(\d+,\d+)\s*$"
        trailing_match = re.search(trailing_pattern, line)

        if not trailing_match:
            continue

        # Parse the 5 trailing numbers
        net_amount = parse_european_number(trailing_match.group(2))
        comm_rate = parse_european_number(trailing_match.group(4))
        comm_amount = parse_european_number(trailing_match.group(5))

        # Skip zero-commission rows (but keep last_full_row_data for future continuation rows)
        if comm_amount == 0.0:
            continue

        # Remove trailing numbers to get the prefix (before the numbers)
        prefix = line[:trailing_match.start()].rstrip()

        # Determine if this is a full row or continuation row
        # Full row: contains 2 dates (invoice_date and order_entry_date)
        date_pattern = r"\d{4}-\d{2}-\d{2}"
        dates = re.findall(date_pattern, prefix)

        if len(dates) >= 2:
            # FULL ROW: PO#, invoice_date, invoice#, order#, order_entry_date, item_code, description
            tokens = prefix.split()

            po_number = tokens[0]
            invoice_date = dates[0]
            order_entry_date = dates[1]

            # Find positions of dates in the prefix
            date1_idx = prefix.find(invoice_date)
            date2_idx = prefix.find(order_entry_date)

            # Extract invoice# and order# (between the two dates)
            between = prefix[date1_idx + len(invoice_date):date2_idx].strip().split()
            invoice_number = between[0] if len(between) > 0 else ""
            order_number = between[1] if len(between) > 1 else ""

            # Extract item_code and description (after the second date)
            after_date2 = prefix[date2_idx + len(order_entry_date):].strip()
            after_tokens = after_date2.split()
            item_code = after_tokens[0] if len(after_tokens) > 0 else ""
            description = " ".join(after_tokens[1:]) if len(after_tokens) > 1 else ""

            # Store full row data for continuation rows
            last_full_row_data = {
                "customer_name": current_customer_name,
                "po_number": po_number,
                "invoice_number": invoice_number,
                "invoice_date": invoice_date,
                "order_number": order_number,
                "order_entry_date": order_entry_date,
                "item_code": item_code,
                "description": description,
            }
        else:
            # CONTINUATION ROW: item_code, description (inherits invoice info from last full row)
            if last_full_row_data is None:
                continue

            tokens = prefix.split()
            item_code = tokens[0] if len(tokens) > 0 else ""
            description = " ".join(tokens[1:]) if len(tokens) > 1 else ""

            # Update item code and description for this row
            last_full_row_data["item_code"] = item_code
            last_full_row_data["description"] = description

        # Create result row
        if last_full_row_data:
            result_row = {
                "customer_name": last_full_row_data["customer_name"],
                "po_number": last_full_row_data["po_number"],
                "invoice_number": last_full_row_data["invoice_number"],
                "invoice_date": last_full_row_data["invoice_date"],
                "order_number": last_full_row_data["order_number"],
                "item_code": last_full_row_data["item_code"],
                "description": last_full_row_data["description"],
                "net_amount": net_amount,
                "comm_rate": comm_rate,
                "comm_amount": comm_amount,
                "state": current_section,  # "AL" or "TN"
            }
            results.append(result_row)

    return results