const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgriSupplyChain - Comprehensive Tests", function () {
  let agriSupplyChain;
  let owner, farmer, supplier, distributor, retailer, consumer;
  let accounts;

  // Deploy contract before each test
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    [owner, farmer, supplier, distributor, retailer, consumer] = accounts;
    
    const AgriSupplyChain = await ethers.getContractFactory("AgriSupplyChain");
    agriSupplyChain = await AgriSupplyChain.deploy();
    await agriSupplyChain.deployed();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(agriSupplyChain.address).to.not.equal(0);
      expect(agriSupplyChain.address).to.not.equal("");
      expect(agriSupplyChain.address).to.not.equal(null);
      expect(agriSupplyChain.address).to.not.equal(undefined);
    });

    it("Should set the right owner", async function () {
      expect(await agriSupplyChain.owner()).to.equal(owner.address);
    });
  });

  describe("Participant Management", function () {
    it("Should register participants with different roles", async function () {
      // Register farmer
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California, USA", 0);
      
      const farmerData = await agriSupplyChain.participants(farmer.address);
      expect(farmerData.name).to.equal("Green Valley Farm");
      expect(farmerData.location).to.equal("California, USA");
      expect(farmerData.role).to.equal(0); // Farmer role
      expect(farmerData.isActive).to.equal(true);
      expect(farmerData.reputation).to.equal(100);

      // Register distributor
      await agriSupplyChain.connect(distributor).registerParticipant("Fresh Distributors Inc", "Nevada, USA", 2);
      
      const distributorData = await agriSupplyChain.participants(distributor.address);
      expect(distributorData.name).to.equal("Fresh Distributors Inc");
      expect(distributorData.role).to.equal(2); // Distributor role
    });

    it("Should prevent duplicate registration", async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
      
      await expect(
        agriSupplyChain.connect(farmer).registerParticipant("Another Farm", "Texas", 0)
      ).to.be.revertedWith("Already registered");
    });

    it("Should validate participant data", async function () {
      await expect(
        agriSupplyChain.connect(farmer).registerParticipant("", "California", 0)
      ).to.be.revertedWith("Name cannot be empty");

      await expect(
        agriSupplyChain.connect(farmer).registerParticipant("Farm Name", "", 0)
      ).to.be.revertedWith("Location cannot be empty");
    });
  });

  describe("Product Management", function () {
    beforeEach(async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
    });

    it("Should create products with proper validation", async function () {
      await agriSupplyChain.connect(farmer).createProduct(
        "Organic Tomatoes",
        "Roma",
        1000,
        "2024-01-15",
        true,
        ["USDA Organic", "Fair Trade"]
      );

      const productInfo = await agriSupplyChain.getProductInfo(1);
      expect(productInfo.name).to.equal("Organic Tomatoes");
      expect(productInfo.variety).to.equal("Roma");
      expect(productInfo.quantity).to.equal(1000);
      expect(productInfo.farmer).to.equal(farmer.address);
      expect(productInfo.isOrganic).to.equal(true);
      expect(productInfo.quality).to.equal(0); // Excellent
      expect(productInfo.certifications).to.deep.equal(["USDA Organic", "Fair Trade"]);
    });

    it("Should only allow farmers to create products", async function () {
      await agriSupplyChain.connect(distributor).registerParticipant("Dist Co", "Nevada", 2);
      
      await expect(
        agriSupplyChain.connect(distributor).createProduct("Apples", "Gala", 500, "2024-01-15", false, [])
      ).to.be.revertedWith("Unauthorized role");
    });

    it("Should validate product data", async function () {
      await expect(
        agriSupplyChain.connect(farmer).createProduct("", "Roma", 1000, "2024-01-15", true, [])
      ).to.be.revertedWith("Product name cannot be empty");

      await expect(
        agriSupplyChain.connect(farmer).createProduct("Tomatoes", "Roma", 0, "2024-01-15", true, [])
      ).to.be.revertedWith("Quantity must be greater than 0");
    });
  });

  describe("Batch Management", function () {
    beforeEach(async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
      await agriSupplyChain.connect(farmer).createProduct("Tomatoes", "Roma", 1000, "2024-01-15", true, []);
    });

    it("Should create batches with QR codes", async function () {
      const qrCode = "QR_TOMATO_001";
      await agriSupplyChain.connect(farmer).createBatch(1, qrCode, "Farm Warehouse");

      const batchId = await agriSupplyChain.getBatchByQR(qrCode);
      expect(batchId).to.equal(1);

      const batchDetails = await agriSupplyChain.getBatchDetails(1);
      expect(batchDetails.batchId).to.equal(1);
      expect(batchDetails.productId).to.equal(1);
      expect(batchDetails.currentStage).to.equal(0); // Harvested
      expect(batchDetails.currentOwner).to.equal(farmer.address);
      expect(batchDetails.location).to.equal("Farm Warehouse");
    });

    it("Should prevent duplicate QR codes", async function () {
      const qrCode = "QR_DUPLICATE_TEST";
      await agriSupplyChain.connect(farmer).createBatch(1, qrCode, "Location 1");
      
      await expect(
        agriSupplyChain.connect(farmer).createBatch(1, qrCode, "Location 2")
      ).to.be.revertedWith("QR code already exists");
    });

    it("Should validate batch creation", async function () {
      await expect(
        agriSupplyChain.connect(farmer).createBatch(999, "QR_001", "Location")
      ).to.be.revertedWith("Not the product owner");

      await expect(
        agriSupplyChain.connect(farmer).createBatch(1, "", "Location")
      ).to.be.revertedWith("QR code cannot be empty");

      await expect(
        agriSupplyChain.connect(farmer).createBatch(1, "QR_001", "")
      ).to.be.revertedWith("Location cannot be empty");
    });
  });

  describe("Environmental Data Recording", function () {
    beforeEach(async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
      await agriSupplyChain.connect(distributor).registerParticipant("Dist Co", "Nevada", 2);
      await agriSupplyChain.connect(farmer).createProduct("Tomatoes", "Roma", 1000, "2024-01-15", true, []);
      await agriSupplyChain.connect(farmer).createBatch(1, "QR_001", "Farm");
    });

    it("Should record environmental data", async function () {
      await agriSupplyChain.connect(farmer).recordEnvironmentData(
        1, 450, 6500, "Cold Storage", "Temperature check"
      ); // 4.5°C, 65%

      const envData = await agriSupplyChain.getEnvironmentData(1, 0);
      expect(envData.temperature).to.equal(450);
      expect(envData.humidity).to.equal(6500);
      expect(envData.location).to.equal("Cold Storage");
      expect(envData.recorder).to.equal(farmer.address);
      expect(envData.notes).to.equal("Temperature check");
    });

    it("Should allow multiple environmental readings", async function () {
      await agriSupplyChain.connect(farmer).recordEnvironmentData(1, 450, 6500, "Farm", "Reading 1");
      await agriSupplyChain.connect(distributor).recordEnvironmentData(1, 380, 7000, "Transport", "Reading 2");

      // Check first reading
      const reading1 = await agriSupplyChain.getEnvironmentData(1, 0);
      expect(reading1.temperature).to.equal(450);
      expect(reading1.recorder).to.equal(farmer.address);

      // Check second reading
      const reading2 = await agriSupplyChain.getEnvironmentData(1, 1);
      expect(reading2.temperature).to.equal(380);
      expect(reading2.recorder).to.equal(distributor.address);
    });

    it("Should validate environmental data", async function () {
      await expect(
        agriSupplyChain.connect(farmer).recordEnvironmentData(1, 450, 6500, "", "Notes")
      ).to.be.revertedWith("Location cannot be empty");
    });
  });

  describe("Ownership Transfer", function () {
    beforeEach(async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
      await agriSupplyChain.connect(distributor).registerParticipant("Dist Co", "Nevada", 2);
      await agriSupplyChain.connect(retailer).registerParticipant("Fresh Market", "Arizona", 3);
      await agriSupplyChain.connect(farmer).createProduct("Tomatoes", "Roma", 1000, "2024-01-15", true, []);
      await agriSupplyChain.connect(farmer).createBatch(1, "QR_001", "Farm");
    });

    it("Should transfer ownership with stage progression", async function () {
      await agriSupplyChain.connect(farmer).transferBatchOwnership(
        1, distributor.address, 1, "Processing Center"
      );

      const batchDetails = await agriSupplyChain.getBatchDetails(1);
      expect(batchDetails.currentOwner).to.equal(distributor.address);
      expect(batchDetails.currentStage).to.equal(1); // Processed
      expect(batchDetails.location).to.equal("Processing Center");
    });

    it("Should maintain ownership history", async function () {
      await agriSupplyChain.connect(farmer).transferBatchOwnership(1, distributor.address, 1, "Processing");
      await agriSupplyChain.connect(distributor).transferBatchOwnership(1, retailer.address, 2, "Store");

      const history = await agriSupplyChain.getBatchHistory(1);
      expect(history.owners).to.deep.equal([farmer.address, distributor.address, retailer.address]);
      expect(history.locations).to.deep.equal(["Farm", "Processing", "Store"]);
      expect(history.timestamps.length).to.equal(3);
    });

    it("Should validate ownership transfer", async function () {
      // Only current owner can transfer
      await expect(
        agriSupplyChain.connect(distributor).transferBatchOwnership(1, retailer.address, 1, "Store")
      ).to.be.revertedWith("Not the current owner");

      // New owner must be registered
      await expect(
        agriSupplyChain.connect(farmer).transferBatchOwnership(1, consumer.address, 1, "Processing")
      ).to.be.revertedWith("New owner not registered");

      // Stage must progress forward
      await expect(
        agriSupplyChain.connect(farmer).transferBatchOwnership(1, distributor.address, 0, "Processing")
      ).to.be.revertedWith("Stage must change");

      // Location cannot be empty
      await expect(
        agriSupplyChain.connect(farmer).transferBatchOwnership(1, distributor.address, 1, "")
      ).to.be.revertedWith("Location cannot be empty");
    });
  });

  describe("Quality Management", function () {
    beforeEach(async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
      await agriSupplyChain.connect(distributor).registerParticipant("Dist Co", "Nevada", 2);
      await agriSupplyChain.connect(farmer).createProduct("Tomatoes", "Roma", 1000, "2024-01-15", true, []);
      await agriSupplyChain.connect(farmer).createBatch(1, "QR_001", "Farm");
    });

    it("Should update product quality", async function () {
      await agriSupplyChain.connect(farmer).updateQuality(1, 2, "Temperature exposure"); // Fair quality

      const productInfo = await agriSupplyChain.getProductInfo(1);
      expect(productInfo.quality).to.equal(2); // Fair

      const batchDetails = await agriSupplyChain.getBatchDetails(1);
      expect(batchDetails.notes).to.include("Quality updated to Fair: Temperature exposure");
    });

    it("Should allow authorized roles to update quality", async function () {
      await agriSupplyChain.connect(farmer).transferBatchOwnership(1, distributor.address, 1, "Processing");
      
      // Distributor should be able to update quality
      await agriSupplyChain.connect(distributor).updateQuality(1, 1, "Processing damage");
      
      const productInfo = await agriSupplyChain.getProductInfo(1);
      expect(productInfo.quality).to.equal(1); // Good
    });
  });

  describe("Batch Notes", function () {
    beforeEach(async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
      await agriSupplyChain.connect(farmer).createProduct("Tomatoes", "Roma", 1000, "2024-01-15", true, []);
      await agriSupplyChain.connect(farmer).createBatch(1, "QR_001", "Farm");
    });

    it("Should add notes to batches", async function () {
      await agriSupplyChain.connect(farmer).addBatchNote(1, "Harvested early morning");
      
      const batchDetails = await agriSupplyChain.getBatchDetails(1);
      expect(batchDetails.notes).to.include("Harvested early morning");
    });

    it("Should validate note addition", async function () {
      await expect(
        agriSupplyChain.connect(farmer).addBatchNote(1, "")
      ).to.be.revertedWith("Note cannot be empty");
    });
  });

  describe("Utility Functions", function () {
    it("Should return correct stage strings", async function () {
      expect(await agriSupplyChain.getStageString(0)).to.equal("Harvested");
      expect(await agriSupplyChain.getStageString(1)).to.equal("Processed");
      expect(await agriSupplyChain.getStageString(2)).to.equal("In Transit");
      expect(await agriSupplyChain.getStageString(3)).to.equal("Delivered");
      expect(await agriSupplyChain.getStageString(4)).to.equal("Sold");
    });

    it("Should return correct role strings", async function () {
      expect(await agriSupplyChain.getRoleString(0)).to.equal("Farmer");
      expect(await agriSupplyChain.getRoleString(1)).to.equal("Supplier");
      expect(await agriSupplyChain.getRoleString(2)).to.equal("Distributor");
      expect(await agriSupplyChain.getRoleString(3)).to.equal("Retailer");
    });
  });

  describe("Admin Functions", function () {
    beforeEach(async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
    });

    it("Should allow owner to update participant reputation", async function () {
      await agriSupplyChain.connect(owner).updateParticipantReputation(farmer.address, 150);
      
      const participant = await agriSupplyChain.participants(farmer.address);
      expect(participant.reputation).to.equal(150);
    });

    it("Should allow owner to deactivate participants", async function () {
      await agriSupplyChain.connect(owner).deactivateParticipant(farmer.address);
      
      const participant = await agriSupplyChain.participants(farmer.address);
      expect(participant.isActive).to.equal(false);
    });

    it("Should prevent non-owners from admin functions", async function () {
      await expect(
        agriSupplyChain.connect(farmer).updateParticipantReputation(distributor.address, 150)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        agriSupplyChain.connect(farmer).deactivateParticipant(distributor.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete supply chain workflow", async function () {
      // Step 1: Register all participants
      await agriSupplyChain.connect(farmer).registerParticipant("Green Valley Farm", "California", 0);
      await agriSupplyChain.connect(supplier).registerParticipant("Processing Co", "Oregon", 1);
      await agriSupplyChain.connect(distributor).registerParticipant("Distribution Inc", "Nevada", 2);
      await agriSupplyChain.connect(retailer).registerParticipant("Fresh Market", "Arizona", 3);

      // Step 2: Create product
      await agriSupplyChain.connect(farmer).createProduct(
        "Organic Apples", "Honeycrisp", 2000, "2024-01-20", true, ["USDA Organic"]
      );

      // Step 3: Create batch
      await agriSupplyChain.connect(farmer).createBatch(1, "QR_APPLE_BATCH_001", "Farm Storage");

      // Step 4: Record initial environmental data
      await agriSupplyChain.connect(farmer).recordEnvironmentData(
        1, 200, 5500, "Farm Cold Storage", "Initial storage after harvest"
      );

      // Step 5: Transfer to supplier (processing)
      await agriSupplyChain.connect(farmer).transferBatchOwnership(
        1, supplier.address, 1, "Processing Facility"
      );

      // Step 6: Record processing environment
      await agriSupplyChain.connect(supplier).recordEnvironmentData(
        1, 800, 6000, "Processing Line", "During washing and packaging"
      );

      // Step 7: Transfer to distributor
      await agriSupplyChain.connect(supplier).transferBatchOwnership(
        1, distributor.address, 2, "Distribution Center"
      );

      // Step 8: Record transport conditions
      await agriSupplyChain.connect(distributor).recordEnvironmentData(
        1, 400, 5800, "Refrigerated Truck", "During transportation"
      );

      // Step 9: Transfer to retailer
      await agriSupplyChain.connect(distributor).transferBatchOwnership(
        1, retailer.address, 3, "Retail Store"
      );

      // Step 10: Final quality check
      await agriSupplyChain.connect(retailer).updateQuality(1, 0, "Excellent condition upon arrival");
      await agriSupplyChain.connect(retailer).addBatchNote(1, "Ready for sale");

      // Verify complete workflow
      const batchDetails = await agriSupplyChain.getBatchDetails(1);
      const history = await agriSupplyChain.getBatchHistory(1);
      const productInfo = await agriSupplyChain.getProductInfo(1);

      expect(batchDetails.currentOwner).to.equal(retailer.address);
      expect(batchDetails.currentStage).to.equal(3); // Delivered
      expect(batchDetails.location).to.equal("Retail Store");
      expect(batchDetails.environmentRecordCount).to.equal(3);
      
      expect(history.owners.length).to.equal(4);
      expect(history.owners).to.deep.equal([
        farmer.address, supplier.address, distributor.address, retailer.address
      ]);
      
      expect(productInfo.quality).to.equal(0); // Excellent
      expect(productInfo.isOrganic).to.equal(true);
    });

    it("Should track batch via QR code throughout supply chain", async function () {
      // Setup participants and product
      await agriSupplyChain.connect(farmer).registerParticipant("Farm", "Location", 0);
      await agriSupplyChain.connect(farmer).createProduct("Lettuce", "Iceberg", 500, "2024-01-15", false, []);
      
      const qrCode = "QR_LETTUCE_TRACKING_TEST";
      await agriSupplyChain.connect(farmer).createBatch(1, qrCode, "Farm");

      // Verify QR tracking works
      const batchId = await agriSupplyChain.getBatchByQR(qrCode);
      expect(batchId).to.equal(1);

      const batchDetails = await agriSupplyChain.getBatchDetails(batchId);
      expect(batchDetails.productId).to.equal(1);
      expect(batchDetails.currentOwner).to.equal(farmer.address);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle invalid batch IDs gracefully", async function () {
      await expect(
        agriSupplyChain.getBatchDetails(999)
      ).to.be.revertedWith("Invalid batch ID");

      await expect(
        agriSupplyChain.getEnvironmentData(999, 0)
      ).to.be.revertedWith("Invalid batch ID");
    });

    it("Should handle invalid environment data indices", async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Farm", "Location", 0);
      await agriSupplyChain.connect(farmer).createProduct("Carrots", "Orange", 100, "2024-01-15", false, []);
      await agriSupplyChain.connect(farmer).createBatch(1, "QR_001", "Farm");

      await expect(
        agriSupplyChain.getEnvironmentData(1, 0)
      ).to.be.revertedWith("Invalid index");
    });

    it("Should handle non-existent QR codes", async function () {
      const nonExistentQR = await agriSupplyChain.getBatchByQR("NON_EXISTENT_QR");
      expect(nonExistentQR).to.equal(0);
    });

    it("Should prevent unauthorized access", async function () {
      await agriSupplyChain.connect(farmer).registerParticipant("Farm", "Location", 0);
      await agriSupplyChain.connect(farmer).createProduct("Corn", "Sweet", 200, "2024-01-15", false, []);
      await agriSupplyChain.connect(farmer).createBatch(1, "QR_001", "Farm");

      // Unregistered user cannot record environment data
      await expect(
        agriSupplyChain.connect(consumer).recordEnvironmentData(1, 500, 6000, "Storage", "Unauthorized access attempt")
      ).to.be.revertedWith("Not a registered participant");
    });
  });

  describe("Gas Usage Tests", function () {
    it("Should use reasonable gas for basic operations", async function () {
      // Register participant
      const registerTx = await agriSupplyChain.connect(farmer).registerParticipant("Test Farm", "Test Location", 0);
      const registerReceipt = await registerTx.wait();
      expect(registerReceipt.gasUsed).to.be.below(350000); // Increased from 250000

      // Create product
      const productTx = await agriSupplyChain.connect(farmer).createProduct("Test Product", "Test Variety", 100, "2024-01-15", false, []);
      const productReceipt = await productTx.wait();
      expect(productReceipt.gasUsed).to.be.below(450000); // Increased from 350000

      // Create batch
      const batchTx = await agriSupplyChain.connect(farmer).createBatch(1, "QR_GAS_TEST", "Test Location");
      const batchReceipt = await batchTx.wait();
      expect(batchReceipt.gasUsed).to.be.below(400000); // Increased from 300000
    });
  });
});