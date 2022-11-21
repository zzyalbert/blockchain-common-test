const { ethers, BigNumber } = require('ethers')
const axios = require('axios')
const fs = require('fs')
const os = require("os")
const WorkerPool = require('./worker_pool/worker_pool.js')

const broadcastUrls = require('./load_config').load_from_json('rpc')
const privateKey = require('./load_config').load_from_json('privateKey')

const provider = new ethers.providers.JsonRpcProvider(broadcastUrls[0])
let providers = []

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
const inactiveAccNum = require('./load_config').load_from_json('inactiveAccNum')

const taskReplayNum = require('./load_config').load_from_json('taskReplayNum')

const rawTransferBatchNum = require('./load_config').load_from_json('rawTransferBatchNum')
const erc20BatchNum = require('./load_config').load_from_json('erc20BatchNum')
const swapBatchNum = require('./load_config').load_from_json('swapBatchNum')

const accountBatchNum = require('./load_config').load_from_json('accountBatchNum')
const batchSize = taskRoutineNum * (rawTransferBatchNum + erc20BatchNum + swapBatchNum)
const pairNum = require('./load_config').load_from_json('pairNum')

const sendBatch = require('./load_config').load_from_json('sendBatch')


const tokenNum = pairNum * 2
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
let subAccounts = []
var stats = new Array(broadcastUrls.length)
var old_stats = new Array(broadcastUrls.length) 

