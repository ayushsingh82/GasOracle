// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract GasOracle is Ownable, ReentrancyGuard {
    struct GasData {
        uint256 basePrice;      // Base gas price in wei
        uint256 priorityPrice;  // Priority fee in wei
        uint256 timestamp;      // Timestamp of last update
    }

    // Minimum stake required to become a validator (0.5 ETH)
    uint256 public constant MINIMUM_STAKE = 0.5 ether;
    
    // Maximum deviation allowed between submissions (10%)
    uint256 public constant MAX_DEVIATION = 10;

    // Mapping of validator addresses to their staked amount
    mapping(address => uint256) public validatorStakes;
    
    // Latest aggregated gas data
    GasData public latestGasData;
    
    // Mapping to track recent submissions
    mapping(address => GasData) public recentSubmissions;

    event GasPriceUpdated(uint256 basePrice, uint256 priorityPrice, uint256 timestamp);
    event ValidatorStaked(address indexed validator, uint256 amount);
    event ValidatorUnstaked(address indexed validator, uint256 amount);

    constructor() Ownable() {
        latestGasData = GasData(0, 0, block.timestamp);
    }

    // Stake ETH to become a validator
    function stakeToValidate() external payable {
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        require(validatorStakes[msg.sender] == 0, "Already staked");
        
        validatorStakes[msg.sender] = msg.value;
        emit ValidatorStaked(msg.sender, msg.value);
    }

    // Submit gas price data
    function submitGasPrice(uint256 _basePrice, uint256 _priorityPrice) 
        external 
        nonReentrant 
    {
        require(validatorStakes[msg.sender] > 0, "Not a validator");
        require(_basePrice > 0 && _priorityPrice > 0, "Invalid prices");

        // Store the submission
        recentSubmissions[msg.sender] = GasData(
            _basePrice,
            _priorityPrice,
            block.timestamp
        );

        // Update aggregated price if within deviation
        if (isWithinDeviation(_basePrice, _priorityPrice)) {
            updateAggregatedPrice(_basePrice, _priorityPrice);
        }
    }

    // Check if submission is within acceptable deviation
    function isWithinDeviation(uint256 _basePrice, uint256 _priorityPrice) 
        internal 
        view 
        returns (bool) 
    {
        if (latestGasData.basePrice == 0) return true;

        uint256 baseDeviation = calculateDeviation(_basePrice, latestGasData.basePrice);
        uint256 priorityDeviation = calculateDeviation(_priorityPrice, latestGasData.priorityPrice);

        return baseDeviation <= MAX_DEVIATION && priorityDeviation <= MAX_DEVIATION;
    }

    // Calculate percentage deviation between two values
    function calculateDeviation(uint256 _new, uint256 _old) 
        internal 
        pure 
        returns (uint256) 
    {
        if (_old == 0) return 0;
        uint256 diff = _new > _old ? _new - _old : _old - _new;
        return (diff * 100) / _old;
    }

    // Update the aggregated gas price
    function updateAggregatedPrice(uint256 _basePrice, uint256 _priorityPrice) 
        internal 
    {
        latestGasData = GasData(
            _basePrice,
            _priorityPrice,
            block.timestamp
        );

        emit GasPriceUpdated(_basePrice, _priorityPrice, block.timestamp);
    }

    // Get current gas price recommendation
    function getGasPrice() external view returns (
        uint256 basePrice,
        uint256 priorityPrice,
        uint256 timestamp
    ) {
        return (
            latestGasData.basePrice,
            latestGasData.priorityPrice,
            latestGasData.timestamp
        );
    }

    // Unstake and withdraw ETH
    function unstake() external nonReentrant {
        uint256 stake = validatorStakes[msg.sender];
        require(stake > 0, "No stake found");
        
        validatorStakes[msg.sender] = 0;
        emit ValidatorUnstaked(msg.sender, stake);
        
        (bool success, ) = payable(msg.sender).call{value: stake}("");
        require(success, "Transfer failed");
    }
} 