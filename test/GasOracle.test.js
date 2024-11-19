const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GasOracle", function () {
  let gasOracle;
  let owner;
  let validator1;
  let validator2;
  let nonValidator;
  const MINIMUM_STAKE = ethers.utils.parseEther("0.5");

  beforeEach(async function () {
    [owner, validator1, validator2, nonValidator] = await ethers.getSigners();
    
    const GasOracle = await ethers.getContractFactory("GasOracle");
    gasOracle = await GasOracle.deploy();
    await gasOracle.deployed();
  });

  describe("Staking", function () {
    it("should allow staking with sufficient ETH", async function () {
      await expect(gasOracle.connect(validator1).stakeToValidate({ value: MINIMUM_STAKE }))
        .to.emit(gasOracle, "ValidatorStaked")
        .withArgs(validator1.address, MINIMUM_STAKE);

      const stake = await gasOracle.validatorStakes(validator1.address);
      expect(stake).to.equal(MINIMUM_STAKE);
    });

    it("should reject staking with insufficient ETH", async function () {
      const lowStake = ethers.utils.parseEther("0.1");
      await expect(
        gasOracle.connect(validator1).stakeToValidate({ value: lowStake })
      ).to.be.revertedWith("Insufficient stake");
    });

    it("should reject double staking", async function () {
      await gasOracle.connect(validator1).stakeToValidate({ value: MINIMUM_STAKE });
      await expect(
        gasOracle.connect(validator1).stakeToValidate({ value: MINIMUM_STAKE })
      ).to.be.revertedWith("Already staked");
    });
  });

  describe("Gas Price Submission", function () {
    beforeEach(async function () {
      await gasOracle.connect(validator1).stakeToValidate({ value: MINIMUM_STAKE });
    });

    it("should allow validators to submit gas prices", async function () {
      const basePrice = ethers.utils.parseUnits("50", "gwei");
      const priorityPrice = ethers.utils.parseUnits("2", "gwei");

      await expect(gasOracle.connect(validator1).submitGasPrice(basePrice, priorityPrice))
        .to.emit(gasOracle, "GasPriceUpdated")
        .withArgs(basePrice, priorityPrice, await getLatestBlockTimestamp());
    });

    it("should reject submissions from non-validators", async function () {
      await expect(
        gasOracle.connect(nonValidator).submitGasPrice(100, 10)
      ).to.be.revertedWith("Not a validator");
    });

    it("should reject invalid price submissions", async function () {
      await expect(
        gasOracle.connect(validator1).submitGasPrice(0, 10)
      ).to.be.revertedWith("Invalid prices");
    });

    it("should update prices within deviation threshold", async function () {
      const basePrice = ethers.utils.parseUnits("50", "gwei");
      const priorityPrice = ethers.utils.parseUnits("2", "gwei");

      await gasOracle.connect(validator1).submitGasPrice(basePrice, priorityPrice);

      // Submit new prices within 10% deviation
      const newBasePrice = basePrice.mul(105).div(100); // 5% increase
      const newPriorityPrice = priorityPrice.mul(105).div(100); // 5% increase

      await expect(gasOracle.connect(validator1).submitGasPrice(newBasePrice, newPriorityPrice))
        .to.emit(gasOracle, "GasPriceUpdated");
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await gasOracle.connect(validator1).stakeToValidate({ value: MINIMUM_STAKE });
    });

    it("should allow validators to unstake", async function () {
      const initialBalance = await validator1.getBalance();
      
      const tx = await gasOracle.connect(validator1).unstake();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      const finalBalance = await validator1.getBalance();
      expect(finalBalance).to.be.closeTo(
        initialBalance.add(MINIMUM_STAKE).sub(gasCost),
        ethers.utils.parseUnits("0.0001", "ether") // Allow for small rounding differences
      );
    });

    it("should reject unstaking from non-validators", async function () {
      await expect(
        gasOracle.connect(nonValidator).unstake()
      ).to.be.revertedWith("No stake found");
    });
  });

  describe("Gas Price Queries", function () {
    it("should return correct gas prices", async function () {
      await gasOracle.connect(validator1).stakeToValidate({ value: MINIMUM_STAKE });
      
      const basePrice = ethers.utils.parseUnits("50", "gwei");
      const priorityPrice = ethers.utils.parseUnits("2", "gwei");

      await gasOracle.connect(validator1).submitGasPrice(basePrice, priorityPrice);

      const [returnedBase, returnedPriority, timestamp] = await gasOracle.getGasPrice();
      expect(returnedBase).to.equal(basePrice);
      expect(returnedPriority).to.equal(priorityPrice);
      expect(timestamp).to.be.gt(0);
    });
  });
});

// Helper function to get latest block timestamp
async function getLatestBlockTimestamp() {
  const latestBlock = await ethers.provider.getBlock("latest");
  return latestBlock.timestamp;
} 