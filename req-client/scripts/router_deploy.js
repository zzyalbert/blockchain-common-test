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
  const Router = await hre.ethers.getContractFactory("MdexRouter");
  var pairNum = require('./load_config').load_from_json('pairNum')
  for (var i = 0; i < pairNum; i++) {
    let gasPrice = ethers.utils.parseUnits("2.5", "gwei");
    const router = await Router.deploy(resultSave.load_from_json(`factory${i}`), resultSave.load_from_json('wht'),{ gasPrice });
    await router.deployed();

    resultSave.save_to_json(`router${i}`, router.address)
    console.log(`router${i} deployed to:`, router.address);
  }
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