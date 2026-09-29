# PocketSmart AI – Your Smart Budget & Recommendation Assistant

PocketSmart AI analyses a user's income and expenses, builds a monthly budget, flags overspending and unusual transactions, tracks savings goals, predicts future spending, scores financial health and gives personalised recommendations in plain English. Its chat assistant answers questions such as *"Where can I cut spending this month?"* and understands follow-ups such as *"How can I reduce it?"* or *"Why?"*.

Built with plain **HTML, CSS and JavaScript**. No frameworks, no build step and no internet connection are needed.

## How to run

Open `index.html` in Chrome, Edge or Firefox. On first launch the app loads demo data (₹30,000 monthly income, 6 months of expenses, 2 savings goals) so every feature is visible straight away. Use **Settings → Load demo data** to reset it or **Settings → Clear all data** to start fresh.

## Features

| Feature | Where |
|---|---|
| Monthly budget from income (default 50/30/20 split) | Monthly budget |
| Expenses auto-categorised from the description, with a confidence score | Transactions |
| Overspending alerts (over budget, near limit, likely to overspend) | Dashboard: Smart alerts |
| Unusual transaction detection | Dashboard: Smart alerts, AI assistant |
| AI monthly insight paragraph with Regenerate | Dashboard |
| Financial health score (0–100) | Dashboard, AI assistant |
| Savings goals with required monthly saving and on-track status | Savings goals |
| Personalised budget recommendations | Dashboard, AI assistant |
| Month-end projection and next-month forecast with confidence | Dashboard, AI assistant |
| Chat assistant with thinking steps, streamed answers, follow-up memory and suggested questions | AI assistant |

## About the AI (for the report and viva)

PocketSmart AI Engine is a **rule-based AI**. It does not call an external model such as Gemini or GPT.

- **Understanding questions:** the question is cleaned (common typos fixed, for example "expences" becomes "expense"), then matched to an intent: cut spending, overspending, forecast, goals, a category, budget, savings, affordability, health score, unusual transactions, recommendations, "why" or "how". The engine remembers the previous question's intent, category and amount, so short follow-ups like "what about food?" work.
- **Generating answers:** every answer is built from the user's own numbers. Each intent has 2–3 wordings chosen at random, so repeated questions don't sound identical.
- **Presentation:** before answering, the assistant shows the analysis steps it is running (with real counts), then streams the answer word by word.

## Formulas

All logic runs in the browser (`js/ai.js`, `js/budget.js`, `js/prediction.js`, `js/goals.js`, `js/health.js`, `js/categorize.js`).

- **Budget:** each category's budget = income × category % ÷ 100. Defaults: Rent & Bills 30%, Food 15%, Travel 10%, Shopping 10%, Health 5%, Entertainment 5%, Others 5%, Savings 20%.
- **Categorisation:** keyword matching on the description. Confidence is 95% for a brand name (Swiggy, Uber, Amazon), 80% for a general keyword (lunch, bus) and 40% when nothing matches (Others).
- **Overspending status:**
  - *Over budget:* spent > budget
  - *Likely to overspend:* month-end projection > budget
  - *Near limit:* spent ≥ 80% of budget
- **Unusual transaction:** amount > 2 × the average transaction in the same category over the previous 3 months (needs at least 3 past transactions). Rent & Bills is excluded because rent is always large.
- **Month-end projection:** spent so far + (days left ÷ days in month) × last month's amount for that category. Fixed bills use the larger of spent so far and last month's bills. Without last month's data, the current daily pace is used.
- **Next-month forecast:** weighted average of this month (projected), last month and the month before, with weights 50%, 30% and 20%.
- **Forecast confidence:** 100 − (standard deviation ÷ average × 100) of the last 3 completed months' totals, kept between 60% and 98%.
- **Savings goal:** needed per month = (target − saved) ÷ months left. The goal is on track when expected monthly savings ≥ needed per month.
- **Recommended cut:** the overspend, capped at 25% of the category's spending, rounded to ₹500 (above ₹1,000) or ₹100. Example: Travel ₹4,500 against a ₹3,000 budget gives a suggested cut of ₹1,000.
- **Financial health score (0–100):**
  - Savings rate: 40 × (expected savings rate ÷ target rate), capped at 40
  - Budget discipline: 30 × (categories within budget ÷ 7)
  - Goal progress: 20 × average goal progress (10 when there are no goals)
  - Spending trend: 10 if next month's forecast ≤ this month's projection, otherwise 5
  - 80+ Excellent, 60–79 Good, below 60 Needs attention

## Demo data

`data/sample-data.js` generates 6 months of transactions relative to today's date. The current month totals ₹24,000 (₹30,000 income, ₹6,000 left for savings), with Travel, Food and Shopping over budget and one planted unusual purchase (₹2,499 Bluetooth headphones). Current-month transactions dated after today are left out, so the full ₹24,000 appears near the end of the month.

## Project structure

```
pocketsmart-ai/
├── index.html            Single-page app: Dashboard, Transactions, Budget, Goals, AI assistant, Settings
├── css/style.css
├── assets/logo.svg
├── data/sample-data.js   Demo data generated relative to today's date
└── js/
    ├── utils.js          Formatting (₹, %), date helpers
    ├── storage.js        Categories, default settings, localStorage
    ├── categorize.js     Keyword-based category detection with confidence
    ├── budget.js         Budget amounts, spending per category, overspending status
    ├── prediction.js     Projection, forecast, forecast confidence, unusual transactions
    ├── goals.js          Savings goal evaluation
    ├── health.js         Financial health score
    ├── charts.js         SVG donut, gauge and column charts
    ├── typewriter.js     Word-by-word text streaming
    ├── ai.js             Question understanding, answers, recommendations, monthly insight
    ├── chat.js           Chat interface: thinking steps, streaming, follow-up chips
    └── app.js            Navigation, rendering and form handling
```

## Data model (localStorage key `pocketsmart-ai-v2`)

```json
{
  "settings": { "income": 30000, "percents": { "bills": 30, "food": 15, "travel": 10, "shopping": 10, "health": 5, "entertainment": 5, "others": 5, "savings": 20 } },
  "transactions": [{ "id": "…", "date": "2026-09-06", "description": "Swiggy dinner", "amount": 730, "category": "food" }],
  "goals": [{ "id": "…", "name": "Emergency fund", "target": 50000, "saved": 18000, "deadline": "2027-05" }]
}
```

## Future scope: Google Cloud Generative AI

The rule-based engine can later be backed by **Gemini on Vertex AI**. A Google Cloud Function would receive the same monthly summary the app already computes (income, spending per category, budgets, projections, goals) and return natural-language advice. The current rule-based engine stays as the offline fallback.
