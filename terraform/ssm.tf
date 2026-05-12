resource "aws_ssm_parameter" "mongo_uri" {
  name  = "/${var.project_name}/mongo-uri"
  type  = "SecureString"
  value = var.mongo_uri
  tags  = { Name = "${var.project_name}-mongo-uri" }
}

resource "aws_ssm_parameter" "redis_host" {
  name  = "/${var.project_name}/redis-host"
  type  = "String"
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
  tags  = { Name = "${var.project_name}-redis-host" }
}