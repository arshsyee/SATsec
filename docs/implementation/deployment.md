# Implementation: Production Deployment

**Current AWS Architecture**

```
Users → CloudFront (E228OJOX97DHP0)
              ↓
         S3 Bucket (satsec-frontend-923503242158)   [React build]
              
Users → App Runner / EC2
              ↓
         Docker (backend/Dockerfile)               [FastAPI + uvicorn]
              ↓
         RDS PostgreSQL  (or SQLite for dev)
              ↓
         AWS SES  (email)
```

---

## Environment Variables (Production)

```
# backend/.env (production)
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/satsec
JWT_SECRET=<strong-random-secret>
ANTHROPIC_API_KEY=sk-ant-...
SATSEC_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
AWS_DEFAULT_REGION=us-east-2
```

---

## Deploy Frontend

```bash
# From frontend/
npm run build
aws s3 sync dist/ s3://satsec-frontend-923503242158 --delete
aws cloudfront create-invalidation --distribution-id E228OJOX97DHP0 --paths "/*"
```

---

## Deploy Backend

```bash
# From backend/
docker build -t satsec-backend .
docker tag satsec-backend:latest <ecr-repo-url>:latest
docker push <ecr-repo-url>:latest
# App Runner auto-deploys on new image push (if configured)
```

---

## Database: SQLite → PostgreSQL Migration

The code already supports PostgreSQL via `DATABASE_URL`. On first run against a new Postgres DB:
- SQLAlchemy `create_all()` will create all tables automatically
- No manual migration needed for a fresh database
- For existing SQLite data: export to CSV, import to Postgres

---

## Checklist for First Production Deploy

- [ ] RDS PostgreSQL instance created (db.t3.micro is enough to start)
- [ ] Security group: RDS only accepts connections from App Runner / EC2
- [ ] SES out of sandbox mode (24-48h approval)
- [ ] Sending domain verified in SES
- [ ] CloudFront pointing to correct S3 bucket
- [ ] `JWT_SECRET` is a strong random string (not the dev default)
- [ ] `ANTHROPIC_API_KEY` set
- [ ] Test signup → OTP → login flow end-to-end in production

---

## Local Dev (Quick Start)
```bash
# Backend
cd backend && uvicorn main:app --reload

# Frontend
cd frontend && npm run dev
```
SQLite (`satsec.db`) is auto-created in backend/ on first run.
