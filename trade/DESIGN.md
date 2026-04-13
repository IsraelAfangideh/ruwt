# Ruwt Trade — Design Constitution

Read this before making any UI changes. These are hard rules, not suggestions.

## No flicker. Ever.

- Never reset visible data to null/loading when the user switches context (tabs, pages, filters). Show stale data until fresh data arrives.
- Cache aggressively. If the user saw a price 2 seconds ago and switches tabs, show that cached price immediately.
- Skeleton/loading states are only acceptable on first load when there is genuinely no data yet.
- If a network request fails, keep showing the last good data. Show an error indicator, not a blank screen.

## The user always knows what they'll get

- Every actionable button must show the exact price/amount the user will receive. "Sell" is wrong. "Sell at $4,189.35" is right.
- P&L must be calculated against the actual execution price (bid for sells, ask for buys), not a midpoint or oracle price.
- Negative numbers must have a minus sign. Red color alone is not sufficient — "$0.38" in red is ambiguous. "-$0.38" in red is clear.
- Positive numbers get a "+" prefix. "+$2.50" not "$2.50".

## Transitions, not jumps

- All color and background changes use `transition: 0.2s ease` minimum.
- Price changes flash green (up) or red (down) then settle to neutral. Don't leave prices permanently colored.
- When a position appears or disappears, the surrounding layout should not jump. Use consistent heights/spacing.

## Mobile-first, always

- Max content width: 480px centered. This is a phone app that happens to work on desktop.
- Touch targets: minimum 44px height on all buttons.
- No hover-dependent interactions. Everything must work with tap only.
- Test at 375px width (iPhone SE). If it breaks there, it's broken.

## The Ruwt design system

- **Palette**: Warm cream (#f5f3f0) / dark (#0f0e0d) with gold accent (#846a30 light, #c9a962 dark)
- **Trading colors**: Green for profit/buy, red for loss/sell. In dark mode use brighter variants (#00f0aa / #ff3366).
- **Typography**: Cormorant Garamond for display/prices (serif = premium feel), Libre Franklin for body text, monospace for numbers/data.
- **Cards**: 16px border radius, subtle border, left color accent bar for P&L direction.
- **Spacing**: 8px base unit. Use the token scale (4, 8, 16, 24, 32, 48).

## Simplicity over features

- The user sees: price, buy button, sell button, their positions. That's it.
- No order book display. No charts (yet). No limit orders. No advanced settings.
- One screen. No navigation. No modals. No multi-step flows.
- If you're adding a feature that requires explanation, it's too complex for V1.

## Data display rules

- Prices: always 2 decimal places, comma-separated thousands. "$4,189.35" not "$4189.3456".
- Percentages: 2 decimal places with sign. "+1.32%" or "-0.47%".
- USDT amounts: 2 decimal places. "$98.02" not "$98.019802".
- Timestamps: relative when recent ("2m ago"), absolute when old ("Apr 13, 2:30 PM").
- Use the shared `fmtPrice()` from `lib/format.ts`. Don't inline `toLocaleString`.
