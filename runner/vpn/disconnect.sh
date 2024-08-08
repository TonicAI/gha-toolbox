#!/bin/sh

echo "Removing sensitive files..."
[ ! -e dev.pem ] || rm dev.pem
[ ! -e github_action.ovpn ] || rm github_action.ovpn

echo "Disconnecting..."

sudo pkill openvpn;
echo -e "VPN Log: \n"
sudo cat vpn.log
