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

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LAUNCHDARKLY_SDK_KEY` | Yes | Server-side SDK key |
| `NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID` | Yes | Client-side SDK key |
| `OPENAI_API_KEY` | Optional | For OpenAI-based chatbot models |
| `AWS_REGION` | Optional | AWS region for Bedrock (default: `us-west-2`) |

**Note**: AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) are **not required** in production. The application uses EKS Pod Identity for AWS access. For local development, configure AWS credentials via `~/.aws/credentials` or environment variables.

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

### AWS EKS (Production)

ToggleStore is deployed to AWS EKS using EKS Pod Identity for secure AWS access. This eliminates the need for long-lived AWS credentials in the application.

#### Prerequisites

- AWS CLI configured with appropriate permissions
- kubectl configured for your EKS cluster
- Docker for building images

#### Deployment Script

Deploy using the local deployment script:

```bash
python3 .github/workflows/deploy_aws.py --namespace <your-namespace> \
  --ld-email <your-ld-email>
```

Options:
- `--namespace` (required): Deployment namespace (e.g., `demo`, `staging`)
- `--skip-ld`: Skip LaunchDarkly project setup
- `--skip-dns`: Skip Route53 DNS configuration
- `--skip-pod-identity`: Skip EKS Pod Identity Association setup
- `--kubeconfig`: Path to kubeconfig file

#### GitHub Actions

The `Cloud Environment Deployment` workflow automatically:
1. Creates/updates LaunchDarkly project
2. Builds and pushes Docker image to ECR
3. Creates EKS Pod Identity Association
4. Deploys to Kubernetes
5. Configures Route53 DNS

#### AWS Access (Pod Identity)

The application uses **EKS Pod Identity** for AWS access instead of static credentials:
- No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in the deployed application
- Pods automatically receive temporary credentials from the IAM role
- Credentials are automatically rotated

For local development, the AWS SDK uses the standard credential provider chain:
- `~/.aws/credentials` file
- Environment variables
- AWS SSO profiles

### Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## License

MIT

---

Built with ❤️ for LaunchDarkly demonstrations 
