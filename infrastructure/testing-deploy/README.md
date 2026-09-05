# Testing-only AWS deploy

Gets the whole FitCloud stack running on one AWS EC2 instance for real
end-to-end testing — not a production setup. No load balancer, no HTTPS
beyond a single certbot cert, no managed database, no container registry,
no autoscaling/replicas. Intentionally the simplest thing that works, so it
fits comfortably inside a free-tier account's $200/6-month credit. A real
production deploy (registry images, RDS, ElastiCache, TLS at a load
balancer, replicas) would look meaningfully different from this — this
setup is not meant to be reused as that starting point.

## What it sets up

- One S3 bucket (real AWS, replacing MinIO) + a scoped IAM user for file
  uploads (avatars, exercise images, documents, receipts).
- One EC2 instance (`t3.small` by default) running:
  - Postgres, Redis, Mailpit in Docker (same `docker-compose.yml` you already
    use locally — zero drift from dev).
  - The API, tenant-web, and super-admin apps as plain Node processes
    (`pnpm build` + `pm2`), not containers — the repo's containerized
    "production" compose expects a registry and managed DB/cache, which is
    more than a testing box needs.
- A stable Elastic IP, exposed as a **[sslip.io](https://sslip.io)**
  hostname (e.g. `13-233-45-67.sslip.io`) instead of a purchased domain —
  `sslip.io` resolves any subdomain of an IP-shaped label back to that IP,
  which is exactly what this app's subdomain-per-tenant routing
  (`{slug}.<domain>`) needs to work in a browser.

## Why NODE_ENV=development on the server

The API sets refresh-token cookies as `Secure` (HTTPS-only) and does strict
CORS-origin matching only when `NODE_ENV=production`. This deploy is plain
HTTP (no TLS box was set up — deliberately, since it's for testing, not a
client-facing deploy), so `Secure` cookies would silently break login, and a
strict allowlist would have to be updated by hand for every new test
tenant's subdomain. Running with `NODE_ENV=development` keeps cookies
working over HTTP and auto-allows any `{slug}.<sslip-domain>` origin.
**Don't reuse this instance for anything beyond throwaway testing** — this
is an intentional relaxation, not a hardening gap in the app itself.

## Prerequisites

- AWS CLI v2 installed and configured (`aws configure`) with an IAM
  user/role that can create S3 buckets, IAM users, EC2 instances, security
  groups, and Elastic IPs. Your free-tier account's default permissions are
  enough for a personal account.
- `rsync` installed locally (used to push the repo to the instance).

## Usage

```bash
cd infrastructure/testing-deploy
cp config.env.example config.env   # edit if you want a different region/bucket name/instance size

./01-setup-s3.sh       # S3 bucket + IAM user + access key -> credentials.txt
./02-launch-ec2.sh     # security group + key pair + EC2 + Elastic IP -> appends to credentials.txt
./03-deploy-app.sh     # syncs the repo, builds, migrates, starts everything via pm2
```

Each script is safe to re-run — they skip anything that already exists.
`03-deploy-app.sh` is also how you push local changes later: edit code,
re-run it, it re-syncs/rebuilds/restarts without touching your existing
database or secrets.

## After it's up

The last script prints your URLs, roughly:

```
API:           http://13-233-45-67.sslip.io:4000/api/v1   (docs: /api/docs)
Tenant portal: http://<slug>.13-233-45-67.sslip.io:3001
Super Admin:   http://13-233-45-67.sslip.io:3002
```

Go through the onboarding wizard at the tenant-portal root to create your
first test gym/tenant, then use its slug for the subdomain going forward.

SSH in with `ssh -i ./fitcloud-test-key.pem ubuntu@<public-ip>`; once
inside, `pm2 status` / `pm2 logs fitcloud-api` for troubleshooting.

## Tearing it down

Nothing here auto-expires. When you're done testing:

```bash
source config.env; source credentials.txt
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"
aws ec2 release-address --allocation-id "$ELASTIC_IP_ALLOCATION_ID"
aws ec2 delete-security-group --group-id "$SECURITY_GROUP_ID"   # after the instance is actually terminated
aws s3 rb "s3://$S3_BUCKET" --force                              # deletes the bucket AND its contents
aws iam delete-user-policy --user-name "$IAM_USER_NAME" --policy-name "${IAM_USER_NAME}-s3-access"
aws iam list-access-keys --user-name "$IAM_USER_NAME"             # then delete-access-key each one, then delete-user
```
