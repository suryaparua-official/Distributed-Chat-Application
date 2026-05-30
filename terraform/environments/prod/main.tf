terraform {

  required_version = ">= 1.6.0"

  required_providers {

    aws = {

      source = "hashicorp/aws"

      version = "~> 5.50"
    }
  }
}

##################################
# AWS Provider
##################################

provider "aws" {

  region = var.aws_region
}

##################################
# VPC
##################################

module "vpc" {

  source = "../../modules/vpc"

  project_name = var.project_name
}

##################################
# ECR
##################################

module "ecr" {

  source = "../../modules/ecr"

  project_name = var.project_name
}

##################################
# IAM
##################################

module "iam" {

  source = "../../modules/iam"

  project_name = var.project_name
}

##################################
# ALB
##################################

module "alb" {

  source = "../../modules/alb"

  project_name = var.project_name

  vpc_id = module.vpc.vpc_id

  public_subnet_ids = module.vpc.public_subnet_ids

  alb_security_group_id = module.vpc.alb_security_group_id
}

##################################
# ECS
##################################

module "ecs" {

  source = "../../modules/ecs"

  project_name = var.project_name

  private_subnet_ids = module.vpc.private_subnet_ids

  ecs_security_group_id = module.vpc.ecs_security_group_id

  target_group_arn = module.alb.target_group_arn

  execution_role_arn = module.iam.execution_role_arn

  task_role_arn = module.iam.task_role_arn

  ecr_repository_url = module.ecr.repository_url
}

##################################
# Frontend
##################################

module "frontend" {

  source = "../../modules/frontend"

  project_name = var.project_name
}