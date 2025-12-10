# ToggleStore

A modern e-commerce demo application built to showcase LaunchDarkly's feature flag capabilities at conferences and events.

## Overview

ToggleStore is a Next.js application that simulates a real-world online store selling LaunchDarkly-themed merchandise. It's designed for live demonstrations of feature management, experimentation, and progressive rollouts using LaunchDarkly.

## Features

- 🛍️ **E-commerce Storefront** - Browse products, add to cart, and checkout
- 🎯 **Feature Flags** - LaunchDarkly integration with 10+ feature flags
- 🤖 **AI Chatbot** - AI-powered customer support assistant
- 🎨 **Modern UI** - Dark theme with beautiful gradients
- 📱 **Responsive Design** - Works on all devices

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Feature Flags**: LaunchDarkly SDK (client-side and server-side)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- LaunchDarkly account (for feature flags)

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and add your LaunchDarkly SDK keys
4. Run `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

### LaunchDarkly Setup

1. Sign up at [LaunchDarkly](https://app.launchdarkly.com/)
2. Create a new project
3. Get your SDK keys from Account Settings → Projects → Your Project → Environments
4. Add keys to `.env.local`:
   - `LAUNCHDARKLY_SDK_KEY` (server-side)
   - `NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID` (client-side)

## Feature Flags

ToggleStore includes 10 active feature flags demonstrating various LaunchDarkly capabilities:

- **Feature Flagging/Segmentation** - Rewards Program
- **Progressive Rollout** - Referral Program
- **Guarded Rollout** - Payments & Email Service Upgrades
- **Experimentation** - Search Algorithm & Promo Banner
- **AI Config** - Chatbot & Shopping Assistant
- **Observability** - API Release with error tracking

See [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) for a complete reference table with all flag keys, variations, and what they control.

## Project Structure

```
ToggleStore/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── page.tsx          # Main storefront page
│   └── layout.tsx        # Root layout
├── components/            # React components
│   ├── ui/              # shadcn/ui components
│   ├── header.tsx       # Header with nav and cart
│   ├── cart.tsx         # Shopping cart drawer
│   └── chatbot.tsx      # AI chatbot component
├── lib/                   # Utilities
│   └── launchdarkly/    # LaunchDarkly SDK integration
├── data/                  # Static data
│   └── products.json    # Product catalog
└── public/                # Static assets
```

## Usage Examples

### Client-side Flag

```typescript
import { useFlag } from "@/lib/launchdarkly/client"

export default function MyComponent() {
  const rewardsEnabled = useFlag("rewardsProgram", false)
  return rewardsEnabled ? <RewardsDialog /> : null
}
```

### Server-side Flag

```typescript
import { getFlagValue } from "@/lib/launchdarkly/server"

export default async function MyPage() {
  const apiRelease = await getFlagValue("apiRelease", context, false)
  return apiRelease ? <NewAPI /> : <OldAPI />
}
```

## Development

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Linting
```

## Results Generator

ToggleStore includes a built-in results generator that creates metrics, experiment results, and error logs for LaunchDarkly analytics. This replaces the need for external Python scripts.

### Manual Generation

Generate results on-demand via API:

```bash
# POST request with custom parameters
curl -X POST http://localhost:3000/api/generate-results \
  -H "Content-Type: application/json" \
  -d '{
    "searchAlgorithmUsers": 3000,
    "storePromoUsers": 3000,
    "aiConfigUsers": 3000,
    "aiMonitoringRuns": 1000,
    "shoppingAssistantUsers": 1000,
    "numErrors": 50
  }'

# GET request (uses smaller default values)
curl http://localhost:3000/api/generate-results
```

### What Gets Generated

- **Experiment Results**: Search algorithm, store promo banner, AI Config experiments
- **AI Monitoring**: AI interaction metrics (duration, tokens, feedback)
- **Shopping Assistant**: Agent accuracy and feedback metrics
- **Errors & Logs**: Simulated errors for observability tracking

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## License

MIT

---

Built with ❤️ for LaunchDarkly demonstrations 
