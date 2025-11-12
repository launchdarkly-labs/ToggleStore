# ToggleStore

A modern e-commerce demo application built to showcase LaunchDarkly's feature flag capabilities at conferences and events.

## Overview

ToggleStore is a Next.js application that simulates a real-world online store selling LaunchDarkly-themed merchandise. It's designed for live demonstrations of feature management, experimentation, and progressive rollouts using LaunchDarkly.

## Features

- 🛍️ **E-commerce Storefront** - Browse products, add to cart, and checkout
- 🎯 **Feature Flags** - Ready for LaunchDarkly integration
- 🔐 **Authentication** - Google OAuth with LaunchDarkly domain restriction
- 🤖 **AI Chatbot** - Customer support assistant (placeholder)
- 🎨 **Modern UI** - Dark theme with beautiful gradients
- 📱 **Responsive Design** - Works on all devices

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Authentication**: [NextAuth.js v5](https://next-auth.js.org/)
- **Feature Flags**: [LaunchDarkly](https://launchdarkly.com/)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google OAuth credentials (optional, for admin access)
- LaunchDarkly account (optional, for feature flags)

### Installation

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd ToggleStore
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Google OAuth (optional)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# LaunchDarkly (optional)
LAUNCHDARKLY_SDK_KEY=<your-server-sdk-key>
NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID=<your-client-side-id>
```

4. **Run the development server**

```bash
npm run dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

## Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

**Note**: Only `@launchdarkly.com` emails can authenticate. This is enforced in the auth configuration.

### LaunchDarkly Setup

1. Sign up at [LaunchDarkly](https://app.launchdarkly.com/)
2. Create a new project
3. Get your SDK keys:
   - **Server-side SDK key**: Account Settings → Projects → Your Project → Environments
   - **Client-side ID**: Same location as above
4. Add keys to `.env.local`

## Project Structure

```
ToggleStore/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   └── auth/         # NextAuth endpoints
│   ├── auth/             # Auth pages (signin, error)
│   ├── layout.tsx        # Root layout with providers
│   └── page.tsx          # Main storefront page
├── components/            # React components
│   ├── ui/              # shadcn/ui components
│   ├── header.tsx       # Header with nav and cart
│   ├── product-card.tsx # Product card component
│   ├── cart.tsx         # Shopping cart drawer
│   └── chatbot.tsx      # AI chatbot component
├── lib/                   # Utilities and configs
│   ├── auth.ts          # NextAuth configuration
│   └── launchdarkly/    # LaunchDarkly utilities
│       ├── server.ts    # Server-side SDK
│       └── client.tsx   # Client-side SDK
├── data/                  # Static data
│   └── products.json    # Product catalog
├── types/                 # TypeScript types
│   └── product.ts       # Product and cart types
├── public/                # Static assets
│   └── assets/          # Images and icons
│       ├── products/    # Product images
│       ├── icons/       # UI icons
│       ├── chatbot/     # Chatbot assets
│       └── backgrounds/ # Background effects
└── .cursorrules          # AI assistant guidelines
```

## Adding Product Assets

Product data is stored in `/data/products.json`. To add product images:

1. Add images to `/public/assets/products/`
2. Update the `images` field in `products.json`:

```json
{
  "id": "prod-001",
  "name": "Super fun Dev T-shirt",
  "images": {
    "main": "/assets/products/tshirt-001.png",
    "thumbnail": "/assets/products/tshirt-001-thumb.png"
  }
  // ...
}
```

## Feature Flag Examples

Here are some feature flags you can implement:

### Server-side Flag

```typescript
import { getFlagValue } from "@/lib/launchdarkly/server"

export default async function MyPage() {
  const showNewFeature = await getFlagValue(
    "new-feature",
    { kind: "user", key: "anonymous" },
    false
  )
  
  return showNewFeature ? <NewFeature /> : <OldFeature />
}
```

### Client-side Flag

```typescript
"use client"
import { useFlag } from "@/lib/launchdarkly/client"

export default function MyComponent() {
  const showNewFeature = useFlag("new-feature", false)
  
  return showNewFeature ? <NewFeature /> : <OldFeature />
}
```

## Demo Ideas

Here are some feature flag demonstrations you can implement:

- **Product Recommendations** - Show personalized products
- **Pricing Experiments** - A/B test different prices
- **New Product Launch** - Gradually roll out new products
- **Cart Features** - Toggle express checkout, gift options
- **Chatbot** - Enable/disable AI assistant
- **Search** - Toggle advanced search features
- **Inventory** - Show/hide out-of-stock items
- **Themes** - Switch between seasonal themes
- **Targeting** - Different experiences per user segment

## Authentication

- **Public Access**: Anyone can browse the storefront
- **Admin Access**: Only `@launchdarkly.com` emails can sign in
- Protected routes redirect to signin if not authenticated

## Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint
```

### Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com/)
3. Add environment variables
4. Deploy

### Other Platforms

Build the production bundle:

```bash
npm run build
```

Then deploy the `.next` folder according to your platform's instructions.

## Troubleshooting

### LaunchDarkly not connecting

- Check that your SDK keys are correct
- Ensure client-side ID starts with `NEXT_PUBLIC_`
- Check browser console for errors

### Authentication not working

- Verify Google OAuth credentials
- Check redirect URIs match exactly
- Ensure `NEXTAUTH_SECRET` is set

### Build errors

- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (requires 18+)
- Clear `.next` folder and rebuild

## Contributing

This is a demo application. Feel free to fork and customize for your own demonstrations.

## License

MIT

## Support

For issues or questions, please open an issue on GitHub or contact the LaunchDarkly team.

---

Built with ❤️ for LaunchDarkly demonstrations 
