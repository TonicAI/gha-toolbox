#!/bin/bash
set -e

PING_TARGET="${INPUT_PING_TARGET}"
DNS_SERVERS="${INPUT_DNS_SERVERS}"
EXPLICIT_ROUTES="${INPUT_EXPLICIT_ROUTES}"

sudo apt-get update
sudo apt-get --assume-yes --no-install-recommends install openvpn

echo "VPN Client Install Complete"

echo "$INPUT_VPN_CONFIG" > github_action.ovpn
echo "$INPUT_DEV_PEM" > dev.pem
chmod 600 dev.pem

sudo openvpn --config "github_action.ovpn" --log "vpn.log" --daemon

if [ ! -z "${EXPLICIT_ROUTES}" ]; then
  echo "Updating routing tables"
  ip route
  for route in ${EXPLICIT_ROUTES}; do
    sudo ip route add "${route}" dev tun0
  done
  echo "Configured table"
  ip route
fi

if [ ! -z "${DNS_SERVERS}" ]; then
    echo "Configuring DNS to use ${DNS_SERVERS}"
    sudo sed -i "s/#DNS=/DNS=${DNS_SERVERS}/g" /etc/systemd/resolved.conf
    sudo systemctl daemon-reload
    sudo systemctl restart systemd-networkd
    sudo systemctl restart systemd-resolved
fi

if [ ! -z "${PING_TARGET}" ]; then
  echo "Waiting to make connection to ping target..."
  until ping -c1 "${PING_TARGET}"; do sleep 2; done
  echo "Contact made"
fi
