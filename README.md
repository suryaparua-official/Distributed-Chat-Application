# Schat — Distributed Real-Time Chat Application

A production-grade distributed messaging system supporting direct messages, group chat, and broadcast — built with Node.js and React, deployed on AWS with full Infrastructure as Code and CI/CD automation.                                           |

---

## Application Screenshots

<img width="1902" height="858" alt="Screenshot 2026-05-30 165531" src="https://github.com/user-attachments/assets/8c8daf3c-d708-4cb8-bc6e-3ffaac11fabd" />

<img width="1918" height="905" alt="Screenshot 2026-05-30 165347" src="https://github.com/user-attachments/assets/0a7bf9fe-7d31-4747-ba30-6b527654c23a" />

<img width="1919" height="856" alt="Screenshot 2026-05-30 165631" src="https://github.com/user-attachments/assets/2b5c8c96-7287-412f-9a32-6a524d057a1c" />

---

## Architecture

```
                         Internet
                             |
                    CloudFront CDN
                    /             \
               S3 (React)     ALB (API + WebSocket)
                                   |
                    +--------------+--------------+
                    |              |              |
               ECS Task 1    ECS Task 2    ECS Task N
               (Fargate)     (Fargate)     (Fargate)
                    |              |              |
                    +--------------+--------------+
                                   |
                    +--------------+--------------+
                    |                             |
             MongoDB Atlas                  Upstash Redis
          (chat persistence)              (Pub/Sub messaging)
```

Every ECS task subscribes to Redis Pub/Sub channels. When a message arrives on any container, Redis broadcasts it to all other containers so every connected client receives it regardless of which container they are on.

---

## Features

- Real-time messaging over WebSocket (Socket.IO) with automatic polling fallback
- Direct messages (unicast) — private between two users
- Group chat (multicast) — named rooms, creator-managed membership
- Broadcast — system-wide messages to all connected users
- Distributed pub/sub — multiple ECS containers stay in sync via Redis
- Persistent chat history — all messages stored in MongoDB Atlas
- Status updates — 12-hour expiring stories visible to all users
- WebRTC voice and video calls — peer-to-peer via Socket.IO signaling
- JWT authentication — 15-minute access tokens with 7-day rotating refresh tokens
- Auto scaling — ECS service scales from 2 to 10 tasks based on CPU utilization
- Zero-downtime deployments — rolling update via ECS deployment circuit breaker

---

## Tech Stack

### Application

| Layer           | Technology                        |
| --------------- | --------------------------------- |
| Frontend        | React 18, Vite, Socket.IO client  |
| Backend         | Node.js, Express, Socket.IO       |
| Database        | MongoDB Atlas (Mongoose ODM)      |
| Cache / Pub-Sub | Redis (Upstash, 4 client pool)    |
| Auth            | JWT (access + refresh token pair) |
| Real-time       | WebSocket with polling fallback   |

### AWS Infrastructure

| Service      | Configuration                                          |
| ------------ | ------------------------------------------------------ |
| ECS Fargate  | schat-cluster, desired=4, CPU=256, Memory=512          |
| ALB          | schat-alb, target group port 8080, /health check       |
| Auto Scaling | Min=2, Desired=4, Max=10, CPU threshold                |
| ECR          | schat-backend, keeps last 3 images                     |
| S3           | schat-frontend-335651423655, private, OAC-gated        |
| CloudFront   | E1DBCSJUJFHEK5, API path forwarding to ALB             |
| VPC          | 2 public subnets + 2 private subnets, 2 AZs            |
| NAT Gateway  | Single NAT in ap-south-1a for private subnet egress    |
| IAM          | Separate execution role and task role, least privilege |

### CloudFront Path Routing

| Path Pattern  | Origin | Purpose                  |
| ------------- | ------ | ------------------------ |
| /auth/\*      | ALB    | Authentication endpoints |
| /chat/\*      | ALB    | Message history API      |
| /users/\*     | ALB    | User search and lookup   |
| /groups/\*    | ALB    | Group management         |
| /status/\*    | ALB    | Status updates           |
| /socket.io/\* | ALB    | WebSocket upgrade        |
| /\*           | S3     | React SPA                |

All ALB behaviors forward cookies and headers to support JWT cookie auth and WebSocket upgrades through HTTPS without mixed-content errors.

### DevOps

| Tool           | Purpose                                    |
| -------------- | ------------------------------------------ |
| Terraform      | Modular IaC (modules/environments pattern) |
| Docker         | Multi-stage build, backend only            |
| GitHub Actions | Parallel CI/CD (frontend + backend jobs)   |

