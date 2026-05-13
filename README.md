# 🚀 Distributed Real-Time Chat Application

A production-grade distributed real-time chat system built with Node.js and React, deployed on AWS using modern DevOps practices. Support Unicast, Multicast & Broadcast.

![AWS](https://img.shields.io/badge/AWS-ECS_Fargate-orange?logo=amazon-aws)
![Terraform](https://img.shields.io/badge/IaC-Terraform-purple?logo=terraform)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-blue?logo=github-actions)
![Redis](https://img.shields.io/badge/Cache-ElastiCache_Redis-red?logo=redis)
![Docker](https://img.shields.io/badge/Container-Docker-blue?logo=docker)

---

## 🏗️ Architecture

```
Internet Users
      ↓
AWS Application Load Balancer (ALB)
      ↓
ECS Fargate (4 container instances)
   ↓          ↓          ↓          ↓
 Task 1     Task 2     Task 3     Task 4
      ↓
ElastiCache Redis (Pub/Sub — syncs all containers)
      ↓
MongoDB Atlas (Chat history persistence)

Frontend: React → S3 + CloudFront (CDN)
Secrets:  AWS Parameter Store
Logs:     CloudWatch
```

---

## ✨ Features

- **Real-time messaging** via WebSocket (Socket.IO)
- **Group chat** — multiple users in named rooms
- **Direct messages** — private unicast messaging
- **Broadcast** — send to all connected users across all rooms
- **Distributed architecture** — 4 ECS containers synced via Redis Pub/Sub
- **Chat history** — persisted in MongoDB Atlas
- **CDN-served frontend** — React app on S3 + CloudFront

---

## 🛠️ Tech Stack

### Application

| Layer           | Technology                    |
| --------------- | ----------------------------- |
| Frontend        | React + Vite                  |
| Backend         | Node.js + Express + Socket.IO |
| Database        | MongoDB Atlas                 |
| Cache / Pub-Sub | Redis (AWS ElastiCache)       |

### AWS Infrastructure

| Service         | Purpose                                      |
| --------------- | -------------------------------------------- |
| ECS Fargate     | Serverless container orchestration           |
| ALB             | Load balancing + WebSocket support           |
| ElastiCache     | Managed Redis for Pub/Sub                    |
| ECR             | Docker image registry                        |
| S3 + CloudFront | Frontend hosting + CDN                       |
| Parameter Store | Secret management                            |
| CloudWatch      | Logs, metrics, and alarms                    |
| VPC             | Network isolation (public + private subnets) |
| IAM             | Roles and least-privilege policies           |
| NAT Gateway     | Private subnet outbound internet access      |

### DevOps

| Tool           | Purpose                |
| -------------- | ---------------------- |
| Terraform      | Infrastructure as Code |
| Docker         | Containerization       |
| GitHub Actions | CI/CD pipeline         |

---

## 📁 Project Structure

```
.
├── backend/                    # Node.js + Express + Socket.IO
│   ├── app.js                  # Main server entry point
│   ├── models/                 # MongoDB schemas
│   ├── routes/                 # REST API routes
│   └── Dockerfile
├── frontend/                   # React + Vite
│   └── src/
│       └── App.jsx
├── terraform/                  # AWS Infrastructure (IaC)
│   ├── main.tf                 # Provider configuration
│   ├── variables.tf            # Input variables
│   ├── vpc.tf                  # VPC, subnets, security groups
│   ├── ecs.tf                  # ECS cluster, task, service
│   ├── alb.tf                  # Application Load Balancer
│   ├── ecr.tf                  # Docker image registry
│   ├── elasticache.tf          # Redis cluster
│   ├── iam.tf                  # Roles and policies
│   ├── ssm.tf                  # Parameter Store secrets
│   ├── cloudwatch.tf           # Logs and alarms
│   ├── s3_cloudfront.tf        # Frontend CDN
│   └── outputs.tf              # Output values
├── Dockerfile                  # Root Dockerfile (bundles frontend + backend)
└── .github/
    └── workflows/
        └── deploy.yml          # GitHub Actions CI/CD pipeline
```

---

## 🚀 Deployment Guide

### Prerequisites

- AWS CLI configured (`aws configure`)
- Terraform >= 1.0
- Docker Desktop
- Node.js 18+

### Step 1 — Infrastructure Setup

```bash
# Clone the repository
git clone https://github.com/suryaparua-official/Distributed-Chat-Application.git
cd Distributed-Chat-Application

# Create terraform.tfvars (never commit this file)
cd terraform
cat > terraform.tfvars <<EOF
aws_region   = "ap-south-1"
project_name = "schat"
mongo_uri    = "mongodb+srv://<user>:<pass>@cluster.mongodb.net/SChat"
EOF

# Initialize and deploy
terraform init
terraform plan
terraform apply
```

### Step 2 — Build and Deploy Application

```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.ap-south-1.amazonaws.com

# Build frontend
cd frontend && npm install && npm run build && cd ..

# Build Docker image (bundles frontend + backend)
docker build -t schat-app -f Dockerfile .
docker tag schat-app:latest <ecr-url>:latest
docker push <ecr-url>:latest

# Force new ECS deployment
aws ecs update-service \
  --cluster schat-cluster \
  --service schat-service \
  --force-new-deployment \
  --region ap-south-1
```

### Step 3 — CI/CD (Automatic)

Every push to `main` branch automatically triggers the GitHub Actions pipeline:

```
git push origin main
      ↓
GitHub Actions
      ↓
1. Build React frontend
2. Build Docker image (frontend + backend bundled)
3. Push image to ECR (tagged with git SHA)
4. Force new ECS deployment
5. Wait for stable deployment
      ↓
Live on ALB URL ✅
```

### Step 4 — Destroy Infrastructure

```bash
cd terraform
# Empty ECR and S3 first
aws ecr delete-repository --repository-name schat-app --force --region ap-south-1
aws s3 rm s3://schat-frontend-<account-id> --recursive

terraform destroy
```

---

## 📊 System Design Decisions

### Why Redis Pub/Sub?

With 4 ECS container instances behind a load balancer, a user connected to Container-1 and another on Container-3 would not receive each other's messages without a message broker.

Redis Pub/Sub solves this by broadcasting messages across all container instances in real time:

```
User A (Container-1)
      ↓ publishes message
   Redis channel
      ↓ broadcasts to all subscribers
Container-1, Container-2, Container-3, Container-4
      ↓
User B (Container-3) receives message ✅
```

### Message Types

| Type           | Description                 | Delivery               |
| -------------- | --------------------------- | ---------------------- |
| Group Message  | Sent to a named room        | All users in that room |
| Direct Message | Sent to a specific username | That user only         |
| Broadcast      | Sent to everyone            | All connected users    |

### Network Architecture

```
┌─────────────────────────────────────────┐
│                  VPC                    │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ Public Sub 1 │  │ Public Sub 2 │    │
│  │    ALB       │  │    ALB       │    │
│  └──────┬───────┘  └──────┬───────┘    │
│         │                 │            │
│  ┌──────▼───────┐  ┌──────▼───────┐    │
│  │ Private Sub 1│  │ Private Sub 2│    │
│  │  ECS Tasks   │  │  ECS Tasks   │    │
│  │  ElastiCache │  │              │    │
│  └──────────────┘  └──────────────┘    │
│         ↓                              │
│    NAT Gateway → Internet              │
└─────────────────────────────────────────┘
```

---

## 🔒 Security

- ECS tasks run in **private subnets** — not directly accessible from the internet
- All inbound traffic flows through **ALB only**
- Secrets stored in **AWS Parameter Store** (SecureString) — never in source code
- **IAM roles** with least-privilege access per service
- **Security groups** enforce strict traffic rules between services
- ECR images scanned on push for vulnerabilities

---

## 📈 Observability

| What              | How                                      |
| ----------------- | ---------------------------------------- |
| Container logs    | CloudWatch Log Groups (`/ecs/schat`)     |
| CPU usage         | CloudWatch Metric Alarm (threshold: 80%) |
| Memory usage      | CloudWatch Metric Alarm (threshold: 80%) |
| Health checks     | ALB Target Group `/health` endpoint      |
| Deployment status | ECS service events                       |

---

## 🔄 SRE Practices

- **Health check endpoint** (`GET /health`) — ALB removes unhealthy containers automatically
- **Desired count: 4** — high availability across 2 Availability Zones
- **Rolling deployment** — zero downtime updates via ECS deployment circuit breaker
- **Infrastructure as Code** — reproducible, version-controlled, auditable infrastructure
- **Automated CI/CD** — every push to main triggers a full build and deploy
- **Immutable infrastructure** — new Docker image per deployment (tagged with git SHA)
- **Least-privilege IAM** — each service has only the permissions it needs

---

## 🌐 GitHub Actions Secrets Required

| Secret                  | Description                      |
| ----------------------- | -------------------------------- |
| `AWS_ACCESS_KEY_ID`     | IAM user access key              |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key              |
| `MONGO_URI`             | MongoDB Atlas connection string  |
| `BACKEND_URL`           | ALB DNS name for frontend config |

---

## 👤 Author

**Surya Parua**

- GitHub: [@suryaparua-official](https://github.com/suryaparua-official)
