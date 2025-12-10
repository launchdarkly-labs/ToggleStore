# Feature Flags Reference Table

This document provides a comprehensive reference of all feature flags used in the ToggleStore application.

| Flag Key | Name | Description | Variations | What It Controls |
|----------|------|-------------|------------|------------------|
| `rewardsProgram` | A1 - Rewards Program - Feature Flagging/Segmentation | Controls the visibility and functionality of the ToggleStore rewards program, allowing targeted rollout to specific user segments | `true` - Enable Rewards Program<br>`false` - Disable Rewards Program | Rewards dialog visibility, rewards icon in header, points display, tier benefits |
| `referralProgram` | A2 - Referral Program - Progressive Rollout | Enables the referral program feature with progressive rollout to gradually increase user adoption | `true` - Enable Referral Program<br>`false` - Disable Referral Program | Referral code generation, referral stats display, referral benefits section in rewards dialog |
| `playGround` | A3 - Playground Feature Flag | This feature flag is for you to test any feature flag functionality. It doesn't affect the ToggleStore Application. | `true` - variationA<br>`false` - variationB | Testing/experimentation purposes only |
| `apiRelease` | A4 - API Release v3.0 - Error Debugging with Observability | Releases new API v3.0 with enhanced observability features for error debugging and monitoring | `true` - Enable API v3.0<br>`false` - Use API v2.0 | Product search functionality (breaks when enabled), product display errors, API health check endpoint behavior |
| `paymentsSystemsUpgrade` | A5 - Payments Systems Upgrade - Guarded Rollout (Success) | Upgrades the payment processing system with guarded rollout to monitor success rates, latency, and error rates | `true` - Stripe v3<br>`false` - Stripe v2 | Payment processing system version, payment metrics tracking |
| `emailNotificationServiceUpgrade` | A6 - Email Notification Service Upgrade - Guarded Rollout (Automatic Rollback) | Upgrades the email notification service with guarded rollout and automatic rollback on error detection | `true` - AWS SES<br>`false` - SendGrid | Email service provider, email delivery metrics tracking |
| `searchAlgorithm` | A7 - Search Algorithm - Feature Experiment (Experimentation) | Tests a new search algorithm to improve search relevance and conversion rates through experimentation | `"simple-search"` - New Search Algorithm<br>`"featured-list"` - Groups into Featured and Other sections | Search algorithm selection in header component, product search results grouping and display |
| `storePromoBanner` | A8 - Store Promo Banner - Funnel Optimization (Experimentation) | Tests different promotional banner variations to optimize the purchase funnel and improve conversion rates | `"Flash Sale"` - Flash Sale<br>`"Free Shipping"` - Free Shipping<br>`"20 Percent Off"` - 20% off | Promotional banner display at top of page, banner variant styling and messaging |
| `ai-config--togglebotchatbot` | ToggleBot Chatbot - ToggleStore | AI-powered chatbot assistant for ToggleStore providing customer support, product recommendations, and shopping assistance | AI Config variations:<br>- Claude 3.7 Sonnet<br>- AWS Nova Pro<br>- OpenAI GPT-5 | Chatbot visibility and functionality, AI model selection for chatbot responses, chatbot metrics tracking |
| `ai-config--togglestore-shopping-assistant-agent` | ToggleStore Shopping Assistant Agent | AI agent provides personalized shopping assistance to ToggleStore customers, helping with product discovery, recommendations, order inquiries, and checkout support | AI Agent variations:<br>- LD AI Model Mini<br>- LD AI Model Pro | Shopping assistant agent functionality, AI model selection for shopping assistance |

## Release Pipeline Flags (ToggleStore 2.0 Q1 2026)

The following flags are part of the release pipeline but are not yet actively used in the application code:

