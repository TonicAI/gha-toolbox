#!/bin/bash
set -e

PING_TARGET="${INPUT_PING_TARGET}"
DNS_SERVERS="${INPUT_DNS_SERVERS}"

sudo apt-get update
sudo apt-get --assume-yes --no-install-recommends install openvpn

echo "VPN Client Install Complete"

echo "$INPUT_VPN_CONFIG" > github_action.ovpn
echo "$INPUT_DEV_PEM" > dev.pem
chmod 600 dev.pem

sudo openvpn --config "github_action.ovpn" --log "vpn.log" --daemon


if [ ! -z "${DNS_SERVERS}" ]; then
    sudo sed -i "s/#DNS=/DNS=${DNS_SERVERS}/g" /etc/systemd/resolved.conf
    sudo systemctl daemon-reload
    sudo systemctl restart systemd-networkd
    sudo systemctl restart systemd-resolved
fi

if [ ! -z "${PING_TARGET}" ]; then
  until ping -c1 "${PING_TARGET}"; do sleep 2; done
fi
