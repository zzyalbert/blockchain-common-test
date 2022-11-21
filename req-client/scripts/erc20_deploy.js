// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const resultSave = require('./save_deployed_output')

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile 
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const ERC20Basic = await hre.ethers.getContractFactory("ERC20Basic");
  var pairNum = require('./load_config').load_from_json('pairNum')
  for (var i = 0; i < pairNum * 2; i++) {
    let gasPrice = ethers.utils.parseUnits("2.5", "gwei");
    const erc20 = await ERC20Basic.deploy({ gasPrice });
    await erc20.deployed();

    resultSave.save_to_json(`token${i}`, erc20.address)
    console.log(`token${i} deployed to:`, erc20.address);
  }

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

module.exports = {
  deploy: main
}