FROM ubuntu:16.04
WORKDIR "/root"

ARG privatekey
ARG password

ADD ./set_up_file  ./

ENV PATH="./:${PATH}"
ENV address=""

RUN echo $password > ~/.accountpassword \
    && echo $privatekey > ~/.privatekey \
    && geth init genesis.json \
    && geth --config config.toml account import --password ~/.accountpassword  ~/.privatekey

CMD exec geth --config config.toml --mine --nousb --miner.etherbase $address --unlock $address --password ~/.accountpassword   

EXPOSE 8545
EXPOSE 8546
EXPOSE 30303