async function main() {
    let network = await provider.getNetwork()
    chainId = network.chainId
    // construct providers
    for (const url of broadcastUrls) {
        providers.push(new ethers.providers.JsonRpcProvider(url))
    }

    const accountCount = accountBatchNum * taskRoutineNum;
    const pool = new WorkerPool(os.cpus().length);
    // create keypair
    let finished = 0
    let ws = fs.createWriteStream('account_store')

    console.log('creat keypair.....')
    start = process.uptime()
    for(let i =0; i < accountCount; i++) {
        pool.runTask(i, (err, priv) => {
            // console.log(i, err, result)
            subAccounts.push(new ethers.Wallet(priv))
            ws.write(priv + os.EOL)
            if (++finished === accountCount) {
                pool.close()
                ws.close()
            }
        })
    }
    while (finished != accountCount) {await sleep(200)}

    end = process.uptime()
    console.log('creat keypair finished,  cost: ', end - start)

    for (let i = 0; i < pairNum; i++) {
        tokenAddrs[i] = require('./save_deployed_output').load_from_json(`token${i}`)
        tokenAddrs[i + pairNum] = require('./save_deployed_output').load_from_json(`token${i + pairNum}`)
        tokens[i] = new ethers.Contract(tokenAddrs[i], erc20Abi, provider)
        tokens[i + pairNum] = new ethers.Contract(tokenAddrs[i + pairNum], erc20Abi, provider)

        routerAddrs[i] = require('./save_deployed_output').load_from_json(`router${i}`)
        routers[i] = new ethers.Contract(routerAddrs[i], routerAbi, provider)
    }

    let txs = []
    godNonce = await provider.getTransactionCount(godAccount.address)

    console.log('god account approve......')
    for (let i = 0; i < routers.length; i++) {
        let rawTx = await erc20Approve(tokens[i], godAccount, routers[i].address, ethers.utils.parseEther("100000000000000000000000"), gasPrice, godNonce++)
        txs.push(rawTx)

        rawTx = await erc20Approve(tokens[i + pairNum], godAccount, routers[i].address, ethers.utils.parseEther("100000000000000000000000"), gasPrice, godNonce++)
        txs.push(rawTx)
    }

    await sendTxs(0, txs)

    txs = []
    console.log('god account add liquidity......')
    for (let i = 0; i < routers.length; i++) {
        let unsignedTx = await routers[i].populateTransaction.addLiquidity(tokenAddrs[i], tokenAddrs[i + pairNum], ethers.utils.parseEther("100"), ethers.utils.parseEther("100"), 100, 100, godAccount.address, deadline)
        let estimate = await provider.estimateGas({
            from: godAccount.address,
            gasPrice,
            chainId: chainId,
            nonce: godNonce + 1,
            ...unsignedTx
        })
        // console.log(estimate.toString())

        let rawTx = await godAccount.signTransaction({
            from: godAccount.address,
            gasLimit: estimate.mul(15).div(10),
            gasPrice,
            nonce: godNonce++,
            chainId: chainId,
            ...unsignedTx
        })

        txs.push(rawTx)
    }

    await sendTxs(0, txs)
    
    // create seed account
    console.log('transfer eth and erc20 token to seed account.....')
    t1 = process.uptime();
    await creat_seed_accounts(0, subAccounts.slice(0, taskRoutineNum))
    t2 = process.uptime();
    console.log('transfer to seed account finished, cost ', t2-t1)

    // seed account approve for swap contract
    console.log('seed account approve for swap contract.....')
    t1 = process.uptime();
    await approve_for_swap(0, subAccounts.slice(0, taskRoutineNum))
    t2 = process.uptime();
    console.log('seed account approve finished, cost ', t2-t1)

    for (let i = 0; i < stats.length; i++) {
        stats[i] = 0
        old_stats[i] = 0
    }

    // print stats
    const intervalObj = setInterval(print_stats, 3000)

    
    let tasks = []
    // transfer eth and erc20 token to active account
    console.log('transfer eth and erc20 token to active account.....')
    t1 = process.uptime();
    for (let i = 1; i < accountBatchNum; i++) {
        sStart = (i - 1) * taskRoutineNum / accountBatchNum
        sEnd = sStart + (taskRoutineNum / accountBatchNum)
        tStart = taskRoutineNum * i
        tEnd = tStart + taskRoutineNum
        console.log('start: ', sStart, 'end: ', sEnd)
        tasks.push(creat_active_accounts(i, subAccounts.slice(sStart, sEnd), subAccounts.slice(tStart, tEnd)))
    }
    await Promise.all(tasks)
    t2 = process.uptime();
    console.log('transfer to active account finished, cost ', t2-t1)

    task = []
    // active account approve for swap contract
    console.log('active account approve for swap contract.....')
    t1 = process.uptime();
    for (let i = 1; i < accountBatchNum; i++) {
        start = taskRoutineNum * i
        end = start + taskRoutineNum
        tasks.push(approve_for_swap(i, subAccounts.slice(start, end)))
    }
    await Promise.all(tasks)
    t2 = process.uptime();
    console.log('active account approve finished, cost ', t2-t1)

/*
    tasks = []
    // transfer eth to  create inactive account
    console.log('transfer eth to inactive account.....')
    t1 = process.uptime();
    for (let i = 1; i < accountBatchNum; i++) {
        sStart = (i - 1) * taskRoutineNum / accountBatchNum
        sEnd = sStart + (taskRoutineNum / accountBatchNum)
        tStart = inactiveAccNum * i
        tEnd = tStart + inactiveAccNum
        tasks.push(creat_inactive_accounts(i, subAccounts.slice(sStart, sEnd), tStart, tEnd))
    }

    await Promise.all(tasks)
    t2 = process.uptime();
    console.log('transfer eth to inactive account finished, cost ', t2-t1)
*/
    clearInterval(intervalObj)
}

function print_stats() {
    console.log('**********************************************************')
    for (let i = 0; i < stats.length; i++) {
        console.log('had sent to provider%d: %d txs, new %d txs', i, stats[i], stats[i]-old_stats[i])
        old_stats[i] = stats[i]
    }
    console.log('**********************************************************')
}

