# Master LLD

An interactive low-level design practice playground for new-grad software engineering interviews.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

It opens with a catalog of 25 object-oriented system-design prompts. Choose a prompt to start a focused practice session with a large answer editor, delivery-framework guidance, and AI feedback. Requirements begin with only the problem prompt so you must clarify the behavior yourself. The five steps are Requirements, Entities & Relationships, Class Design, Implementation, and Extensibility. Each problem has a separate mastery prompt with its own brief and intended outcome for every step; clarification, feedback, and follow-up generation all use that same context. Extensibility generates one concise, problem-specific interviewer follow-up. The catalog favors practical LLD prompts over LeetCode-style algorithm exercises. The default feedback setup runs locally with Qwen3.5, so no hosted API key is required.

## Run local AI feedback

The project is configured for `mlx-community/Qwen3.5-35B-A3B-4bit`, a 20.4 GB MLX quantization intended for Apple Silicon. Install the MLX runtime once:

```bash
uv tool install mlx-lm
```

Start the local OpenAI-compatible server in one terminal:

```bash
mlx_lm.server \
  --model mlx-community/Qwen3.5-35B-A3B-4bit \
  --host 127.0.0.1 \
  --port 8080 \
  --max-tokens 1600
```

Then run the website in another terminal:

```bash
npm run dev
```

Qwen3.5 thinking mode is enabled by default. The model may take a little longer to produce a response while it reasons, but the app asks it to keep the visible feedback concise. The local model is cached after its first download. The first request may take longer while the model loads; warm requests should be much faster. The local server does not require a real API key; `LLM_API_KEY=local` is only a client placeholder.

## Save progress with Supabase

When Supabase is configured, the app sends the home page to login first. Supabase provides email/password Auth and a small Postgres table protected with row-level security. The app supports multiple practice attempts per problem, manual saves, and resume history.

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor.
3. Add these values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

4. Restart `npm run dev`, create an account, and sign in.

The publishable key is intended for browser use when the row-level-security policies remain enabled. The service-role key is needed only for the server-side Delete account action; never expose it as `NEXT_PUBLIC_...` or commit it. Supabase’s free tier is a reasonable starting point for this personal practice app, though its project inactivity pause and quota limits still apply.

## Deploy to Vercel

Vercel can host the Next.js app and connect to the hosted Supabase project, but it cannot reach the local MLX server at `127.0.0.1`. For production AI feedback, use a hosted OpenAI-compatible provider such as Groq:

```bash
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-120b
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=your-groq-api-key
```

Add those values plus the three Supabase variables above to the Vercel project’s Environment Variables settings. Do not commit `.env.local` or expose either AI or service-role key with a `NEXT_PUBLIC_` prefix. Deploy from this directory with:

```bash
npx vercel@latest login
npx vercel@latest
npx vercel@latest --prod
```
