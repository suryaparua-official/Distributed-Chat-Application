variable "project_name" {
  type = string
}

variable "alb_dns_name" {
  type        = string
  description = "ALB DNS name for API path forwarding"
}
