#!/usr/bin/env bash
#
# Deploy sales-intel to the EC2 host.
#
# Access is via EC2 Instance Connect rather than a stored key pair: a throwaway
# keypair is generated here, its public half is pushed to the instance for 60
# seconds, and port 22 is opened to this machine's IP only. Nothing long-lived
# is created, and the private key never leaves this machine.
#
#   ./scripts/deploy-aws.sh
#
set -euo pipefail

INSTANCE_ID="${INSTANCE_ID:-i-05629e19ade477c7c}"
REGION="${AWS_REGION:-ap-south-1}"
AZ="${AZ:-ap-south-1a}"
SG_ID="${SG_ID:-sg-025e0c4dc3b8b36f0}"
KEY="${KEY:-$HOME/.ssh/sales-intel-deploy}"

# The public hostname, once DNS points at this box. Bot providers refuse plain
# http webhooks, so until this is set the deployment cannot receive transcripts.
#   DEPLOY_DOMAIN=sales.contextwindowhq.com ./scripts/deploy-aws.sh
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-}"

# The public site, when it lives on a different hostname to the app. Marketing
# on the apex and the product on a subdomain keeps a stranger off app routes.
#   DEPLOY_MARKETING_DOMAIN=contextwindowhq.com
DEPLOY_MARKETING_DOMAIN="${DEPLOY_MARKETING_DOMAIN:-}"

# Which bot backend the deployed app uses. Defaults to `noop` — a deployment
# with no Attendee reachable should refuse to send bots rather than fail on
# every meeting.
DEPLOY_BOT_PROVIDER="${DEPLOY_BOT_PROVIDER:-noop}"

# Where the bot provider should send webhooks. When Attendee runs on this same
# host, its containers reach the app over the private network far more reliably
# than by going out to the public address and back in — and it removes the
# dependency on public DNS and TLS entirely.
#   DEPLOY_WEBHOOK_BASE_URL=http://172.31.39.240
DEPLOY_WEBHOOK_BASE_URL="${DEPLOY_WEBHOOK_BASE_URL:-}"

# The audio bridge is a separate sidecar that this stack does not deploy. Its
# local URL would otherwise carry over from .env, and the bot would then open a
# websocket to a port nothing is listening on — which can fail the join outright
# rather than degrade. Set it only when the bridge genuinely runs on the host.
DEPLOY_AUDIO_BRIDGE_URL="${DEPLOY_AUDIO_BRIDGE_URL:-}"

cd "$(dirname "$0")/.."

# Credentials come from .env so this matches how everything else here runs.
# `tail -1` matches dotenv: a key repeated in .env takes its last value. Without
# it a duplicated line yields both values joined by a newline, which AWS rejects
# as an invalid header rather than as bad credentials.
export AWS_ACCESS_KEY_ID="$(grep '^ACCESS_KEY=' .env | tail -1 | cut -d= -f2-)"
export AWS_SECRET_ACCESS_KEY="$(grep '^SECRET_KEY=' .env | tail -1 | cut -d= -f2-)"
export AWS_DEFAULT_REGION="$REGION"

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "ACCESS_KEY/SECRET_KEY are missing from .env." >&2
  echo "They must belong to the account that owns $INSTANCE_ID." >&2
  exit 1
fi

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

step "Resolving the instance"
HOST=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[].Instances[].PublicIpAddress' --output text)
echo "    $INSTANCE_ID at $HOST"

step "Preparing a throwaway keypair"
[ -f "$KEY" ] || ssh-keygen -t ed25519 -N "" -f "$KEY" -C "sales-intel-deploy" >/dev/null
echo "    $KEY"

