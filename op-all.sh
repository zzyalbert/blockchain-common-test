#!/bin/bash
# Author: Zhong Ziyuan
# Date  : 2021 / 06 / 07

chains=(chain1 chain2 chain3)

function all_chains() {
    for dir in ${chains[@]};do
        echo "[ $dir ]"
        cd $dir && $@
        cd ..
        echo
    done
}

function init() {
    for dir in ${chains[@]};do
        echo "[ $dir ]"
        cd $dir && rm -rf data log/* && ./op.sh init
        cd ..
        echo
    done
}

function start() {
    all_chains ./op.sh start
}

function stop() {
    ps -ef | grep geth | grep mine | grep -v grep | awk '{ print $2 }' | xargs kill
}

function status() {
    all_chains ./op.sh status
}

function clean() {
    all_chains rm -rf log/*
}

function help() {
    cat << EOF
Usage:
    $0 [operation]

operation:
    init
    start
    stop
    status
    metrics
    clean
EOF
}

if [[ $1 == 'init' ]];then
    init
elif [[ $1 == 'start' ]];then
    start
elif [[ $1 == 'stop' ]];then
    stop
elif [[ $1 == 'clean' ]];then
    clean
elif [[ $1 == 'status' ]];then
    echo [show cube status]
    status
else
    help
    exit -1
fi
