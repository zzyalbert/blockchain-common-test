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
  const WHT = await hre.ethers.getContractFactory("WHT");
  let gasPrice = ethers.utils.parseUnits("2.5", "gwei");
  const wht = await WHT.deploy({ gasPrice });

  await wht.deployed();

  resultSave.save_to_json('wht', wht.address)
  console.log("wht deployed to:", wht.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

module.exports = {
  deploy: main
}
