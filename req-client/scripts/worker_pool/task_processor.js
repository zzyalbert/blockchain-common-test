const { parentPort } = require('worker_threads');
const { ethers } = require('ethers');

const mnemonic = "hold logic flash camp card margin current pledge odor nasty average rack"
const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic)

parentPort.on('message', (id) => {
  parentPort.postMessage(hdNode.derivePath(`m/44'/60'/0'/0/${id}`).privateKey);
});

