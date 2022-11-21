require("@nomiclabs/hardhat-waffle");

// require("@nomiclabs/hardhat-truffle5");
// require("@nomiclabs/hardhat-solpp");

const prodConfig = {

    Mainnet: true,
}

const devConfig = {
    Mainnet: false,
}

const contractDefs = {
    mainnet: prodConfig,
    devnet: devConfig
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          evmVersion:"istanbul",
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
    ],
  },
  networks: {
    dev: {
      url: 'http://127.0.0.1:8645',
      accounts: ['18d0e978eb248ab339bcae087c3a07b19d23f01e6fae7a99f3d5cbc977e1bd2b']  
    }
  }
};

