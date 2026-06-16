#!/usr/bin/env bash
set -euo pipefail

BUCKET="${1:-}"
REGION="${2:-eu-west-1}"
PROFILE="personal"

if [[ -z "$BUCKET" ]]; then
  echo "Usage: $0 <bucket-name> [region]"
  exit 1
fi

echo "==> Bucket: $BUCKET  Region: $REGION  Profile: $PROFILE"

# Create bucket (no-op if it already exists and belongs to this account)
if aws s3api head-bucket --bucket "$BUCKET" --profile "$PROFILE" 2>/dev/null; then
  echo "==> Bucket already exists, skipping creation"
else
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --profile "$PROFILE"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" \
      --profile "$PROFILE"
  fi
  echo "==> Bucket created"
fi

# Unblock public access (required before applying a public bucket policy)
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --profile "$PROFILE"
echo "==> Public access block removed"

# Public-read bucket policy
aws s3api put-bucket-policy \
  --bucket "$BUCKET" \
  --profile "$PROFILE" \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"PublicRead\",
      \"Effect\": \"Allow\",
      \"Principal\": \"*\",
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::${BUCKET}/*\"
    }]
  }"
echo "==> Bucket policy applied"

# Enable static website hosting
aws s3 website "s3://${BUCKET}" \
  --index-document index.html \
  --error-document index.html \
  --profile "$PROFILE"
echo "==> Static website hosting enabled"

echo ""
echo "Website URL: http://${BUCKET}.s3-website-${REGION}.amazonaws.com"
