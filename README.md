# KoaDan AI — Cloudflare Workers AI

KoaDan is a family-friendly AI PWA with six moods. This version runs the backend on Cloudflare Workers and uses Cloudflare Workers AI instead of the OpenAI API.

## Architecture

KoaDan PWA → Cloudflare Worker → Cloudflare Workers AI

No OpenAI API key or OpenAI environment variable is required.

## Deploy

1. Create a Cloudflare account.
2. Create a Workers project and connect this GitHub repository, or deploy with Wrangler.
3. The Worker needs the Workers AI binding named `AI` and the static asset binding named `ASSETS`; both are defined in `wrangler.jsonc`.
4. Deploy with `npm install` followed by `npm run deploy` if using Wrangler.

Cloudflare's Workers AI docs show the `ai` binding as `AI` and access through `env.AI.run(...)`.

## Model

The Worker uses `@cf/meta/llama-3.2-1b-instruct`. Cloudflare currently lists Workers AI on the Free Workers plan with a 10,000-Neuron-per-day free allocation. Model usage is subject to Cloudflare's current limits and pricing.

## Existing frontend

The original files in `public/` are retained. The frontend already posts chat messages to `/api/chat`, so no frontend API URL is required.
