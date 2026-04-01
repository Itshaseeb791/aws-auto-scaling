#  Notepad API — AWS EC2 Auto Scaling Group Practice

A minimal Node.js + MongoDB REST API designed specifically to practice AWS EC2 Auto Scaling Groups (ASG).

---

## API Endpoints

| Method | Path         | Description              |
|--------|--------------|--------------------------|
| GET    | `/health`    | Health check (use for ALB target group) |
| POST   | `/notes`     | Save a new note          |
| GET    | `/notes`     | Retrieve all notes       |
| GET    | `/notes/:id` | Retrieve a single note   |

### Save a note
```bash
curl -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{"title": "My First Note", "content": "Hello from EC2!"}'
```

### Retrieve all notes
```bash
curl http://localhost:3000/notes
```

Each response includes a `servedBy` field (the hostname) — useful to confirm different ASG instances are serving requests.

---

## Local Development

```bash
docker compose up --build
```

App runs at `http://localhost:3000`

---

## AWS Deployment Guide

### Architecture
```
Internet → ALB (port 80) → Target Group → EC2 instances (ASG)
                                               └── Docker: Node API (:3000)
                                               └── Docker: MongoDB (:27017)
```

> **Note:** For a real production setup, use MongoDB Atlas or Amazon DocumentDB instead of a local MongoDB container. For this ASG practice, the local container is fine.

---

### Step 1 — Push your code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/notepad-app.git
git push -u origin main
```

Update the clone URL in `ec2-user-data.sh`.

---

### Step 2 — Create a Security Group

Allow inbound:
- Port **22** (SSH) — your IP only
- Port **3000** (or **80** if using ALB) — from ALB security group
- Port **80** — from internet (ALB only)

---

### Step 3 — Create a Launch Template

1. Go to **EC2 → Launch Templates → Create**
2. AMI: **Amazon Linux 2023**
3. Instance type: `t3.micro` (free tier)
4. Security group: the one from Step 2
5. Advanced → **User data**: paste contents of `ec2-user-data.sh`

---

### Step 4 — Create an Application Load Balancer (ALB)

1. EC2 → Load Balancers → Create → **Application Load Balancer**
2. Scheme: **Internet-facing**
3. Listener: HTTP port 80
4. Create a **Target Group**:
   - Target type: Instances
   - Protocol: HTTP, Port: **3000**
   - Health check path: `/health`
   - Healthy threshold: 2, interval: 10s

---

### Step 5 — Create the Auto Scaling Group

1. EC2 → Auto Scaling Groups → Create
2. Select your **Launch Template**
3. Select your **VPC and subnets** (pick 2+ AZs)
4. Attach to your **ALB Target Group**
5. Health check type: **ELB**
6. Capacity:
   - Minimum: 1
   - Desired: 2
   - Maximum: 4
7. Scaling policy (optional for practice):
   - Target tracking → CPU utilization → 50%

---

### Step 6 — Test It

```bash
# Get ALB DNS name from console, then:
curl http://YOUR-ALB-DNS/health
curl -X POST http://YOUR-ALB-DNS/notes \
  -H "Content-Type: application/json" \
  -d '{"title": "ASG Test", "content": "This came from an auto-scaled instance!"}'
curl http://YOUR-ALB-DNS/notes
```

Watch the `servedBy` field rotate between different instance hostnames as the ALB distributes traffic.

---

### Step 7 — Practice Scaling

- **Scale out**: Terminate an instance manually → ASG replaces it automatically
- **Scale in**: Reduce desired capacity → ASG terminates an instance
- **Load test**: Use `ab` or `hey` to spike CPU and trigger the scaling policy
  ```bash
  # Install hey: https://github.com/rakyll/hey
  hey -n 10000 -c 100 http://YOUR-ALB-DNS/notes
  ```

---

## Environment Variables

| Variable    | Default                          | Description        |
|-------------|----------------------------------|--------------------|
| `PORT`      | `3000`                           | App listen port    |
| `MONGO_URI` | `mongodb://mongo:27017/notepad`  | MongoDB connection |
