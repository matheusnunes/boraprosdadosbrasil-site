#!/usr/bin/env bash
# Deploy do site "Bora pros dados Brasil" (S3 + CloudFront).
# Uso:  scripts/deploy.sh            -> build + plano (dry-run, não publica)
#       scripts/deploy.sh --apply    -> publica de verdade
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f .env ] || { echo "erro: .env não encontrado (copie de .env.example)"; exit 1; }
set -a; . ./.env; set +a
: "${S3_BUCKET:?defina S3_BUCKET no .env}"
command -v aws >/dev/null || { echo "erro: aws cli não instalado (brew install awscli)"; exit 1; }

echo "== 1/5 build =="
python3 scripts/build.py

if [ "${1:-}" != "--apply" ]; then
  echo "== 2/5 plano (dry-run) =="
  aws s3 sync dist/ "s3://$S3_BUCKET/" --delete --dryrun | head -50
  echo "== fim do plano — rode com --apply para publicar =="
  exit 0
fi

echo "== 2/5 upload: páginas e arquivos raiz =="
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete   --exclude "dados/*" --exclude "assets/*"   --cache-control "public, max-age=3600"

echo "== 3/5 upload: assets (cache 7 dias) =="
aws s3 sync dist/assets/ "s3://$S3_BUCKET/assets/" --delete   --cache-control "public, max-age=604800"

echo "== 4/5 upload: dados (metadata por tipo) =="
cd dist
while IFS= read -r f; do
  case "$f" in
    *.zip)   ct="application/zip";                   cd_="attachment";;
    *.pdf)   ct="application/pdf";                   cd_="inline";;
    *.json)  ct="application/json";                  cd_="attachment";;
    *.jsonl) ct="application/x-ndjson";              cd_="attachment";;
    *.txt)   ct="text/plain; charset=utf-8";         cd_="inline";;
    *)       ct="application/octet-stream";          cd_="attachment";;
  esac
  aws s3 cp "$f" "s3://$S3_BUCKET/$f" --content-type "$ct" --content-disposition "$cd_" --cache-control "public, max-age=86400" >/dev/null
done < <(find dados -type f ! -name 'SHA256SUMS.txt')
cd "$ROOT"
aws s3 cp dist/dados/SHA256SUMS.txt "s3://$S3_BUCKET/dados/SHA256SUMS.txt" --content-type "text/plain; charset=utf-8" --cache-control "public, max-age=300"

echo "== 5/5 invalidação CloudFront =="
if [ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*" --output text >/dev/null
  echo "  invalidado: /*"
else
  echo "  (CLOUDFRONT_DISTRIBUTION_ID vazio — pulando; preencha no .env após o terraform apply)"
fi
echo "== deploy concluído =="
