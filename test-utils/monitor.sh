
cluster_file=~/nodes.txt
function cluster() {
    cat $cluster_file|grep -v '#'
}

function batch() {
    for ip in $(cluster); do
        echo [$ip]
        ssh $ip "$1"
        echo
    done
}

function ps-all() {
    batch "ps -ef | grep geth-|grep -v grep|cut -c 1-89"
}

path_prefix=/hbdata/devnet
function liveness() {
    ps_chain1="ps -ef | grep chain1\/geth-"
    ps_chain2="ps -ef | grep chain2\/geth-"
    grep_pid="grep -v grep | awk '{print \$2}'"
    chain1_log=$path_prefix/chain1/logs/chain.log
    chain2_log=$path_prefix/chain2/logs/chain.log
    grep_last_block="grep 'Imported new chain\|mined potential block' | grep -oE 'number=.*' | tail -n 1"
    remote_cmd="$ps_chain1 | $grep_pid && echo '|' \
            && $ps_chain2 | $grep_pid && echo '|' \
            && cat $chain1_log | $grep_last_block && echo '|' \
            && cat $chain2_log | $grep_last_block"
    remote_cmd1="$ps_chain1 | $grep_pid && echo '|pid2|' && cat $chain1_log | $grep_last_block && echo '|block2'"

    all=$(cluster|wc -l)
    all=$(((all-1)*2+1))
    while true; do
        info=""
        live=0
        for ip in $(cluster); do
            info="$info \n"[$ip]
            if [[ $ip != "172.23.18.5" ]];then
                resp=$(ssh $ip $remote_cmd)
            else
                resp=$(ssh $ip $remote_cmd1)
            fi
            pid1=$(echo `echo $resp | awk -F'|' '{print $1}'`)
            block1=$(echo `echo $resp | awk -F'|' '{print $3}'`)
            if [[ -n $pid1 ]];then
                live=$((live+1))
            else
                pid1="<< DEAD >>"
            fi
            info="$info \n<chain1> pid=$pid1 $block1"
            if [[ $ip != "172.23.18.5" ]];then
                pid2=$(echo `echo $resp | awk -F'|' '{print $2}'`)
                block2=$(echo `echo $resp | awk -F'|' '{print $4}'`)
                if [[ -n $pid2 ]];then
                    live=$((live+1))
                else
                    pid2="<< DEAD >>"
                fi
                info="$info \n<chain2> pid=$pid2 $block2"
            fi
            info="$info \n"
        done
        clear
        echo "Nodes(alive/all): $live/$all"
        echo -e $info
        sleep 3
    done
}