step "Opening port 22 to this machine only"
MYIP=$(curl -s --max-time 10 https://checkip.amazonaws.com | tr -d '\n')
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --protocol tcp --port 22 --cidr "$MYIP/32" >/dev/null 2>&1 \
  && echo "    opened to $MYIP/32" || echo "    already open for $MYIP/32"

# EC2 Instance Connect keys are valid for 60 seconds. A docker build on a
# 2-vCPU host takes minutes, so the key must be re-pushed before each remote
# command rather than once at the start.
push_key() {
  aws ec2-instance-connect send-ssh-public-key \
    --instance-id "$INSTANCE_ID" --instance-os-user ec2-user \
    --availability-zone "$AZ" --ssh-public-key "file://$KEY.pub" >/dev/null
}

SSH_OPTS="-i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15"

# Every remote call re-authorises first, so a long-running step can never be
# stranded by an expired key.
remote() { push_key; ssh $SSH_OPTS "ec2-user@$HOST" "$@"; }
copy()   { push_key; scp -q $SSH_OPTS "$@"; }

step "Waiting for the bootstrap to finish"
for i in $(seq 1 30); do
  if remote 'test -f /opt/sales-intel/BOOTSTRAP_COMPLETE' 2>/dev/null; then
    echo "    ready"; break
  fi
  sleep 10
done

step "Copying the application"
# Source only — node_modules and .next are rebuilt on the host, and the local
# .env points at localhost so it would be wrong there anyway.
push_key
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude '.env' --exclude 'pgdata' \
  -e "ssh $SSH_OPTS" \
  ./ "ec2-user@$HOST:/opt/sales-intel/app/"
echo "    copied"

step "Writing the production environment"
# Built here from the local .env, with the values that must differ in
# production overridden. Written straight to the host over ssh so it never
# exists as a file on this machine.
python3 - "$HOST" "$DEPLOY_DOMAIN" "$DEPLOY_BOT_PROVIDER" "$DEPLOY_WEBHOOK_BASE_URL" "$DEPLOY_AUDIO_BRIDGE_URL" "$DEPLOY_MARKETING_DOMAIN" <<'PYEOF' > /tmp/env.production
import pathlib, sys
host, domain, bot_provider, webhook_base = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
audio_bridge = sys.argv[5]
marketing = sys.argv[6]
# Once DNS resolves, everything public must be https: Google will not redirect
# OAuth back to a bare IP, and bot providers reject plain-http webhooks.
origin = f"https://{domain}" if domain else f"http://{host}"
keep = {}
for line in pathlib.Path(".env").read_text().split("\n"):
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    keep[k] = v            # later duplicates win, matching dotenv

# Production overrides. Everything else carries over from local.
keep.update({
    "NODE_ENV": "production",
    "APP_URL": origin,
    # Postgres runs on the host, reached from inside the container.
    "DATABASE_URL": "postgres://sales:sales@host.docker.internal:5432/sales_intel",
    # Attendee also runs on this host.
    "ATTENDEE_BASE_URL": "http://host.docker.internal:8000",
    # Ollama serves the embedding model and is a service in the production
    # compose file, so it resolves by name. The schema default is `localhost`,
    # which inside the app container means the container itself — a connection
    # refused on a service that is in fact running.
    "EMBEDDING_BASE_URL": "http://ollama:11434/v1",
    "WEBHOOK_BASE_URL": webhook_base or origin,
    "BOT_PROVIDER": bot_provider,
})

# Two hostnames, one deployment. The cookie has to be readable on both or the
# public site cannot tell a signed-in visitor from a stranger — scoped to the
# registrable domain, which is the app host minus its first label.
if marketing:
    keep["MARKETING_URL"] = f"https://{marketing}"
    keep["COOKIE_DOMAIN"] = "." + marketing
else:
    keep.pop("MARKETING_URL", None)
    keep.pop("COOKIE_DOMAIN", None)

# Present only when the bridge is actually deployed. Carrying the local value
# over points every bot at a socket that is not there.
if audio_bridge:
    keep["AUDIO_BRIDGE_URL"] = audio_bridge
else:
    keep.pop("AUDIO_BRIDGE_URL", None)
print("\n".join(f"{k}={v}" for k, v in keep.items()))
PYEOF
copy /tmp/env.production "ec2-user@$HOST:/opt/sales-intel/app/.env.production"
shred -u /tmp/env.production 2>/dev/null || rm -f /tmp/env.production
echo "    written to the host"

step "Building the image on the host"
# Built on the host so the architecture matches; building here would produce
# arm64 for an x86 machine.
# BuildKit is what makes the cache mounts in the Dockerfile work; without it
# they are silently ignored and every build reinstalls from scratch.
remote 'set -eux; cd /opt/sales-intel/app && DOCKER_BUILDKIT=1 docker build -t sales-intel:latest .'

step "Applying database migrations"
# Run from the build stage, which still has the full dependency tree and tsx.
# The runtime image deliberately does not — it only carries what the app needs
# to serve requests.
#
# Tagged out of the same build as the app image rather than built again: every
# layer is already in the cache, but a second `docker build` still re-resolves
# the whole graph, which is minutes on a 2-vCPU host.
remote 'set -eux; cd /opt/sales-intel/app \
  && DOCKER_BUILDKIT=1 docker build --target build -t sales-intel:build . \
  && docker run --rm --network host \
       -e DATABASE_URL="postgres://sales:sales@localhost:5432/sales_intel" \
       sales-intel:build npx tsx src/db/migrate.ts'

step "Starting the stack"
# SITE_ADDRESS turns Caddy's TLS on. Passed at compose time rather than baked
# into the Caddyfile so the same file works before and after DNS exists.
# The internal host is whatever DEPLOY_WEBHOOK_BASE_URL points at, so Caddy
# always serves plain HTTP on exactly the address the bot provider posts to.
SITE_INTERNAL=$(printf '%s' "$DEPLOY_WEBHOOK_BASE_URL" | sed -E 's#^https?://##; s#/.*$##')
# Both site addresses must be non-empty: Caddy cannot parse a block with no
# address, and an empty value is not the same as an unset one. Without a public
# domain the app answers on :80; without a marketing domain the second block
# gets a local-only name so it parses and simply never matches a real request.
SITE_ADDR="${DEPLOY_DOMAIN:-:80}"
if [ -n "$DEPLOY_MARKETING_DOMAIN" ]; then
  SITE_MKT="$DEPLOY_MARKETING_DOMAIN, www.$DEPLOY_MARKETING_DOMAIN"
else
  SITE_MKT="http://marketing.localhost"
fi
remote "set -eux; cd /opt/sales-intel/app && SITE_ADDRESS='$SITE_ADDR' SITE_MARKETING='$SITE_MKT' SITE_INTERNAL='${SITE_INTERNAL:-localhost}' docker compose -f docker-compose.prod.yml up -d"
sleep 8
remote 'docker ps --format "  {{.Names}}: {{.Status}}"'

step "Done"
echo "    app:  http://$HOST"
echo "    close port 22 when finished:"
echo "      aws ec2 revoke-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr $MYIP/32"
