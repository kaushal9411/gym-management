# Terraform

AWS infrastructure as code. `modules/` holds reusable modules (vpc, rds, redis,
ecs-service, s3, cloudflare); `environments/{staging,production}` compose them
with per-env variables. State backend: S3 + DynamoDB locking (configured per env).
