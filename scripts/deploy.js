async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const GasOracle = await ethers.getContractFactory("GasOracle");
  const gasOracle = await GasOracle.deploy();

  await gasOracle.deployed();

  console.log("GasOracle deployed to:", gasOracle.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 