async function creat_active_accounts(batchNo, senderAccounts, toAccounts) {
    const index = batchNo % broadcastUrls.length
    // const index = Math.floor(Math.random() * broadcastUrls.length)
    const senderNum = senderAccounts.length
    let rawTx
    let txs = []

    // delay random time to prevent from flood send in the same time
    await sleep(Math.random() * 1000)

    // seed account had approved 2 tokens contract
    let nonces = new Array(senderNum)
    for (let i = 0; i < senderNum; i++) nonces[i] = await providers[index].getTransactionCount(senderAccounts[i].address)

    for (let start = 0; start < taskRoutineNum; start += sendBatch) {
        let end = start + sendBatch
        if (end > taskRoutineNum) {
            end = taskRoutineNum
        }
        let sendNum = end - start

        console.log('index%d: creat active account batchNo%d, (%d, %d) begin', index, batchNo, start, end)
        t1 = process.uptime()
        
        txs = []
        for (let i = start; i < end; i++) {
            // transfer eth
            rawTx = await eoa(senderAccounts[i%senderNum], toAccounts[i].address, ethers.utils.parseEther("10000"), gasPrice, nonces[i%senderNum]++)
            txs.push(rawTx)

            // transfer erc20 token to sender
            rawTx = await erc20Transfer(tokens[0], senderAccounts[i%senderNum], toAccounts[i].address, ethers.utils.parseEther("10000"), gasPrice, nonces[i%senderNum]++)
            txs.push(rawTx)

            rawTx = await erc20Transfer(tokens[1], senderAccounts[i%senderNum], toAccounts[i].address, ethers.utils.parseEther("10000"), gasPrice, nonces[i%senderNum]++)
            txs.push(rawTx)
        }
        t2 = process.uptime()
        console.log('batchNo%d: prepare %d txs, cost', batchNo, sendNum, t2 - t1)

        t1 = process.uptime()
        if (txs.length > 0) await sendTxs(index, txs)
        stats[index] += sendNum

        t2 = process.uptime()
        console.log('index%d: creat active account batchNo%d, (%d, %d) end, cost ', index, batchNo, start, end, t2-t1)
    
    }
    
    console.log('index%d, creat active accounts batchNo%d finished', index, batchNo)
}

async function creat_seed_accounts(batchNo, toAccounts) {
    const index = batchNo % broadcastUrls.length
    // const index = Math.floor(Math.random() * broadcastUrls.length)
    const amount = (accountBatchNum + 1) * 10000;
    let rawTx
    let txs = []

    for (let start = 0; start < taskRoutineNum; start += sendBatch) {
        let end = start + sendBatch
        if (end > taskRoutineNum) {
            end = taskRoutineNum
        }

        console.log('creat seed account batchNo%d, (%d, %d) begin', batchNo, start, end)

        txs = []
        for (let i = start; i < end; i++) {
            // transfer eth
            rawTx = await eoa(godAccount, toAccounts[i].address, ethers.utils.parseEther(amount.toString()), gasPrice, godNonce++)
            txs.push(rawTx)

            // transfer erc20 token to sender
            rawTx = await erc20Transfer(tokens[0], godAccount, toAccounts[i].address, ethers.utils.parseEther(amount.toString()), gasPrice, godNonce++)
            txs.push(rawTx)

            rawTx = await erc20Transfer(tokens[1], godAccount, toAccounts[i].address, ethers.utils.parseEther(amount.toString()), gasPrice, godNonce++)
            txs.push(rawTx)
        }

        if (txs.length > 0) await sendTxs(index, txs)
        console.log('creat seed account batchNo%d, (%d, %d) end', batchNo, start, end)
    }

    console.log('creat seed account batchNo%d finished', batchNo)
}

async function approve_for_swap(batchNo, accounts) {
    const index = batchNo % broadcastUrls.length
    // const index = Math.floor(Math.random() * broadcastUrls.length)
    let rawTx
    let txs = []

    // delay random time to prevent from flood send in the same time
    await sleep(Math.random() * 1000)

    for (let start = 0; start < taskRoutineNum; start += sendBatch) {
        let end = start + sendBatch
        if (end > taskRoutineNum) {
            end = taskRoutineNum
        }
        let sendNum = end - start

        console.log('approve for swap batchNo%d: (%d, %d) begin', batchNo, start, end)

        txs = []
        for (let i = start; i < end; i++) {
            // sender approve erc20 token for swap contract
            rawTx = await erc20Approve(tokens[0], accounts[i], routers[0].address, ethers.utils.parseEther("100000000000000000000000"), gasPrice, 0)
            txs.push(rawTx)

            rawTx = await erc20Approve(tokens[1], accounts[i], routers[0].address, ethers.utils.parseEther("100000000000000000000000"), gasPrice, 1)
            txs.push(rawTx)
        }

        if (txs.length > 0) await sendTxs(index, txs)
        stats[index] += sendNum
        console.log('approve for swap batchNo%d: (%d, %d) end', batchNo, start, end)
    }

    console.log('approve for swap batchNo%d finished', batchNo)
}

