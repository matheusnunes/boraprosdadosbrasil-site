output "bucket_name" {
  description = "Bucket do site (use no .env: S3_BUCKET)"
  value       = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  description = "ID da distribuição (use no .env: CLOUDFRONT_DISTRIBUTION_ID)"
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain" {
  description = "Domínio padrão do CloudFront"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  description = "URL final do site (use no .env: SITE_URL)"
  value       = local.use_custom_domain ? "https://${var.domain}" : "https://${aws_cloudfront_distribution.site.domain_name}"
}
