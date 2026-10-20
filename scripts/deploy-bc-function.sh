#!/bin/bash
# =============================================================
# deploy-bc-function.sh — Deploy da Edge Function processar-ciclo-bc
# Execute: bash scripts/deploy-bc-function.sh
# =============================================================

set -euo pipefail

PROJECT_REF="lsxsbvtacopsvhwbdkhx"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE_BIN="npx --yes supabase@1"

echo ""
echo "🔥 DEPLOY — Edge Function: processar-ciclo-bc"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project: $PROJECT_REF"
echo ""

# ─── 1. Token de acesso ───────────────────────────────────────
echo "📋 PASSO 1 — Token de Acesso do Supabase"
echo "   Onde obter: https://supabase.com/dashboard/account/tokens"
echo ""
read -p "   Cole seu Supabase Access Token: " SUPABASE_TOKEN
echo ""

export SUPABASE_ACCESS_TOKEN="$SUPABASE_TOKEN"

# ─── 2. Vincular projeto ──────────────────────────────────────
echo "🔗 Vinculando projeto..."
cd "$PROJECT_DIR"
$SUPABASE_BIN link --project-ref "$PROJECT_REF"
echo "✅ Projeto vinculado."
echo ""

# ─── 3. Deploy da Edge Function ───────────────────────────────
echo "☁️  Fazendo deploy da Edge Function processar-ciclo-bc..."
$SUPABASE_BIN functions deploy processar-ciclo-bc --project-ref "$PROJECT_REF"
echo "✅ Edge Function deployada com sucesso!"
echo ""

# ─── 4. Verificar deploy ──────────────────────────────────────
echo "🧪 Testando Edge Function (ping)..."
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" \
  -X POST "${SUPABASE_URL}/functions/v1/processar-ciclo-bc" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"buscar_tokens","mesRef":"2026-11"}' || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOY COMPLETO!"
echo ""
echo "PRÓXIMOS PASSOS (SQL Editor do Supabase):"
echo "  1. Execute: supabase/migrations/20261020_bc_access_tokens.sql"
echo "  2. Execute: supabase/migrations/20261020_bc_cron_jobs.sql"
echo "     (requer pg_cron e pg_net habilitados em Database → Extensions)"
echo ""
echo "URL da função:"
echo "  ${SUPABASE_URL}/functions/v1/processar-ciclo-bc"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
