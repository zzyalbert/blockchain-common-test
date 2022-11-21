#!/bin/bash

function print_usage() {
    cat << EOF

[Usage]
./rpc.sh [url] [json params]
         show
         help

EOF
}

function show() {
    cat <<EOF
curl https://http-mainnet-us.cube.network -H 'content-type: application/json' --data-raw '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":0}'
EOF
}

# arg1: url
# arg2: json data
function rpc() {
    url=$1
    curl $url -H 'content-type: application/json' --data-raw ${@:2}
}

if [[ $1 == 'show' ]];then
    show
elif [[ $1 == '-h' || $1 == '--help' || $1 == 'help' ]];then
    print_usage
else
    rpc $@
fi
