# inference/

The blue-check LLM pipeline. Two scripts, one shared snapshot folder.

## Scripts

### `scrape_rep_sources.py`
Pulls plain-text content from a representative's official website (issue
pages + a few recent press releases). Writes both a JSON snapshot and an
idempotent SQL file under `snapshots/`. No API keys needed.

```bash
python inference/scrape_rep_sources.py \
    --website https://clyde.house.gov \
    --rep-id 20 \
    --name-slug clyde
```

### `infer_positions.py`
For each (rep, issue), retrieves top-K relevant source chunks via pgvector
cosine similarity and asks Claude to predict a vote + confidence + supporting
quote. Writes rows into `public.rep_positions`. **Requires three keys in
env**:

```bash
export SUPABASE_URL=https://aeqncvlmgwdnnzhyeovs.supabase.co
export SUPABASE_SERVICE_KEY=...   # the service_role key, not the anon key
export OPENAI_API_KEY=...         # text-embedding-3-small (1536 dim)
export ANTHROPIC_API_KEY=...      # claude-sonnet-4-7
```

Usage:

```bash
# Predict all 58 issues for Andrew Clyde:
python inference/infer_positions.py --rep-id 20

# Just the 10 onboarding issues:
python inference/infer_positions.py --rep-id 20 --onboarding-only

# All GA reps × all onboarding issues:
python inference/infer_positions.py --state GA --onboarding-only

# Dry-run, don't write to DB:
python inference/infer_positions.py --rep-id 20 --dry-run
```

The first invocation embeds any sources whose `embedding` column is NULL,
which is the typical state after a fresh scrape. Add `--no-embed` to skip
that step if you've already embedded.

## Cost estimate

Per inference: ~1500 tokens in + ~150 out = roughly **$0.005** at Sonnet
4.7 prices. The 10 Hall County reps + 13 federal + state-level reps for
Hall County × 58 issues ≈ 1,300 inferences = **~$6.50** for full coverage
of one user's representative list. Embedding cost is negligible (a few
cents at most for the same scope).

## Data flow

```
scrape_rep_sources.py
        |
        |  POST to public.rep_sources (content, content_hash, url)
        v
public.rep_sources  ────► embed.py (backfills embedding column via OpenAI)
        |
        |  pgvector cosine similarity query, top-K
        v
infer_positions.py  ────► Claude Sonnet (system prompt + retrieved excerpts)
        |
        |  UPSERT to public.rep_positions
        v
public.rep_positions  ────► Vote Impact overlay + RepresentativeDetails
                            (predicted_vote, confidence, supporting_quote,
                             source_url, model, inferred_at)
```

## Why a CLI, not a Supabase Edge Function (yet)

Edge Functions are Deno-based and would require porting the embedding +
Anthropic SDK code paths to TypeScript. For Phase 3 proof-of-concept, the
Python CLI is faster to iterate and gives us local visibility into what
Claude is saying. Phase 4 promotes the pipeline to a Supabase Scheduled
Edge Function for weekly re-inference.

## Snapshots

`snapshots/` is the only directory written to. JSON files are
human-readable and useful for inspecting what was extracted. The SQL files
are idempotent (UNIQUE constraint on `rep_id, content_hash` means re-runs
do nothing).