| Flag Key | Name | Description | Variations | Status |
|----------|------|-------------|------------|--------|
| `enhancedProductRecommendations` | R1 - Enhanced Product Recommendations | AI-powered product recommendations using machine learning | `true` / `false` | Pipeline - Test Phase |
| `newCheckoutFlow` | R2 - New Checkout Flow | Streamlined checkout experience with reduced steps | `true` / `false` | Pipeline - Test Phase |
| `wishlistFunctionality` | R3 - Wishlist Functionality | Allows users to save products to wishlist | `true` / `false` | Pipeline - Test Phase |
| `productReviews` | R4 - Product Reviews | Customer review and rating system | `true` / `false` | Pipeline - Test Phase |
| `socialSharing` | R5 - Social Sharing | Enable users to share products on social media | `true` / `false` | Pipeline - Test Phase (Active) |
| `mobileAppFeatures` | R6 - Mobile App Features | Enhanced mobile app experience | `true` / `false` | Pipeline - Test Phase (Active) |
| `analyticsDashboard` | R7 - Analytics Dashboard | Advanced analytics dashboard for administrators | `true` / `false` | Pipeline - Test Phase (Active) |
| `inventoryManagement` | R8 - Inventory Management | Real-time inventory tracking and management | `true` / `false` | Pipeline - Guarded Release Phase |
| `customerSupportChat` | R9 - Customer Support Chat | Live chat support feature | `true` / `false` | Pipeline - Guarded Release Phase |
| `loyaltyProgramEnhancements` | R10 - Loyalty Program Enhancements | Enhanced loyalty program with tiered rewards | `true` / `false` | Pipeline - Guarded Release Phase |
| `multiCurrencySupport` | R11 - Multi-Currency Support | Support for multiple currencies | `true` / `false` | Pipeline - Guarded Release Phase |
| `giftCards` | R12 - Gift Cards | Digital gift card system | `true` / `false` | Pipeline - Guarded Release Phase |
| `subscriptionProducts` | R13 - Subscription Products | Recurring subscription product support | `true` / `false` | Pipeline - Guarded Release Phase |
| `productBundles` | R14 - Product Bundles | Create and sell product bundles | `true` / `false` | Pipeline - Guarded Release Phase |
| `advancedSearchFilters` | R15 - Advanced Search Filters | Enhanced search with advanced filtering | `true` / `false` | Pipeline - Guarded Release Phase |
| `productComparison` | R16 - Product Comparison | Side-by-side product comparison tool | `true` / `false` | Pipeline - GA Release Phase |
| `recentlyViewedProducts` | R17 - Recently Viewed Products | Display recently viewed products section | `true` / `false` | Pipeline - GA Release Phase |
| `quickCheckout` | R18 - Quick Checkout | One-click quick checkout option | `true` / `false` | Pipeline - GA Release Phase |
| `guestCheckoutImprovements` | R19 - Guest Checkout Improvements | Enhanced guest checkout experience | `true` / `false` | Pipeline - GA Release Phase |
| `orderTrackingEnhancements` | R20 - Order Tracking Enhancements | Real-time order tracking with shipment updates | `true` / `false` | Pipeline - GA Release Phase |

## Usage Examples

### Client-side Flag Usage

```typescript
import { useFlag } from "@/lib/launchdarkly/client"

export default function MyComponent() {
  const rewardsProgramEnabled = useFlag("rewardsProgram", false)
  
  return rewardsProgramEnabled ? <RewardsDialog /> : null
}
```

### Server-side Flag Usage

```typescript
import { getFlagValue } from "@/lib/launchdarkly/server"

export default async function MyPage() {
  const apiReleaseEnabled = await getFlagValue(
    "apiRelease",
    { kind: "user", key: "anonymous" },
    false
  )
  
  return apiReleaseEnabled ? <NewAPIComponent /> : <OldAPIComponent />
}
```

### String Flag Variations

```typescript
import { useFlags } from "launchdarkly-react-client-sdk"

export default function Banner() {
  const flags = useFlags()
  const storePromoBanner = flags.storePromoBanner as string | undefined
  
  if (storePromoBanner === "Flash Sale") {
    return <FlashSaleBanner />
  } else if (storePromoBanner === "Free Shipping") {
    return <FreeShippingBanner />
  }
  return null
}
```