---

## Load Test Results

Tested with k6 against the ALB health endpoint simulating 50 concurrent users over 30 seconds.

```
Tool:           k6
Target:         http://schat-alb-1427407801.ap-south-1.elb.amazonaws.com/health
Virtual Users:  50
Duration:       30s

checks_total:       1448
checks_succeeded:   1448  (100.00%)
checks_failed:      0     (0.00%)

http_reqs:          1448  @ 51.77 req/s
http_req_failed:    0.00%

http_req_duration:
  avg:  102.81ms
  min:  104.8µs
  med:  51ms
  max:  6s        (initial cold connection)
  p90:  62.46ms
  p95:  88.18ms

data_received:  472 kB  (17 kB/s)
data_sent:      161 kB  (5.7 kB/s)
```

<img width="799" height="720" alt="Screenshot 2026-05-30 165932" src="https://github.com/user-attachments/assets/aa4b975e-7a83-41be-b121-44885ec08fb1" />

<img width="822" height="746" alt="Screenshot 2026-05-30 165943" src="https://github.com/user-attachments/assets/69d03cf6-cc75-4883-810d-558c5f27b0bb" />

<img width="869" height="169" alt="Screenshot 2026-05-30 165952" src="https://github.com/user-attachments/assets/81fdb079-67a0-4fca-8930-30ba429c4523" />



Zero errors across 1448 requests. The 6s max is an initial TCP connection establishment; steady-state p95 was 88ms. Auto scaling did not trigger at this load level — the 50 VU health-check workload stayed well within the CPU threshold for the 2 running tasks.

---

## Project Structure

```
.
├── backend/
│   ├── app.js                  # Express server, Socket.IO, Redis subscribers
│   ├── middleware/
│   │   └── auth.js             # JWT verification middleware
│   ├── models/
│   │   ├── user.js             # User schema (phone-based identity)
│   │   ├── chat.js             # Message schema (unicast + room)
│   │   ├── group.js            # Group schema with member list
│   │   └── status.js           # Status schema with TTL
│   └── routes/
│       ├── auth.js             # Register, login, refresh, logout
│       ├── users.js            # User search
│       ├── groups.js           # Group CRUD
│       ├── serveChats.js       # Message history (group + DM)
│       └── status.js           # Status fetch
├── frontend/
│   └── src/
│       ├── api.js              # Axios instance, token store, refresh interceptor
│       ├── context/
│       │   ├── AuthContext.jsx # Auth state, token scheduling
│       │   └── ChatContext.jsx # Socket.IO, message state, all real-time events
│       └── components/         # UI components
├── terraform/
│   ├── environments/
│   │   └── prod/
│   │       ├── main.tf         # Module wiring
│   │       ├── variables.tf
│   │       └── terraform.tfvars
│   └── modules/
│       ├── vpc/                # VPC, subnets, IGW, NAT, route tables
│       ├── ecr/                # ECR repository with lifecycle policy
│       ├── iam/                # ECS execution role + task role
│       ├── alb/                # ALB, listener, target group
│       ├── ecs/                # Cluster, task definition, service, auto scaling
│       └── frontend/           # S3, OAC, CloudFront distribution
├── Dockerfile                  # Backend-only image (frontend goes to S3)
└── .github/
    └── workflows/
        └── deploy.yml          # Parallel frontend + backend deployment
```

---

## CI/CD Pipeline

Every push to `main` triggers two parallel GitHub Actions jobs.

```
git push main
    |
    +-- Job 1: Frontend -------------------------+
    |     npm install && npm run build           |
    |     aws s3 sync dist/ → S3                 |
    |     CloudFront invalidation (/*) --------- +
    |
    +-- Job 2: Backend --------------------------+
          docker build -f Dockerfile .           |
          docker push ECR :sha + :latest         |
          describe-task-definition               |
          inject image + MONGO_URI + REDIS_URL   |
               + CORS_ORIGINS + JWT_SECRET       |
          register-task-definition (new rev)     |
          update-service                         |
          wait services-stable ---------------- +
```
<img width="1916" height="608" alt="Screenshot 2026-05-30 154602" src="https://github.com/user-attachments/assets/b1141ec2-ad2e-4e36-9c23-192a60273213" />


Secrets are injected at deploy time directly into the ECS task definition environment — no SSM Parameter Store dependency at runtime (Option A pattern). This eliminates IAM permissions needed for SSM reads inside the container and reduces cold-start latency.

