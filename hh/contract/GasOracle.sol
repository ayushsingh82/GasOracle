// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract GasOracle is Ownable, ReentrancyGuard {
    uint256 public constant MINIMUM_STAKE = 500000000000000000; // 0.5 ether in wei
    uint256 public constant MAX_DEVIATION = 10; // 10% maximum deviation

    struct GasData {
        uint256 basePrice;
        uint256 priorityPrice;
        uint256 timestamp;
    }

    mapping(address => uint256) public validatorStakes;
    GasData public latestGasData;

    event ValidatorStaked(address indexed validator, uint256 amount);
    event ValidatorUnstaked(address indexed validator, uint256 amount);
    event GasPriceUpdated(uint256 basePrice, uint256 priorityPrice, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    modifier onlyValidator() {
        require(validatorStakes[msg.sender] >= MINIMUM_STAKE, "Not a validator");
        _;
    }

    function stakeToValidate() external payable {
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        require(validatorStakes[msg.sender] == 0, "Already staked");
        
        validatorStakes[msg.sender] = msg.value;
        emit ValidatorStaked(msg.sender, msg.value);
    }

    function submitGasPrice(uint256 basePrice, uint256 priorityPrice) external onlyValidator {
        require(basePrice > 0 && priorityPrice > 0, "Invalid prices");

        if (latestGasData.basePrice > 0 && latestGasData.priorityPrice > 0) {
            uint256 baseDeviation = calculateDeviation(basePrice, latestGasData.basePrice);
            uint256 priorityDeviation = calculateDeviation(priorityPrice, latestGasData.priorityPrice);
            require(baseDeviation <= MAX_DEVIATION && priorityDeviation <= MAX_DEVIATION, "Price deviation too high");
        }

        latestGasData = GasData({
            basePrice: basePrice,
            priorityPrice: priorityPrice,
            timestamp: block.timestamp
        });

        emit GasPriceUpdated(basePrice, priorityPrice, block.timestamp);
    }

    function unstake() external nonReentrant onlyValidator {
        uint256 amount = validatorStakes[msg.sender];
        require(amount > 0, "No stake found");

        validatorStakes[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit ValidatorUnstaked(msg.sender, amount);
    }

    function getGasPrice() external view returns (uint256, uint256, uint256) {
        require(latestGasData.timestamp > 0, "No gas data available");
        return (
            latestGasData.basePrice,
            latestGasData.priorityPrice,
            latestGasData.timestamp
        );
    }

    function calculateDeviation(uint256 newPrice, uint256 oldPrice) internal pure returns (uint256) {
        require(oldPrice > 0, "Old price cannot be zero");
        if (newPrice > oldPrice) {
            return ((newPrice - oldPrice) * 100) / oldPrice;
        }
        return ((oldPrice - newPrice) * 100) / oldPrice;
    }

    receive() external payable {}
} 