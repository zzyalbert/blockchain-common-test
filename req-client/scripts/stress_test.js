const { ethers, BigNumber } = require('ethers')
const axios = require('axios')
const fs = require('fs')
const readline = require('readline')

const broadcastUrls = require('./load_config').load_from_json('rpc')
const privateKey = require('./load_config').load_from_json('privateKey')

const provider = new ethers.providers.JsonRpcProvider(broadcastUrls[0])

//TODO contract call
const erc20Abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function balanceOf(address) view returns (uint)",
    "function transfer(address to, uint amount)",
    "function approve(address to, uint amount)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
]

const routerAbi = [
    "function addLiquidity(address, address, uint, uint, uint, uint, address, uint)",
    "function swapExactTokensForTokens(uint, uint, address[], address, uint)"
]

// num of tasks in parallel, max is 8
const taskRoutineNum = require('./load_config').load_from_json('taskRoutineNum')
const taskReplayNum = require('./load_config').load_from_json('taskReplayNum')

const accountBatchNum = require('./load_config').load_from_json('accountBatchNum')

const pairNum = require('./load_config').load_from_json('pairNum')
const sendBatch = require('./load_config').load_from_json('sendBatch')


const rawTransferSize = require('./load_config').load_from_json('rawTransferSize')
const erc20TransferSize = require('./load_config').load_from_json('erc20TransferSize')

var tokenAddrs = new Array(pairNum * 2);
var tokens = new Array(pairNum);

var routerAddrs = new Array(pairNum);
var routers = new Array(pairNum);

const deadline = Math.floor(Date.now() / 1000) + 1000000

const gasPrice = ethers.utils.parseUnits('200', 'gwei')

const godAccount = new ethers.Wallet(privateKey)
const addressBase = BigNumber.from(godAccount.address).add(100000)
let godNonce
let chainId
let providers = []

var stats = new Array(broadcastUrls.length)
var old_stats = new Array(broadcastUrls.length)


async function main() {
    let network = await provider.getNetwork()
    chainId = network.chainId

    for (const url of broadcastUrls) {
        providers.push(new ethers.providers.JsonRpcProvider(url))
    }

    godNonce = await provider.getTransactionCount(godAccount.address)

    for (let i = 0; i < pairNum; i++) {
        tokenAddrs[i] = require('./save_deployed_output').load_from_json(`token${i}`)
        tokenAddrs[i + pairNum] = require('./save_deployed_output').load_from_json(`token${i + pairNum}`)
        tokens[i] = new ethers.Contract(tokenAddrs[i], erc20Abi, provider)
        tokens[i + pairNum] = new ethers.Contract(tokenAddrs[i + pairNum], erc20Abi, provider)

        routerAddrs[i] = require('./save_deployed_output').load_from_json(`router${i}`)
        routers[i] = new ethers.Contract(routerAddrs[i], routerAbi, provider)
    }

    // from and to account
    const accountCount = accountBatchNum * taskRoutineNum;

    begin = process.uptime()
    console.log('get account from file')
    // read account
    let subAccounts = []
    rs = fs.createReadStream('account_store')
    let rl = readline.createInterface({
        input: rs,
    })

    let cnt = 0;
    rl.on('line', (priv) => {
        subAccounts.push(new ethers.Wallet(priv))
        cnt++
    });

    while (cnt != accountCount) { await sleep(200) }
    rl.close()

    end = process.uptime()
    console.log('get accounts finished,  cost: ', end - begin)


    let tasks = []
    let toAccounts = []
    console.log('begin stress press....')
    for (let i = 0; i < accountBatchNum; i++) {
        start = taskRoutineNum * i
        end = start + taskRoutineNum
        // console.log([start,end])
        for (let j = start; j < end; j++) {
            toAccounts.push(generateAddress(j))
        }

        tasks.push(sendTx(i, subAccounts.slice(start, end), toAccounts))
    }

    for (let i = 0; i < stats.length; i++) {
        stats[i] = 0
        old_stats[i] = 0
    }

    // print stats
    const intervalObj = setInterval(print_stats, 3000)

    //start stress test
    await Promise.all(tasks)

    // clear interval
    clearInterval(intervalObj)
}

function print_stats() {
    console.log('**********************************************************')
    for (let i = 0; i < stats.length; i++) {
        console.log('had sent to provider%d: %d txs, new %d txs', i, stats[i], stats[i] - old_stats[i])
        old_stats[i] = stats[i]
    }
    console.log('**********************************************************')
}

function generateAddress(offset) {
    const newAddress = addressBase.add(offset).toHexString()
    return newAddress
}