---

## GitHub Actions Secrets

| Secret                     | Description                                        |
| -------------------------- | -------------------------------------------------- |
| AWS_ACCESS_KEY_ID          | schat-deployer IAM user                            |
| AWS_SECRET_ACCESS_KEY      | schat-deployer IAM user                            |
| MONGO_URI                  | mongodb+srv://...@...mongodb.net/SChat             |
| REDIS_URL                  | rediss://default:...@...upstash.io:6379            |
| JWT_SECRET                 | Access token signing secret (HS256)                |
| JWT_REFRESH_SECRET         | Refresh token signing secret (HS256)               |
| VITE_BACKEND_URL           | Empty (space character — CloudFront relative URLs) |
| CLOUDFRONT_URL             | https://d1mj9oo68irblk.cloudfront.net              |
| CLOUDFRONT_DISTRIBUTION_ID | E1DBCSJUJFHEK5                                     |

---

## Deployment Guide

### Prerequisites

- AWS CLI configured (`aws configure`)
- Terraform >= 1.5
- Node.js 22
- Docker

### 1. Infrastructure

```bash
git clone https://github.com/<your-handle>/Distributed-Chat-Application.git
cd Distributed-Chat-Application/terraform/environments/prod

# Edit terraform.tfvars
# project_name = "schat"
# aws_region   = "ap-south-1"

terraform init
terraform plan
terraform apply
```

### 2. GitHub Secrets

Add all secrets listed in the table above to your repository under Settings > Secrets > Actions.

Generate JWT secrets:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
```

### 3. Deploy

```bash
git push origin main
```

The GitHub Actions pipeline deploys frontend and backend in parallel. Monitor progress under the Actions tab. ECS stabilization typically takes 2-3 minutes.

### 4. Verify

```bash
curl http://schat-alb-1427407801.ap-south-1.elb.amazonaws.com/health
# {"status":"ok","server":"SCHAT","redis":"ok","mongodb":"ok"}
```

### 5. Destroy

```bash
# Empty S3 first
aws s3 rm s3://schat-frontend-335651423655 --recursive --region ap-south-1

cd terraform/environments/prod
terraform destroy
```

---

## System Design Notes

### Why Redis Pub/Sub over a message queue?

With multiple ECS containers behind the ALB, Socket.IO connections are distributed across tasks. A message published by a user on Container 1 must reach a user connected to Container 3. Redis Pub/Sub provides sub-millisecond fanout across all subscribers with no message persistence overhead — appropriate for real-time delivery where durability is handled separately by MongoDB.

The backend maintains four Redis clients per instance: one publisher and three dedicated subscribers (chat messages, room list updates, user presence). Sharing a client between pub and sub is not permitted in Redis once a client enters subscribe mode.

### Why Option A for ECS secret injection?

The alternative (SSM Parameter Store at runtime) requires the ECS task to call SSM on startup, adds IAM permissions to the task role, increases cold-start time, and creates a hard dependency on SSM availability. Option A injects secrets as environment variables during the task definition registration step in CI/CD. The secrets live in GitHub Actions secrets (encrypted at rest) and are never stored in the repository or in SSM.

### Token architecture

Access tokens expire in 15 minutes. The frontend schedules a silent refresh 60 seconds before expiry using `setTimeout`. A shared in-flight promise prevents thundering-herd on simultaneous 401s. Refresh tokens are stored as `httpOnly`, `secure`, `sameSite=none` cookies scoped to `/` and expire in 7 days. `sameSite=none` is required because CloudFront and ALB are on different domains — `strict` or `lax` would cause the browser to withhold the cookie on cross-site requests.

### Network isolation

ECS tasks run in private subnets with no inbound internet access. All traffic enters through the ALB in public subnets. Outbound internet access (for MongoDB Atlas and Upstash Redis) goes through a single NAT Gateway in ap-south-1a. Security groups restrict ECS tasks to accept traffic only from the ALB security group on port 8080.

---

## Estimated AWS Cost

| Service                                 | Approx cost per day |
| --------------------------------------- | ------------------- |
| NAT Gateway                             | $1.08               |
| ALB                                     | $0.60               |
| ECS Fargate (4 tasks, CPU=256, Mem=512) | $0.50               |
| CloudFront                              | negligible          |
| S3                                      | negligible          |
| **Total**                               | **~$2.20 / day**    |

Run `terraform destroy` after testing to stop all charges. The NAT Gateway accounts for nearly half the daily cost.

---

## Author

**Surya Parua**
