# Deploy — S3 + CloudFront (Terraform)

## Pré-requisitos

- Conta na AWS (de preferência **própria/do projeto** — não use credencial corporativa de outra conta).
- `terraform` e `awscli` instalados: `brew install terraform awscli`
- Credenciais configuradas: `aws configure --profile boraprosdados` (depois use `AWS_PROFILE=boraprosdados` no .env)
- (Opcional) domínio registrado — ex.: Registro.br — e, se o DNS for no Route 53 da mesma conta, o `hosted_zone_id`.

## Passo a passo

### 1. Infraestrutura (uma vez)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # ajuste bucket_name, region e (se tiver) domain/hosted_zone_id
terraform init
terraform plan
terraform apply
```

Anote os outputs:

```
site_url                   = "https://..."        (vai para o .env como SITE_URL)
bucket_name                = "..."                (vai para o .env como S3_BUCKET)
cloudfront_distribution_id = "..."                (vai para o .env como CLOUDFRONT_DISTRIBUTION_ID)
```

> Sem domínio próprio? Deixe `domain` comentado no tfvars: o site sobe no domínio do CloudFront com HTTPS normalmente.
> Com domínio mas sem Route 53? O `apply` pausa aguardando a validação do certificado — crie o registro CNAME indicado em `terraform output` (ou no console ACM) no seu provedor de DNS.

### 2. Configurar o deploy

Preencha o `.env` na raiz (copie de `.env.example`):

```
SITE_URL=https://SEU-DOMINIO.com.br        # URL final (canonical/OG/sitemap)
GA_MEASUREMENT_ID=G-XXXXXXXXXX             # ver docs/ANALYTICS.md
S3_BUCKET=<bucket_name do output>
CLOUDFRONT_DISTRIBUTION_ID=<id do output>
AWS_PROFILE=boraprosdados
```

### 3. Publicar

```bash
scripts/deploy.sh            # build + plano (dry-run) — não publica nada
scripts/deploy.sh --apply    # publica (sync com --delete + invalidação do CloudFront)
```

### 4. Verificar

```bash
curl -sI https://SEU-DOMINIO.com.br/ | head -20        # 200, HSTS, nosniff, CSP…
curl -s  https://SEU-DOMINIO.com.br/dados/SHA256SUMS.txt | head -3
# integridade: baixe um arquivo e confira o hash
curl -sO https://SEU-DOMINIO.com.br/dados/ibge/ibge_sidra.json
shasum -a 256 ibge_sidra.json   # deve bater com a linha em SHA256SUMS.txt
```

Conferir também: `/propostas/` e `/balanco/` abrem com URL limpa; uma URL inexistente mostra o 404 próprio; eventos aparecem no GA4 (Relatórios → Tempo real).

---

## "Dá para deixar as páginas só no S3?" — análise

**Sim, o conteúdo é 100% estático** (3 HTMLs + assets + arquivos de dados) — e "só S3" funciona, mas com limitações importantes:

| | Só S3 (website endpoint) | S3 + CloudFront (implementado aqui) |
|---|---|---|
| HTTPS | ❌ **não tem** (endpoint só HTTP) | ✅ TLS 1.2+, certificado próprio, redirect HTTP→HTTPS |
| Domain próprio | ok (CNAME) | ok (alias + ACM) |
| Headers de segurança | ❌ não suporta | ✅ HSTS, nosniff, frame-deny, referrer-policy, CSP |
| URLs limpas (/propostas/) | parcial (truque index/error doc) | ✅ CloudFront Function |
| CDN / cache / compressão | ❌ (só S3 regional) | ✅ global, compressão automática, cache configurável |
| Invalidação de cache | manual | 1 comando |
| Assertividade de erros | limitada | 404 customizado |
| Custo | ~centavos | ~centavos + (CloudFront ~US$1–3/mês p/ esse volume) |

**Recomendação:** manter o S3 como origem **privada** (sem website endpoint, sem bucket público) e servir tudo pelo CloudFront — é o que o Terraform deste repositório monta. Se algum dia quiser migrar para "só S3", é ativar `aws_s3_bucket_website_configuration` + abrir o bucket — mas você perde HTTPS e os headers de segurança, o que não vale a pena para um site público.

**Custo estimado** (10 mil visitas/mês, 25 MB de arquivos): S3 + CloudFront ≈ US$ 1–3/mês (majoritariamente transferência de dados dos downloads).

## Segurança e integridade (o que já está garantido)

- Bucket **privado** (Block Public Access total; só o CloudFront acessa, via OAC). Ninguém escreve nem lê direto no S3 sem credencial.
- **Versionamento ligado**: nenhuma substituição ou exclusão é definitiva — dá para auditar e restaurar qualquer versão anterior dos arquivos.
- **SHA-256 publicado** (`dados/SHA256SUMS.txt` + prefixo do hash exibido em cada botão): qualquer substituição de arquivo fica evidente.
- HTTPS obrigatório, `DenyInsecureTransport` na policy, criptografia AES-256 em repouso.
- Deploy com usuário/perfil de credenciais próprio (não commitar `.env`; já está no `.gitignore`).

### Endurecimento opcional (avaliar)

- **Object Lock (WORM)**: torna os arquivos de dados imutáveis por um período (exige criar o bucket com o lock habilitado — se quiser, eu adapto o Terraform). É o máximo de garantia contra substituição.
- **MFA Delete** no bucket (ativa via CLI com MFA — protege até contra exclusão por credencial comprometida).
- **AWS Budget** com alerta de custo (ex.: avisar se passar de US$ 5/mês).

## Rotina de atualização de conteúdo

1. Editar/atualizar arquivos em `public/`
2. `scripts/deploy.sh --apply`
3. Arquivos HTML têm cache curto (1 h) e assets 7 dias — a invalidação do CloudFront no fim do deploy cobre a atualização imediata.
