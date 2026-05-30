##################################
# ECS Cluster
##################################

resource "aws_ecs_cluster" "this" {

  name = "${var.project_name}-cluster"

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

##################################
# Task Definition Skeleton
##################################

resource "aws_ecs_task_definition" "this" {

  family = "${var.project_name}-task"

  network_mode = "awsvpc"

  requires_compatibilities = [
    "FARGATE"
  ]

  cpu    = "256"
  memory = "512"

  execution_role_arn = var.execution_role_arn

  task_role_arn = var.task_role_arn

  container_definitions = jsonencode([
    {
      name = "${var.project_name}-app"

      image = "${var.ecr_repository_url}:latest"

      essential = true

      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "PORT"
          value = "8080"
        }
      ]
    }
  ])
}

##################################
# ECS Service
##################################

resource "aws_ecs_service" "this" {

  name = "${var.project_name}-service"

  cluster = aws_ecs_cluster.this.id

  task_definition = aws_ecs_task_definition.this.arn

  desired_count = 4

  launch_type = "FARGATE"

  deployment_minimum_healthy_percent = 50

  deployment_maximum_percent = 200

  network_configuration {

    subnets = var.private_subnet_ids

    security_groups = [
      var.ecs_security_group_id
    ]

    assign_public_ip = false
  }

  load_balancer {

    target_group_arn = var.target_group_arn

    container_name = "${var.project_name}-app"

    container_port = 8080
  }

  lifecycle {

    ignore_changes = [
      task_definition
    ]
  }

  depends_on = [
    aws_ecs_task_definition.this
  ]
}

##################################
# Auto Scaling Target
##################################

resource "aws_appautoscaling_target" "ecs" {

  max_capacity = 10

  min_capacity = 2

  resource_id = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this.name}"

  scalable_dimension = "ecs:service:DesiredCount"

  service_namespace = "ecs"
}

##################################
# CPU Target Tracking
##################################

resource "aws_appautoscaling_policy" "cpu" {

  name = "${var.project_name}-cpu-scaling"

  policy_type = "TargetTrackingScaling"

  resource_id = aws_appautoscaling_target.ecs.resource_id

  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension

  service_namespace = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {

    target_value = 60

    predefined_metric_specification {

      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    scale_in_cooldown  = 120

    scale_out_cooldown = 60
  }
}

##################################
# Memory Target Tracking
##################################

resource "aws_appautoscaling_policy" "memory" {

  name = "${var.project_name}-memory-scaling"

  policy_type = "TargetTrackingScaling"

  resource_id = aws_appautoscaling_target.ecs.resource_id

  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension

  service_namespace = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {

    target_value = 70

    predefined_metric_specification {

      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }

    scale_in_cooldown  = 120

    scale_out_cooldown = 60
  }
}