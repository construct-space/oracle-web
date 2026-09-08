#!/bin/sh
# Oracle frontend entrypoint.
# 1. Validates required env vars.
# 2. Renders nginx.conf.template → /etc/nginx/conf.d/default.conf via envsubst.
# 3. Validates config with nginx -t, then exec's the CMD.
set -eu

if [ -z "${ORACLE_API_UPSTREAM:-}" ]; then
    echo '{"level":"fatal","service":"oracle-frontend","msg":"missing required env var","var":"ORACLE_API_UPSTREAM"}' >&2
    exit 1
fi

# Only expand the vars we explicitly reference — otherwise envsubst would eat
# nginx's own $host, $remote_addr, etc.
VARS='${ORACLE_API_UPSTREAM}'

mkdir -p /etc/nginx/conf.d
envsubst "$VARS" < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

nginx -t

echo '{"level":"info","service":"oracle-frontend","msg":"starting","api_upstream":"'"$ORACLE_API_UPSTREAM"'"}'

exec "$@"
