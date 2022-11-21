#!/bin/bash

env=main
kafka=10.1.24.10:9092
conf_dir=/usr/local/kafka/config

function helpMsg() {
    cat << EOF

[Usage]

$0      zk
                kafka
                kafka-topic
                master
                set-systemd

EOF
}

function setSystemd() {
    work_dir=$(pwd)

    cat << EOF > master.sh
#!/bin/bash
java -cp $work_dir/agent.jar team.chain.monitor.supervisor.Supervisor --bootstrap.servers $kafka --env $env --topic monitor
EOF

    cat << EOF > chain_agent_master.service
Description=cube chain agent master

[Service]
Type=simple
ExecStart=/bin/sh $work_dir/master.sh

LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

    sudo mv chain_agent_master.service /etc/systemd/system/
    sudo systemctl daemon-reload
}

function main() {
    if [[ $1 == 'zk' ]];then
        echo 'start zk'
        zookeeper-server-start.sh $conf_dir/zookeeper.properties &> logs/zk.out &
    elif [[ $1 == 'kafka' ]];then
        echo 'start kafka'
        kafka-server-start.sh $conf_dir/server.properties &> logs/kafka.out &
    elif [[ $1 == 'kafka-topic' ]];then
        echo 'create kafka topic'
        kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic monitor
    elif [[ $1 == 'master' ]];then
        echo 'start master'
        nohup java -cp agent.jar team.chain.monitor.supervisor.Supervisor --bootstrap.servers $kafka --env $env --topic monitor &> logs/master.out &
    elif [[ $1 == 'set-systemd' ]];then
        echo 'set agent master to systemd'
        setSystemd
    else
        helpMsg
    fi
}

main $@
