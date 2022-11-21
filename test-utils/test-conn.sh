#!/bin/bash

iplist=`cat node.txt`

for ip in $iplist;do
        echo "[$ip]"
        ssh $ip "l=\"$iplist\";for ip in \$(echo \$l);do res=\$(nc -vw 0 \$ip 22 2>&1);echo \" --> \$ip: \$res\"; done"
done
