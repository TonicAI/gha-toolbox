#!/bin/sh

echo "Removing sensitive files..."
[ ! -e dev.pem ] || rm dev.pem
[ ! -e github_action.ovpn ] || rm github_action.ovpn

echo "Disconnecting..."

if ! sudo pkill openvpn; then
    echo -e "VPN Log: \n"
    cat vpn.log
fi




