#!/bin/sh
# vim:sw=4:ts=4:et
set -e
# Runs after 20-envsubst-on-templates.sh (envsubst only knows the image's baked-in env, not
# runtime exports). Replaces the resolver placeholder in the rendered nginx config with the
# container's actual DNS nameservers, read from /etc/resolv.conf.
ME=$(basename "$0")

DEFAULT_CONF=/etc/nginx/conf.d/default.conf
if [ ! -f "$DEFAULT_CONF" ]; then
    echo "$ME: info: $DEFAULT_CONF not found, nothing to do"
    exit 0
fi

RESOLVERS=$(awk '/^nameserver/{ r=$2; if (r ~ /:/) r="[" r "]"; printf "%s ", r }' /etc/resolv.conf | sed 's/ $//')
if [ -z "$RESOLVERS" ]; then
    echo "$ME: warn: no nameservers found in /etc/resolv.conf, leaving placeholder in place"
    exit 0
fi

sed -i "s/__NGINX_RESOLVERS__/$RESOLVERS/" "$DEFAULT_CONF"
echo "$ME: info: using DNS resolvers: $RESOLVERS"
