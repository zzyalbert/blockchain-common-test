const { ethers } = require('ethers')
const provider = new ethers.providers.JsonRpcProvider('http://172.26.197.81:8545')

async function main() {
    const b = await provider.getBalance(process.argv[2])
    console.log(b)
}

main().then(console.log).catch(console.error)
