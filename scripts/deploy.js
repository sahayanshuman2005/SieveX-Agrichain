// deploy.js - Smart Contract Deployment Script (Simplified)
const { ethers } = require('hardhat');
const fs = require('fs');

async function main() {
    console.log("🚀 Starting Agricultural Supply Chain Deployment...");
    
    // Get the ContractFactory and Signers
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", ethers.utils.formatEther(balance), "ETH");

    // Deploy the contract
    const AgriSupplyChain = await ethers.getContractFactory("AgriSupplyChain");
    console.log("📦 Deploying AgriSupplyChain...");
    
    const agriSupplyChain = await AgriSupplyChain.deploy();
    await agriSupplyChain.deployed();
    
    console.log("✅ AgriSupplyChain deployed to:", agriSupplyChain.address);
    console.log("🔗 Transaction hash:", agriSupplyChain.deployTransaction.hash);

    // Save deployment info
    const deploymentInfo = {
        contractAddress: agriSupplyChain.address,
        deployerAddress: deployer.address,
        deploymentTime: new Date().toISOString(),
        network: network.name,
        transactionHash: agriSupplyChain.deployTransaction.hash,
        blockNumber: agriSupplyChain.deployTransaction.blockNumber
    };

    // Save to file
    fs.writeFileSync(
        './deployment-info.json', 
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("💾 Deployment info saved to deployment-info.json");
    
    // Update .env file with contract address
    updateEnvFile(agriSupplyChain.address);
    
    // Verify contract if not on localhost
    if (network.name !== "localhost" && network.name !== "hardhat") {
        console.log("⏳ Waiting for block confirmations...");
        await agriSupplyChain.deployTransaction.wait(6);
        
        console.log("🔍 Verifying contract on Etherscan...");
        try {
            await run("verify:verify", {
                address: agriSupplyChain.address,
                constructorArguments: [],
            });
            console.log("✅ Contract verified successfully");
        } catch (error) {
            console.log("❌ Verification failed:", error.message);
        }
    }

    console.log("\n🎉 Deployment completed successfully!");
    console.log(`📋 Next steps:`);
    console.log(`1. Contract deployed at: ${agriSupplyChain.address}`);
    console.log(`2. Start the API server: npm start`);
    console.log(`3. Open the web application: http://localhost:3001`);
    console.log(`4. Connect MetaMask to localhost:8545`);
    console.log(`5. Import account with private key for testing`);
}

function updateEnvFile(contractAddress) {
    try {
        let envContent = '';
        
        if (fs.existsSync('.env')) {
            envContent = fs.readFileSync('.env', 'utf8');
            
            // Update existing AGRI_CONTRACT_ADDRESS or add it
            if (envContent.includes('AGRI_CONTRACT_ADDRESS=')) {
                envContent = envContent.replace(
                    /AGRI_CONTRACT_ADDRESS=.*$/m,
                    `AGRI_CONTRACT_ADDRESS=${contractAddress}`
                );
            } else {
                envContent += `\nAGRI_CONTRACT_ADDRESS=${contractAddress}\n`;
            }
        } else {
            // Create new .env file
            envContent = `# Agricultural Supply Chain Configuration
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
LOCAL_RPC_URL=http://localhost:8545
AGRI_CONTRACT_ADDRESS=${contractAddress}
API_PORT=3001
WEB_PORT=8080

# Optional: For testnet deployment
INFURA_API_KEY=your_infura_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
`;
        }
        
        fs.writeFileSync('.env', envContent);
        console.log("✅ Updated .env file with contract address");
        
    } catch (error) {
        console.error("❌ Failed to update .env file:", error.message);
    }
}

// Handle errors
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 Deployment failed:", error);
        process.exit(1);
    });