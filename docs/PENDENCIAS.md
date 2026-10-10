# Pendências — checklist de lançamento

## Analytics
- [ ] Criar conta/propriedade **GA4** e colar o ID em `.env` (`GA_MEASUREMENT_ID=G-…`)
- [ ] (Opcional) Retenção de dados em 14 meses; decidir Google Signals
- [ ] Decidir **CONSENT_MODE** (`none` ou `banner`) — ver docs/ANALYTICS.md

## AWS (infra + deploy)
- [ ] Confirmar conta AWS **do projeto** (a credencial `default` da máquina pode ser corporativa — não usar)
- [ ] Criar usuário IAM de deploy + `aws configure --profile boraprosdados` (o perfil vai no `.env`)
- [ ] Instalar CLIs: `brew install terraform awscli` *(instalação já iniciada nesta máquina)*
- [ ] Preencher `infra/terraform/terraform.tfvars` (bucket único; domínio/hosted zone se houver)
- [ ] `terraform init && terraform apply`
- [ ] Preencher `.env` com os outputs (SITE_URL, S3_BUCKET, CLOUDFRONT_DISTRIBUTION_ID)
- [ ] `scripts/deploy.sh --apply`
- [ ] Verificar HTTPS, headers (curl -I) e exemplo de download com hash confere

## Domínio (se for usar próprio)
- [ ] Registrar domínio (ex.: Registro.br)
- [ ] Se DNS não for Route 53: criar o CNAME de validação do certificado + apontar A/AAAA para o CloudFront
- [ ] Google Search Console: verificar domínio + enviar `sitemap.xml`

## Segurança (opcional pós-lançamento)
- [ ] Avaliar **Object Lock** no bucket de dados (máxima garantia contra substituição)
- [ ] Avaliar **MFA Delete** e **AWS Budget** com alerta de custo

## Conteúdo
- [ ] Revisar títulos/descrições SEO se quiser ajustar o tom
- [ ] A pasta `pdf/` ficou **de fora** do site por pedido (os PDFs seguem em `boraprosdadosbrasil.v2/pdf/`)
- [ ] Ler o site publicado no celular (3 páginas + downloads) — verificação final de UX
