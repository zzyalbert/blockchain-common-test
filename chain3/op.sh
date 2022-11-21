#!/bin/bash
# Author: Zhong Ziyuan
# Date  : 2021 / 06 / 07

nodekeyhex=c8b3e55d37c97c6a97c279f3d67180a0a6ef16e2022020dfc0eee0ef712fdef9
#address=0x7cc9898981ba71059765470a4E973Aba2e3d7864
address=0x0B239651d14b5BA9e9ED36f6F8c8A1AB19d4f812

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
