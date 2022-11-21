#!/bin/bash
# Author: Zhong Ziyuan
# Date  : 2021 / 06 / 07

nodekeyhex=08f0e1dee5c1b4645f3331a566009e41a4514b6cd28656d63d0449ecf812812b
address=0x8cc5a1a0802db41db826c2fcb72423744338dcb0

function init() {
    ./geth --config conf/config.toml init conf/genesis.json \
    && ./geth --config conf/config.toml account import --password conf/accountpassword conf/privatekey
}

function init_sync() {
    ./geth --config conf/config.sync.toml init conf/genesis.json
}

function start() {
    ./geth --config conf/config.toml --miner.etherbase $address --mine --unlock $address --password conf/accountpassword   --nodekeyhex $nodekeyhex  --verbosity 3 --logpath=./log > /dev/null &
}

function start_sync() {
    ./geth --config conf/config.sync.toml --verbosity 3 --logpath=./log_sync \
        --metrics --metrics.addr 0.0.0.0 --metrics.port 19090 \
        --metrics.expensive \
        > /dev/null &
}

function metrics() {
    curl 0.0.0.0:19090/debug/metrics 2> /dev/null
}

function stop() {
    ps -ef | grep geth | grep mine | grep -v grep | awk '{ print $2 }' | xargs kill
}

function stop_sync() {
    ps -ef | grep geth | grep sync | grep -v grep | awk '{ print $2 }' | xargs kill
}

function pprof() {
    go tool pprof -seconds $1 http://127.0.0.1:6060/debug/pprof/profile

}

function show_pprof() {
    pfile=`ls ~/pprof|sort|tail -n 1`
    go tool pprof -http=:8080 ~/pprof/$pfile
}

function status() {
    echo
    echo '[validator]'
    pid=`ps -ef | grep geth | grep mine | grep -v grep | awk '{ print $2 }'`
    info=`grep 'mined potential block' log/chain.log | tail -1`
    echo "{pid: $pid} $info"
    echo
    echo '[sync]'
    pid=`ps -ef | grep geth | grep sync | grep -v grep | awk '{ print $2 }'`
    info=`grep 'Imported new chain segment' log_sync/chain.log | tail -1`
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
    echo [init heco]
    init
elif [[ $1 == 'init_sync' ]];then
    echo [init heco sync]
    init_sync
elif [[ $1 == 'start' ]];then
    echo [start heco]
    start
elif [[ $1 == 'start_sync' ]];then
    echo [start heco sync]
    start_sync
elif [[ $1 == 'stop' ]];then
    echo [stop heco]
    stop
elif [[ $1 == 'stop_sync' ]];then
    echo [stop heco sync]
    stop_sync
elif [[ $1 == 'clean' ]];then
    echo [clear heco]
    clean
elif [[ $1 == 'status' ]];then
    echo [show heco status]
    status
elif [[ $1 == 'metrics' ]];then
    metrics
elif [[ $1 == 'pprof' ]];then
    pprof 10
elif [[ $1 == 'insight' ]];then
    show_pprof
else
    help
    exit -1
fi
