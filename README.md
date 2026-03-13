This is a [Next.js](https://nextjs.org) App Router project for restaurant operations.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Monime Payments

Server-owned Monime checkout is wired through these routes:

- `POST /api/payments/monime/checkout`
- `GET /api/payments/monime/status`
- `POST /api/payments/monime/cancel`
- `POST /api/webhooks/monime`
- `GET /payments/monime/success`
- `GET /payments/monime/cancel`

Authoritative payment completion comes from the Monime webhook. The success redirect is only used to show a pending or confirmed UX while reconciliation finishes.

Required env vars are documented in [`.env.example`](/Users/christexfoundation/Documents/Engineering%20/RMS/rms-app/.env.example).
Set `JWT_SECRET` to a long random value before running the app in any environment.

For Monime webhooks, make sure the verification method configured in Monime matches your app env:
- `HS256`: set `MONIME_WEBHOOK_SECRET`
- `ES256`: set `MONIME_WEBHOOK_VERIFICATION_METHOD=ES256` and `MONIME_WEBHOOK_PUBLIC_KEY`

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
