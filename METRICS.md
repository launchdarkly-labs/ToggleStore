# ToggleStore Metrics Documentation

This document lists all custom metrics tracked in the ToggleStore demo application and sent to LaunchDarkly for analytics and feature flag impact measurement.

## Metrics Overview

All metrics are tracked using LaunchDarkly's `track()` method:
- **Frontend**: `ldClient.track(key, data?, metricValue?)`
- **Backend**: `client.track(key, context, data?, metricValue?)`

**Note**: We avoid sending the `data` parameter and only send `metricValue` where applicable, as per best practices.

---

## Track-Only Metrics (No Value)

These metrics are tracked as events without numeric values.

| Metric Key | Type | Description | Location | When Tracked |
|------------|------|-------------|----------|--------------|
| `store-accessed` | Track Only | User accessed the storefront | `app/page.tsx` | On initial page load (once per session) |
| `add-to-cart` | Track Only | User added item to cart | `app/page.tsx`, `components/product-card.tsx` | When item is added to cart (not from search) |
| `add-to-cart-from-search` | Track Only | User added item to cart from search results | `components/header.tsx` | When item is added to cart from search dropdown |
| `cart-accessed` | Track Only | User opened the shopping cart | `app/page.tsx`, `components/cart.tsx` | When cart drawer/sheet opens |
| `checkout-complete` | Track Only | User completed checkout | `components/cart.tsx` | When checkout button is clicked and processed |
| `cart-promo` | Track Only | User applied a promo code | `components/cart.tsx` | When promo code is successfully applied (DARKLY20, FREESHIP, FLASHSALE) |
| `chatbot-accessed` | Track Only | User opened the chatbot | `components/chatbot.tsx` | When chatbot dialog opens |
| `rewards-accessed` | Track Only | User opened the rewards dialog | `components/rewards-dialog.tsx` | When rewards dialog opens |
| `search-started` | Track Only | User started a search query | `app/page.tsx` | When user types in search field (once per search session) |
| `product-viewed` | Track Only | User viewed product details | `app/page.tsx` | When product detail dialog opens |

---

## Value Metrics (With Numeric Value)

These metrics include a numeric value for quantitative analysis.

| Metric Key | Type | Description | Location | When Tracked | Value Type |
|------------|------|-------------|----------|--------------|------------|
| `cart-total` | Value | Total cart value in dollars | `components/cart.tsx` | When cart opens | Number (cart total amount) |
| `cart-items` | Value | Number of items in cart | `components/cart.tsx` | When cart opens | Number (item count) |

---

## Implementation Details

### Frontend Tracking

Frontend metrics use the `useTrackMetric()` hook from `@/lib/launchdarkly/metrics`:

```typescript
import { useTrackMetric } from "@/lib/launchdarkly/metrics"

const trackMetric = useTrackMetric()

// Track event only
trackMetric("store-accessed")

// Track event with value
trackMetric("cart-total", 125.99)
```

### Backend Tracking

Backend metrics use the `trackMetric()` function from `@/lib/launchdarkly/metrics-server`:

```typescript
import { trackMetric } from "@/lib/launchdarkly/metrics-server"

// Track event only
await trackMetric("checkout-complete", context)

// Track event with value
await trackMetric("cart-total", context, 125.99)
```

---

## Usage in LaunchDarkly

These metrics can be used in LaunchDarkly for:

1. **Feature Flag Impact Analysis**: Measure how feature flags affect user behavior
2. **A/B Testing**: Compare conversion rates between flag variations
3. **User Segmentation**: Target users based on behavior patterns
4. **Experimentation**: Run experiments and measure outcomes
5. **Analytics Dashboards**: Build custom analytics dashboards

### Example: Using Metrics in Feature Flag Rules

You can create feature flag rules that target users based on these metrics:

- Target users who have `cart-total > 100` for premium checkout features
- Show different experiences to users who have `add-to-cart-from-search` vs `add-to-cart`
- Enable features for users with `checkout-complete` events

---

## Notes

- All metrics are sent to LaunchDarkly automatically when the events occur
- Metrics are associated with the current LaunchDarkly context (user, device, location, etc.)
- No personal data is sent in the `data` parameter - only metric values where applicable
- Metrics are tracked client-side for real-time analytics
- Server-side tracking is available for backend events (currently not used but infrastructure is in place)

---

## Last Updated

This document was last updated when metrics tracking was implemented throughout the application.

