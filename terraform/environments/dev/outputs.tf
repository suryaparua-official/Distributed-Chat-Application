output "alb_dns_name" {

  value = module.alb.alb_dns_name
}

output "cloudfront_url" {

  value = "https://${module.frontend.cloudfront_domain_name}"
}

output "ecr_repository_url" {

  value = module.ecr.repository_url
}

output "ecs_cluster_name" {

  value = module.ecs.cluster_name
}

output "ecs_service_name" {

  value = module.ecs.service_name
}

output "task_definition_family" {

  value = module.ecs.task_definition_family
}

output "frontend_bucket_name" {

  value = module.frontend.bucket_name
}

output "cloudfront_distribution_id" {

  value = module.frontend.cloudfront_id
}