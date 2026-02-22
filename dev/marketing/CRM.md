# Ruwt Outreach CRM

Three CSV files you can open in Numbers/Excel and edit directly. Claude can also read and update them via code.

## Files

| File | What it tracks |
|------|---------------|
| `crm-prospects.csv` | Every prospect — from identified through subscribed or lost |
| `crm-outreach-log.csv` | Weekly outreach volume by channel |
| `crm-messages.csv` | Which openers and channels get the best reply rates |

## Prospect Status Values

`Identified` → `Contacted` → `Replied` → `Demo` → `Subscribed` or `Lost`

## Channel Values

`Email`, `LinkedIn DM`, `Slack DM`, `Twitter DM`, `Text`, `Discord`, `In-person`

## Targets

| Metric | Target |
|--------|--------|
| Prospects identified | 50+ |
| Contacted by month 2 | 50 |
| Reply rate | 15-20% |
| Demo rate (of replies) | 30-40% |
| Subscribe rate (of replies) | 10-15% |
| Monthly churn | <10% |
| MRR month 2 | $600-$1,000 |
| MRR month 6 | $5,000 |

## How to Use

- **You (Mac):** Double-click any CSV to open in Numbers. Edit, save, done.
- **Claude:** Reads/writes the CSVs directly. Ask "add a prospect" or "update status for [company]" and it'll edit the file.
- **After each outreach session:** Update `crm-prospects.csv` with new contacts and status changes, log the session in `crm-outreach-log.csv`.