function generateAddress(offset) {
    const newAddress = addressBase.add(offset).toHexString()
    return newAddress
}

async function creat_inactive_accounts(batchNo, senderAccounts, iStart, iEnd) {
    const index = batchNo % broadcastUrls.length
    // const index = Math.floor(Math.random() * broadcastUrls.length)
    const senderNum = senderAccounts.length
    let rawTx
    let txs = []

    // delay random time to prevent from flood send in the same time
    await sleep(Math.random() * 1000)

    let nonces = new Array(senderNum)
    for (let i = 0; i < nonces.length; i++) nonces[i] = await providers[index].getTransactionCount(senderAccounts[i].address)

    for (let start = iStart; start < iEnd; start += sendBatch) {
        let end = start + sendBatch
        if (end > iEnd) {
            end = iEnd
        }
        let sendNum = end - start

        console.log('index%d: creat inactive account batchNo%d, (%d, %d) begin', index, batchNo, start, end)
        t1 = process.uptime();

        txs = []
        for (let i = start; i < end; i++) {
            rawTx = await eoa(senderAccounts[i%senderNum], generateAddress(i), ethers.utils.parseEther('1', 'wei'), gasPrice, nonces[i%senderNum]++)
            txs.push(rawTx)
        }

        if (txs.length > 0) await sendTxs(index, txs)
        stats[index] += sendNum
        t2 = process.uptime();
        console.log('index%d: creat inactive account batchNo%d, (%d, %d) end, cost ', index, batchNo, start, end, t2-t1)
    }

    console.log('index%d: creat inactive accounts batchNo%d finished', index, batchNo)
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
    unsignedTx.gasLimit = 1000000
    unsignedTx.gasPrice = gasPrice
    unsignedTx.nonce = nonce
    unsignedTx.chainId = chainId
    return await fromAccount.signTransaction(unsignedTx)
}

async function erc20Approve(token, fromAccount, to, value, gasPrice, nonce) {
    unsignedTx = await token.populateTransaction.approve(to, value)
    unsignedTx.from = fromAccount.address
    unsignedTx.gasLimit = 1000000
    unsignedTx.gasPrice = gasPrice
    unsignedTx.nonce = nonce
    unsignedTx.chainId = chainId
    return await fromAccount.signTransaction(unsignedTx)
}

async function swap(router, fromAccount, gasPrice, path, amountIn, nonce) {
    unsignedTx = await router.populateTransaction.swapExactTokensForTokens(amountIn, 1, path, fromAccount.address, deadline)
    unsignedTx.from = fromAccount.address
    unsignedTx.gasLimit = 5000000
    unsignedTx.gasPrice = gasPrice
    unsignedTx.nonce = nonce
    unsignedTx.chainId = chainId
    return await fromAccount.signTransaction(unsignedTx)
}

async function sendTxs(index, txs) {
    await batchBroadcast(index, txs)
    await getTransactionReceiptUntilNotNull(index, ethers.utils.keccak256(txs[txs.length - 1]), async () => {
		await sleep(3000)
		await batchBroadcast(index, txs)
	})
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTransactionReceiptUntilNotNull(index, hash, funcWithLoop) {
    let receipt
    while (!receipt) {
        try {
            receipt = await providers[index].getTransactionReceipt(hash)
        } catch (err) {
        }
        if (funcWithLoop) {
            await funcWithLoop()
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
            console.log("send tx error due to network")
        }
        await sleep(1000)
    }
}

main().then(console.log).catch(console.error)
