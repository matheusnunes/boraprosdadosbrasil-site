variable "project" {
  description = "Prefixo de nomes dos recursos"
  type        = string
  default     = "boraprosdadosbrasil"
}

variable "region" {
  description = "Região do bucket S3 (ex.: sa-east-1)"
  type        = string
  default     = "sa-east-1"
}

variable "bucket_name" {
  description = "Nome globalmente único do bucket do site"
  type        = string
  default     = "boraprosdadosbrasil-site"
}

variable "domain" {
  description = "Domínio customizado (ex.: boraprosdadosbrasil.com.br). Vazio = usar só o domínio do CloudFront"
  type        = string
  default     = ""
}

variable "subject_alternative_names" {
  description = "Domínios alternativos (ex.: www.exemplo.com.br)"
  type        = list(string)
  default     = []
}

variable "hosted_zone_id" {
  description = "ID da hosted zone no Route 53 (opcional; vazio = validar o certificado manualmente)"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "PriceClass do CloudFront (PriceClass_100 | PriceClass_200 | PriceClass_All)"
  type        = string
  default     = "PriceClass_200"
}

variable "enable_access_logs" {
  description = "Ativar logs de acesso do S3 (bucket separado)"
  type        = bool
  default     = true
}

variable "logs_retention_days" {
  description = "Retenção dos logs de acesso (dias)"
  type        = number
  default     = 90
}

variable "tags" {
  description = "Tags aplicadas aos recursos"
  type        = map(string)
  default     = { project = "boraprosdadosbrasil" }
}
