import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import GasOracleABI from '../contracts/GasOracle.json';

const GAS_ORACLE_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';

const GasOracle: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [account, setAccount] = useState<string>('');
    const [provider, setProvider] = useState<any>(null);
    const [contract, setContract] = useState<any>(null);
    const [isValidator, setIsValidator] = useState(false);
    const [gasData, setGasData] = useState({
        basePrice: '0',
        priorityPrice: '0',
        timestamp: '0'
    });
    const [inputData, setInputData] = useState({
        basePrice: '',
        priorityPrice: ''
    });
    const [transactionPending, setTransactionPending] = useState(false);

    // Connect wallet
    const connectWallet = async () => {
        setLoading(true);
        try {
            const { ethereum } = window as any;
            if (!ethereum) {
                alert('Please install MetaMask!');
                return;
            }

            const accounts = await ethereum.request({
                method: 'eth_requestAccounts'
            });
            
            const provider = new ethers.providers.Web3Provider(ethereum);
            const signer = provider.getSigner();
            const contract = new ethers.Contract(
                GAS_ORACLE_ADDRESS,
                GasOracleABI.abi,
                signer
            );

            setAccount(accounts[0]);
            setProvider(provider);
            setContract(contract);
            
            const stake = await contract.validatorStakes(accounts[0]);
            setIsValidator(stake.gt(0));

            // Setup event listeners
            ethereum.on('accountsChanged', handleAccountsChanged);
            ethereum.on('chainChanged', handleChainChanged);
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Failed to connect wallet');
        } finally {
            setLoading(false);
        }
    };

    // Handle account changes
    const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
            setAccount('');
            setIsValidator(false);
        } else {
            setAccount(accounts[0]);
            checkValidatorStatus(accounts[0]);
        }
    };

    // Handle chain changes
    const handleChainChanged = () => {
        window.location.reload();
    };

    // Check validator status
    const checkValidatorStatus = async (address: string) => {
        if (contract) {
            const stake = await contract.validatorStakes(address);
            setIsValidator(stake.gt(0));
        }
    };

    // Stake ETH
    const stakeETH = async () => {
        if (!contract) return;
        setTransactionPending(true);
        try {
            const tx = await contract.stakeToValidate({
                value: ethers.utils.parseEther('0.5')
            });
            await tx.wait();
            setIsValidator(true);
            alert('Successfully staked! You are now a validator.');
        } catch (error: any) {
            console.error('Error staking:', error);
            alert(error.message || 'Failed to stake ETH');
        } finally {
            setTransactionPending(false);
        }
    };

    // Submit gas prices
    const submitGasPrices = async () => {
        if (!contract) return;
        setTransactionPending(true);
        try {
            const tx = await contract.submitGasPrice(
                ethers.utils.parseUnits(inputData.basePrice, 'gwei'),
                ethers.utils.parseUnits(inputData.priorityPrice, 'gwei')
            );
            await tx.wait();
            alert('Gas prices submitted successfully!');
            fetchGasData();
            setInputData({ basePrice: '', priorityPrice: '' });
        } catch (error: any) {
            console.error('Error submitting gas prices:', error);
            alert(error.message || 'Failed to submit gas prices');
        } finally {
            setTransactionPending(false);
        }
    };

    // Unstake ETH
    const unstakeETH = async () => {
        if (!contract) return;
        setTransactionPending(true);
        try {
            const tx = await contract.unstake();
            await tx.wait();
            setIsValidator(false);
            alert('Successfully unstaked!');
        } catch (error: any) {
            console.error('Error unstaking:', error);
            alert(error.message || 'Failed to unstake');
        } finally {
            setTransactionPending(false);
        }
    };

    // Fetch current gas data
    const fetchGasData = async () => {
        if (!contract) return;
        try {
            const data = await contract.getGasPrice();
            setGasData({
                basePrice: ethers.utils.formatUnits(data.basePrice, 'gwei'),
                priorityPrice: ethers.utils.formatUnits(data.priorityPrice, 'gwei'),
                timestamp: new Date(data.timestamp.toNumber() * 1000).toLocaleString()
            });
        } catch (error) {
            console.error('Error fetching gas data:', error);
        }
    };

    // Fetch gas data periodically
    useEffect(() => {
        if (contract) {
            fetchGasData();
            const interval = setInterval(fetchGasData, 30000); // Every 30 seconds
            return () => clearInterval(interval);
        }
    }, [contract]);

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Sponsor Banner */}
            <div className="w-full h-48 md:h-64 relative mb-8">
              
            </div>

            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
                        <h1 className="text-3xl font-bold text-purple-400 mb-8">
                            Gas Oracle Dashboard
                        </h1>
                        
                        {loading && (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                            </div>
                        )}
                        
                        {!account ? (
                            <button 
                                onClick={connectWallet}
                                disabled={loading}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50"
                            >
                                {loading ? 'Connecting...' : 'Connect Wallet'}
                            </button>
                        ) : (
                            <div className="space-y-8">
                                {/* Account Info */}
                                <div className="bg-gray-700 rounded-lg p-4">
                                    <h2 className="text-lg font-semibold text-purple-300 mb-2">Account Info</h2>
                                    <p className="text-gray-300">
                                        Connected: {account.slice(0, 6)}...{account.slice(-4)}
                                    </p>
                                    <p className="text-gray-300">
                                        Status: {isValidator ? 
                                            <span className="text-green-400">Active Validator</span> : 
                                            <span className="text-yellow-400">Not Validated</span>
                                        }
                                    </p>
                                </div>

                                {/* Validator Actions */}
                                {!isValidator ? (
                                    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                        <h2 className="text-lg font-semibold text-purple-300 mb-4">Become a Validator</h2>
                                        <button 
                                            onClick={stakeETH}
                                            disabled={transactionPending}
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50"
                                        >
                                            {transactionPending ? 'Staking...' : 'Stake 0.5 ETH'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Submit Gas Prices */}
                                        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                            <h2 className="text-lg font-semibold text-purple-300 mb-4">Submit Gas Prices</h2>
                                            <div className="space-y-4">
                                                <input
                                                    type="number"
                                                    placeholder="Base Price (Gwei)"
                                                    value={inputData.basePrice}
                                                    onChange={(e) => setInputData({
                                                        ...inputData,
                                                        basePrice: e.target.value
                                                    })}
                                                    className="w-full bg-gray-800 border border-gray-600 p-2 rounded text-white placeholder-gray-400"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Priority Price (Gwei)"
                                                    value={inputData.priorityPrice}
                                                    onChange={(e) => setInputData({
                                                        ...inputData,
                                                        priorityPrice: e.target.value
                                                    })}
                                                    className="w-full bg-gray-800 border border-gray-600 p-2 rounded text-white placeholder-gray-400"
                                                />
                                                <button 
                                                    onClick={submitGasPrices}
                                                    disabled={transactionPending}
                                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50"
                                                >
                                                    {transactionPending ? 'Submitting...' : 'Submit Gas Prices'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Unstake Option */}
                                        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                            <h2 className="text-lg font-semibold text-purple-300 mb-4">Validator Actions</h2>
                                            <button 
                                                onClick={unstakeETH}
                                                disabled={transactionPending}
                                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50"
                                            >
                                                {transactionPending ? 'Unstaking...' : 'Unstake ETH'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Current Gas Prices */}
                                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                    <h2 className="text-lg font-semibold text-purple-300 mb-4">Current Gas Prices</h2>
                                    <div className="space-y-2">
                                        <p className="text-gray-300">Base Price: {gasData.basePrice} Gwei</p>
                                        <p className="text-gray-300">Priority Price: {gasData.priorityPrice} Gwei</p>
                                        <p className="text-gray-300">Last Updated: {gasData.timestamp}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GasOracle; 