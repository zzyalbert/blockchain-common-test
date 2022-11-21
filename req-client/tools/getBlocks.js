const { ethers, BigNumber } = require('ethers')
const provider = new ethers.providers.JsonRpcProvider('http://172.26.197.81:8545')

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    let cnt = 0;
    while (true) {
        await provider.getBlock('latest').then(console.log)
        await sleep(3000)
        if (cnt++ > 1000) {
            cnt  = 0;
            console.log('1000 blocks average gas')
        }
    }
}

main().then(console.log).catch(console.error)
