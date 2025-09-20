// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AgriSupplyChain is Ownable, ReentrancyGuard {
    
    // Enums for different stages and roles
    enum Role { Farmer, Supplier, Distributor, Retailer }
    enum Stage { Harvested, Processed, InTransit, Delivered, Sold }
    enum Quality { Excellent, Good, Fair, Poor }
    
    // Structs for data organization
    struct Participant {
        string name;
        string location;
        Role role;
        bool isActive;
        uint256 reputation;
    }
    
    struct Product {
        uint256 productId;
        string productName;
        string variety;
        uint256 quantity;
        string harvestDate;
        address farmer;
        Quality currentQuality;
        bool isOrganic;
        string[] certifications;
    }
    
    struct BatchTracking {
        uint256 batchId;
        uint256 productId;
        Stage currentStage;
        address currentOwner;
        uint256 timestamp;
        string location;
        address[] ownershipHistory;
        string[] locationHistory;
        uint256[] stageTimestamps;
        string notes;
    }
    
    struct EnvironmentRecord {
        uint256 timestamp;
        int256 temperature; // in Celsius * 100 (to handle decimals)
        uint256 humidity;   // percentage * 100
        string location;
        address recorder;
        string notes;
    }
    
    struct Transaction {
        uint256 transactionId;
        uint256 batchId;
        address from;
        address to;
        uint256 timestamp;
        uint256 price;
        string transactionType;
        bool completed;
    }
    
    // State variables
    mapping(address => Participant) public participants;
    mapping(uint256 => Product) public products;
    mapping(uint256 => BatchTracking) public batches;
    mapping(uint256 => Transaction) public transactions;
    mapping(string => uint256) public qrCodeToBatch;
    mapping(uint256 => EnvironmentRecord[]) public batchEnvironmentData;
    
    uint256 public nextProductId = 1;
    uint256 public nextBatchId = 1;
    uint256 public nextTransactionId = 1;
    
    // Events
    event ParticipantRegistered(address indexed participant, Role role, string name);
    event ProductCreated(uint256 indexed productId, string productName, address indexed farmer);
    event BatchCreated(uint256 indexed batchId, uint256 indexed productId, string qrCode);
    event EnvironmentDataRecorded(uint256 indexed batchId, int256 temperature, uint256 humidity, address recorder);
    event OwnershipTransferred(uint256 indexed batchId, address indexed from, address indexed to, Stage newStage);
    event TransactionCompleted(uint256 indexed transactionId, uint256 indexed batchId, address indexed buyer);
    event QualityUpdated(uint256 indexed batchId, Quality newQuality, address updatedBy);
    event BatchNoteAdded(uint256 indexed batchId, string note, address addedBy);
    
    // Modifiers
    modifier onlyRegistered() {
        require(participants[msg.sender].isActive, "Not a registered participant");
        _;
    }
    
    modifier onlyRole(Role _role) {
        require(participants[msg.sender].role == _role, "Unauthorized role");
        _;
    }
    
    modifier validBatch(uint256 _batchId) {
        require(_batchId > 0 && _batchId < nextBatchId, "Invalid batch ID");
        _;
    }
    
    modifier onlyCurrentOwner(uint256 _batchId) {
        require(batches[_batchId].currentOwner == msg.sender, "Not the current owner");
        _;
    }
    
    constructor() {
        // Contract is ready to use
    }
    
    // Participant Management
    function registerParticipant(
        string memory _name,
        string memory _location,
        Role _role
    ) external {
        require(!participants[msg.sender].isActive, "Already registered");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_location).length > 0, "Location cannot be empty");
        
        participants[msg.sender] = Participant({
            name: _name,
            location: _location,
            role: _role,
            isActive: true,
            reputation: 100 // Starting reputation
        });
        
        emit ParticipantRegistered(msg.sender, _role, _name);
    }
    
    // Product and Batch Management
    function createProduct(
        string memory _productName,
        string memory _variety,
        uint256 _quantity,
        string memory _harvestDate,
        bool _isOrganic,
        string[] memory _certifications
    ) external onlyRegistered onlyRole(Role.Farmer) returns (uint256) {
        require(bytes(_productName).length > 0, "Product name cannot be empty");
        require(_quantity > 0, "Quantity must be greater than 0");
        
        uint256 productId = nextProductId++;
        
        Product storage newProduct = products[productId];
        newProduct.productId = productId;
        newProduct.productName = _productName;
        newProduct.variety = _variety;
        newProduct.quantity = _quantity;
        newProduct.harvestDate = _harvestDate;
        newProduct.farmer = msg.sender;
        newProduct.currentQuality = Quality.Excellent;
        newProduct.isOrganic = _isOrganic;
        newProduct.certifications = _certifications;
        
        emit ProductCreated(productId, _productName, msg.sender);
        return productId;
    }
    
    function createBatch(
        uint256 _productId,
        string memory _qrCode,
        string memory _initialLocation
    ) external onlyRegistered onlyRole(Role.Farmer) returns (uint256) {
        require(products[_productId].farmer == msg.sender, "Not the product owner");
        require(qrCodeToBatch[_qrCode] == 0, "QR code already exists");
        require(bytes(_qrCode).length > 0, "QR code cannot be empty");
        require(bytes(_initialLocation).length > 0, "Location cannot be empty");
        
        uint256 batchId = nextBatchId++;
        
        BatchTracking storage newBatch = batches[batchId];
        newBatch.batchId = batchId;
        newBatch.productId = _productId;
        newBatch.currentStage = Stage.Harvested;
        newBatch.currentOwner = msg.sender;
        newBatch.timestamp = block.timestamp;
        newBatch.location = _initialLocation;
        newBatch.ownershipHistory.push(msg.sender);
        newBatch.locationHistory.push(_initialLocation);
        newBatch.stageTimestamps.push(block.timestamp);
        
        qrCodeToBatch[_qrCode] = batchId;
        
        emit BatchCreated(batchId, _productId, _qrCode);
        return batchId;
    }
    
    // Manual Environmental Data Recording
    function recordEnvironmentData(
        uint256 _batchId,
        int256 _temperature,
        uint256 _humidity,
        string memory _location,
        string memory _notes
    ) external onlyRegistered validBatch(_batchId) {
        require(bytes(_location).length > 0, "Location cannot be empty");
        
        EnvironmentRecord memory newRecord = EnvironmentRecord({
            timestamp: block.timestamp,
            temperature: _temperature,
            humidity: _humidity,
            location: _location,
            recorder: msg.sender,
            notes: _notes
        });
        
        batchEnvironmentData[_batchId].push(newRecord);
        
        emit EnvironmentDataRecorded(_batchId, _temperature, _humidity, msg.sender);
    }
    
    // Supply Chain Tracking
    function transferBatchOwnership(
        uint256 _batchId,
        address _newOwner,
        Stage _newStage,
        string memory _newLocation
    ) external validBatch(_batchId) onlyCurrentOwner(_batchId) onlyRegistered {
        require(participants[_newOwner].isActive, "New owner not registered");
        require(_newStage != batches[_batchId].currentStage, "Stage must change");
        require(uint8(_newStage) > uint8(batches[_batchId].currentStage), "Stage must progress forward");
        require(bytes(_newLocation).length > 0, "Location cannot be empty");
        
        BatchTracking storage batch = batches[_batchId];
        address previousOwner = batch.currentOwner;
        
        batch.currentOwner = _newOwner;
        batch.currentStage = _newStage;
        batch.location = _newLocation;
        batch.timestamp = block.timestamp;
        batch.ownershipHistory.push(_newOwner);
        batch.locationHistory.push(_newLocation);
        batch.stageTimestamps.push(block.timestamp);
        
        emit OwnershipTransferred(_batchId, previousOwner, _newOwner, _newStage);
    }
    
    // Quality Management
    function updateQuality(
        uint256 _batchId,
        Quality _newQuality,
        string memory _reason
    ) external onlyRegistered validBatch(_batchId) {
        // Only current owner or authorized roles can update quality
        require(
            batches[_batchId].currentOwner == msg.sender || 
            participants[msg.sender].role == Role.Supplier ||
            participants[msg.sender].role == Role.Distributor,
            "Not authorized to update quality"
        );
        
        products[batches[_batchId].productId].currentQuality = _newQuality;
        
        // Add note about quality change
        if (bytes(_reason).length > 0) {
            batches[_batchId].notes = string(abi.encodePacked(
                batches[_batchId].notes,
                " | Quality updated to ",
                getQualityString(_newQuality),
                ": ",
                _reason
            ));
        }
        
        emit QualityUpdated(_batchId, _newQuality, msg.sender);
    }
    
    // Add notes to batch
    function addBatchNote(
        uint256 _batchId,
        string memory _note
    ) external onlyRegistered validBatch(_batchId) {
        require(bytes(_note).length > 0, "Note cannot be empty");
        
        batches[_batchId].notes = string(abi.encodePacked(
            batches[_batchId].notes,
            " | ",
            _note
        ));
        
        emit BatchNoteAdded(_batchId, _note, msg.sender);
    }
    
    // Transaction Management
    function createTransaction(
        uint256 _batchId,
        address _buyer,
        uint256 _price,
        string memory _transactionType
    ) external validBatch(_batchId) onlyCurrentOwner(_batchId) returns (uint256) {
        require(participants[_buyer].isActive, "Buyer not registered");
        require(_price > 0, "Price must be greater than 0");
        require(bytes(_transactionType).length > 0, "Transaction type cannot be empty");
        
        uint256 transactionId = nextTransactionId++;
        
        transactions[transactionId] = Transaction({
            transactionId: transactionId,
            batchId: _batchId,
            from: msg.sender,
            to: _buyer,
            timestamp: block.timestamp,
            price: _price,
            transactionType: _transactionType,
            completed: false
        });
        
        return transactionId;
    }
    
    function completeTransaction(uint256 _transactionId) external payable nonReentrant {
        Transaction storage txn = transactions[_transactionId];
        require(msg.sender == txn.to, "Not the buyer");
        require(!txn.completed, "Already completed");
        require(msg.value >= txn.price, "Insufficient payment");
        
        txn.completed = true;
        
        // Transfer ownership (keep same stage initially)
        BatchTracking storage batch = batches[txn.batchId];
        batch.currentOwner = txn.to;
        batch.timestamp = block.timestamp;
        batch.ownershipHistory.push(txn.to);
        batch.locationHistory.push(batch.location); // Keep same location initially
        batch.stageTimestamps.push(block.timestamp);
        
        // Transfer payment to seller
        payable(txn.from).transfer(txn.price);
        
        // Refund excess payment
        if (msg.value > txn.price) {
            payable(msg.sender).transfer(msg.value - txn.price);
        }
        
        emit TransactionCompleted(_transactionId, txn.batchId, msg.sender);
    }
    
    // Query Functions
    function getBatchHistory(uint256 _batchId) external view validBatch(_batchId) returns (
        address[] memory owners,
        string[] memory locations,
        uint256[] memory timestamps
    ) {
        BatchTracking storage batch = batches[_batchId];
        return (batch.ownershipHistory, batch.locationHistory, batch.stageTimestamps);
    }
    
    function getEnvironmentDataCount(uint256 _batchId) external view validBatch(_batchId) returns (uint256) {
        return batchEnvironmentData[_batchId].length;
    }
    
    function getEnvironmentData(uint256 _batchId, uint256 _index) external view validBatch(_batchId) returns (
        uint256 timestamp,
        int256 temperature,
        uint256 humidity,
        string memory location,
        address recorder,
        string memory notes
    ) {
        require(_index < batchEnvironmentData[_batchId].length, "Invalid index");
        
        EnvironmentRecord memory record = batchEnvironmentData[_batchId][_index];
        return (
            record.timestamp, 
            record.temperature, 
            record.humidity, 
            record.location, 
            record.recorder,
            record.notes
        );
    }
    
    function getBatchByQR(string memory _qrCode) external view returns (uint256) {
        return qrCodeToBatch[_qrCode];
    }
    
    function getProductInfo(uint256 _productId) external view returns (
        string memory name,
        string memory variety,
        uint256 quantity,
        address farmer,
        Quality quality,
        bool isOrganic,
        string[] memory certifications
    ) {
        Product memory product = products[_productId];
        return (
            product.productName, 
            product.variety, 
            product.quantity, 
            product.farmer, 
            product.currentQuality, 
            product.isOrganic,
            product.certifications
        );
    }
    
    function getBatchDetails(uint256 _batchId) external view validBatch(_batchId) returns (
        uint256 batchId,
        uint256 productId,
        Stage currentStage,
        address currentOwner,
        string memory location,
        string memory notes,
        uint256 environmentRecordCount
    ) {
        BatchTracking memory batch = batches[_batchId];
        return (
            batch.batchId,
            batch.productId,
            batch.currentStage,
            batch.currentOwner,
            batch.location,
            batch.notes,
            batchEnvironmentData[_batchId].length
        );
    }
    
    // Utility Functions
    function getQualityString(Quality _quality) internal pure returns (string memory) {
        if (_quality == Quality.Excellent) return "Excellent";
        if (_quality == Quality.Good) return "Good";
        if (_quality == Quality.Fair) return "Fair";
        if (_quality == Quality.Poor) return "Poor";
        return "Unknown";
    }
    
    function getStageString(Stage _stage) external pure returns (string memory) {
        if (_stage == Stage.Harvested) return "Harvested";
        if (_stage == Stage.Processed) return "Processed";
        if (_stage == Stage.InTransit) return "In Transit";
        if (_stage == Stage.Delivered) return "Delivered";
        if (_stage == Stage.Sold) return "Sold";
        return "Unknown";
    }
    
    function getRoleString(Role _role) external pure returns (string memory) {
        if (_role == Role.Farmer) return "Farmer";
        if (_role == Role.Supplier) return "Supplier";
        if (_role == Role.Distributor) return "Distributor";
        if (_role == Role.Retailer) return "Retailer";
        return "Unknown";
    }
    
    // Admin Functions
    function updateParticipantReputation(address _participant, uint256 _newReputation) external onlyOwner {
        require(participants[_participant].isActive, "Participant not active");
        participants[_participant].reputation = _newReputation;
    }
    
    function deactivateParticipant(address _participant) external onlyOwner {
        participants[_participant].isActive = false;
    }
    
    // Emergency functions
    function pause() external onlyOwner {
        // Implementation for pausing contract operations
    }
    
    function unpause() external onlyOwner {
        // Implementation for unpausing contract operations
    }
}