async function sendTx(batchNo, senderAccounts, toAccounts) {
    let txs = []
    let rawTx

    // console.log([senderAccounts, toAccounts])
    // const index = Math.floor(Math.random() * broadcastUrls.length)
    // distribute txs to specified node
    const index = batchNo % broadcastUrls.length
    const senderNum = senderAccounts.length

    // delay random time to prevent from flood send in the same time
    await sleep(Math.random() * 1000)

    console.log('index%d, batchNo%d stress start', index, batchNo)
    console.log('index%d, batchNo%d get nonce start', index, batchNo)
    t1 = process.uptime();
    let nonces = new Array(senderNum)
    for (let i = 0; i < senderNum; i++) nonces[i] = await providers[index].getTransactionCount(senderAccounts[i].address)
    t2 = process.uptime();
    console.log('index%d, batchNo%d get nonce end, cost ', index, batchNo, t2 - t1)


    console.log(`index%d, batchNo%d clean up tx pool start`, index, batchNo)
    t1 = process.uptime();
    for (let sendStart = 0; sendStart < senderNum; sendStart += sendBatch) {
        let sendEnd = sendStart + sendBatch
        if (sendEnd > senderNum) {
            sendEnd = senderNum
        }

        txs = []
        for (let j = sendStart; j < sendEnd; j++) {
            let rawTx = await eoa(senderAccounts[j], senderAccounts[j].address, ethers.utils.parseEther("1"), gasPrice.mul(2), nonces[j]++)
            txs.push(rawTx)
        }

        if (txs.length > 0) await sendTxs(index, txs)
    }
    t2 = process.uptime();
    console.log(`index%d, batchNo%d clean up tx pool end, cost `, index, batchNo, t2 - t1)

    let rawTransferNum
    let erc20TransferNum
    let sendSize = 0

    let round = 0
    while (true) {
        for (let sendStart = 0; sendStart < senderNum; sendStart += sendBatch) {
            let sendEnd = sendStart + sendBatch
            if (sendEnd > senderNum) {
                sendEnd = senderNum
            }

            sendSize = sendEnd - sendStart
            rawTransferNum = rawTransferSize * sendSize / 100;
            erc20TransferNum = erc20TransferSize * sendSize / 100

            txs = []
            t1 = process.uptime();
            for (let j = sendStart; j < sendEnd; j++) {
                if (j % sendSize < rawTransferNum) {
                    rawTx = await eoa(senderAccounts[j], toAccounts[j], ethers.utils.parseUnits('1', 'wei'), gasPrice, nonces[j])
                } else if (j % sendSize < (rawTransferNum + erc20TransferNum)) {
                    rawTx = await erc20Transfer(tokens[0], senderAccounts[j], toAccounts[j], ethers.utils.parseUnits('1', 'wei'), gasPrice, nonces[j])
                } else {
                    token0Addr = tokenAddrs[0]
                    token1Addr = tokenAddrs[1]
                    rawTx = await swap(routers[0], senderAccounts[j], gasPrice, Math.random() < 0.5 ? [token0Addr, token1Addr] : [token1Addr, token0Addr], 100, nonces[j])
                }

                nonces[j] = nonces[j] + 1
                txs.push(rawTx)
            }

            if (txs.length > 0) await sendTxs(index, txs)

            stats[index] += sendSize

            t2 = process.uptime();
            console.log(`index%d, batchNo%d tx online for round%d, cost `, index, batchNo, round++, t2 - t1)
        }
    }
}




async function eoa(fromAccount, to, value, gasPrice, nonce) {
    return await fromAccount.signTransaction({
        from: fromAccount.address,
        to,
        value: ethers.utils.parseUnits(value + '', 'wei'),
        gasLimit: 30000,
        gasPrice,
        nonce,
        chainId: chainId
    })
}

async function erc20Transfer(token, fromAccount, to, value, gasPrice, nonce) {
    unsignedTx = await token.populateTransaction.transfer(to, value)
    unsignedTx.from = fromAccount.address
    unsignedTx.gasLimit = 100000
    unsignedTx.gasPrice = gasPrice
    unsignedTx.nonce = nonce
    unsignedTx.chainId = chainId
    return await fromAccount.signTransaction(unsignedTx)
}

async function erc20Approve(token, fromAccount, to, value, gasPrice, nonce) {
    unsignedTx = await token.populateTransaction.approve(to, value)
    unsignedTx.from = fromAccount.address
    unsignedTx.gasLimit = 100000
    unsignedTx.gasPrice = gasPrice
    unsignedTx.nonce = nonce
    unsignedTx.chainId = chainId
    return await fromAccount.signTransaction(unsignedTx)
}

async function swap(router, fromAccount, gasPrice, path, amountIn, nonce) {
    unsignedTx = await router.populateTransaction.swapExactTokensForTokens(amountIn, 1, path, fromAccount.address, deadline)
    unsignedTx.from = fromAccount.address
    unsignedTx.gasLimit = 500000
    unsignedTx.gasPrice = gasPrice
    unsignedTx.nonce = nonce
    unsignedTx.chainId = chainId
    return await fromAccount.signTransaction(unsignedTx)
}


async function sendTxs(index, txs) {
    await batchBroadcast(index, txs)
    await getTransactionReceiptUntilNotNull(index, ethers.utils.keccak256(txs[txs.length - 1]), async () => {
        // await batchBroadcast(index, txs)
    })
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTransactionReceiptUntilNotNull(index, hash, funcWithLoop) {
    let receipt
    let i = 0
    while (!receipt) {
        try {
            receipt = await providers[index].getTransactionReceipt(hash)
        } catch (err) {
        }
        if (!receipt && funcWithLoop && ++i % 30 == 0) {
            await funcWithLoop()
        } else {
            await sleep(100)
        }
    }

    return receipt
}

async function batchBroadcast(index, data) {
    let i = 0

    async function inner(index, data) {
        let resp = await axios.post(broadcastUrls[index], data.map(d => ({
            id: i++,
            jsonrpc: "2.0",
            method: "eth_sendRawTransaction",
            params: [
                d
            ]
        })), {
            timeout: 20000
        })

        resp.data.forEach(r => {
            if ((r.error && r.error.message !== 'nonce too low' && r.error.message !== 'already known')) {
                console.log('send tx err', r.error.message)
            }
        });

        return resp
    }

    while (true) {
        try {
            return await inner(index, data)
        } catch (err) {
            console.log("network error")
        }
        await sleep(1000)
    }
}

main().then(console.log).catch(console.error)
