#!/bin/bash
# Author: Zhong Ziyuan
# Date  : 2021 / 06 / 07

nodekeyhex=16610d196773cddf9a1ff8f15263417cb5ea7a2ba8fd60505c770f439f91439b
#address=0x1B5813bAA493742CEe5d2Eb7410b3014fe3cf2b6
address=0xB5C6a317F2A4CA4298CCfB7C9EeE256e24C6EAA0

function init() {
    ./geth --config conf/config.toml init conf/genesis.json \
    && ./geth --config conf/config.toml account import --password conf/accountpassword conf/privatekey
}

function start() {
    ./geth --config conf/config.toml --miner.etherbase $address --mine --unlock $address --password conf/accountpassword   --nodekeyhex $nodekeyhex  --verbosity 3 --logpath=./log > /dev/null &
}

function stop() {
    ps -ef | grep geth | grep mine | grep -v grep | awk '{ print $2 }' | xargs kill
}

function status() {
    pid=`ps -ef | grep geth | grep $address | grep -v grep | awk '{ print $2 }'`
    info=`grep 'Imported new chain\|Successfully sealed' log/chain.log | tail -1`
    echo "{pid: $pid} $info"
}

function clean() {
    rm -rf log*/*
    rm -rf ./.ethereum*
    rm -rf ./.ethash
}

function help() {
    cat << EOF
Usage:
    $0 [operation]

operation:
    init
    start
    stop
    init_sync
    start_sync
    stop_sync
    status
    metrics
    clean
EOF
}

if [[ $1 == 'init' ]];then
    echo [init cube]
    init
elif [[ $1 == 'start' ]];then
    echo [start cube]
    start
elif [[ $1 == 'stop' ]];then
    echo [stop cube]
    stop
elif [[ $1 == 'clean' ]];then
    echo [clear cube]
    clean
elif [[ $1 == 'status' ]];then
    status
else
    help
    exit -1
fi
