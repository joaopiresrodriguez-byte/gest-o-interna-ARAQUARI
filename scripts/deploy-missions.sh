#!/bin/bash
# =============================================================
# deploy-missions.sh — Deploy do módulo Missões
# 
# Execute: bash scripts/deploy-missions.sh
#
# Pede o token do Supabase, faz deploy da Edge Function
# sync-sheets e configura as variáveis do webhook.
# =============================================================

set -euo pipefail

SUPABASE_BIN="npx --yes supabase"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "🚀 DEPLOY — Módulo Missões"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. Token de acesso ───────────────────────────────────────
echo ""
echo "📋 PASSO 1 — Token de Acesso do Supabase"
echo "   Onde obter: https://supabase.com/dashboard/account/tokens"
echo ""
read -p "   Cole seu Supabase Access Token: " SUPABASE_TOKEN
echo ""

export SUPABASE_ACCESS_TOKEN="$SUPABASE_TOKEN"

# ─── 2. Projeto ───────────────────────────────────────────────
echo "📋 PASSO 2 — Referência do Projeto"
echo "   Onde obter: painel do projeto → Settings → General"
echo "   Formato: abcdefghijklmnop (código de 20 chars)"
echo ""
read -p "   Cole o Project Ref: " PROJECT_REF
echo ""

# ─── 3. Variáveis para o webhook ──────────────────────────────
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

echo "📋 PASSO 3 — Anon Key (para o webhook)"
echo "   Onde obter: Settings → API → anon public"
echo ""
read -p "   Cole a Anon Key: " ANON_KEY
echo ""

# ─── 4. Link do projeto ───────────────────────────────────────
echo "🔗 Vinculando projeto..."
cd "$PROJECT_DIR"
$SUPABASE_BIN link --project-ref "$PROJECT_REF"
echo "✅ Projeto vinculado."

# ─── 5. Deploy da Edge Function ───────────────────────────────
echo ""
echo "☁️  Fazendo deploy da Edge Function sync-sheets..."
$SUPABASE_BIN functions deploy sync-sheets --project-ref "$PROJECT_REF"
echo "✅ Edge Function deployada."

# ─── 6. Configura variáveis do webhook no banco ───────────────
echo ""
echo "🗄️  Configurando variáveis do webhook no banco..."

$SUPABASE_BIN db execute --project-ref "$PROJECT_REF" --sql "
ALTER DATABASE postgres
  SET app.supabase_url  = '${SUPABASE_URL}';
ALTER DATABASE postgres
  SET app.supabase_anon = '${ANON_KEY}';
SELECT 'Variáveis configuradas com sucesso.' AS resultado;
"
echo "✅ Variáveis configuradas."

# ─── 7. Git commit e push ─────────────────────────────────────
echo ""
echo "📦 Commiting e publicando no GitHub..."
git -C "$PROJECT_DIR" add .
git -C "$PROJECT_DIR" commit -m "feat: missions status, observations and author audit log

- Adds observacoes, editado_por_id, editado_por_nome, editado_em to daily_missions
- Expands status constraint to include parcialmente_concluida, nao_realizada
- New CardMissao component with status badge, edit panel and audit footer
- New missoesService.ts with STATUS_MISSAO map and atualizarMissao()
- sync-sheets Edge Function now handles daily_missions table
- SQL trigger webhook trg_sync_daily_missions_sheets via pg_net"
git -C "$PROJECT_DIR" push origin main
echo "✅ Push realizado."

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOY COMPLETO!"
echo ""
echo "Próximo passo (1x no SQL Editor do Supabase):"
echo "  Cole: supabase/migrations/20260728_webhook_daily_missions_sheets.sql"
echo ""
echo "URL da Edge Function:"
echo "  ${SUPABASE_URL}/functions/v1/sync-sheets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
