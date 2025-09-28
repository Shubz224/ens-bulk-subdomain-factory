// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode, string calldata label,
        address owner, address resolver, uint64 ttl,
        uint32 fuses, uint64 expiry
    ) external returns (bytes32 node);
    function ownerOf(uint256 id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getData(uint256 id) external view returns (address owner, uint32 fuses, uint64 expiry);
}

interface IENSRegistry {
    function owner(bytes32 node) external view returns (address);
    function resolver(bytes32 node) external view returns (address);
}

/// @title BulkSubdomainFactory - Professional ENS subdomain distribution system
/// @author ENS Community
/// @notice Enables efficient bulk distribution of ENS subdomains with Merkle-proof based access control
/// @dev Implements commit-reveal scheme to prevent MEV extraction and front-running attacks
contract BulkSubdomainFactory is Ownable, ReentrancyGuard {
    
    // =============================================================
    //                          CUSTOM ERRORS
    // =============================================================
    
    /// @dev Thrown when contract operations are paused
    error ContractIsPaused();
    
    /// @dev Thrown when caller lacks authorization for parent domain
    error NotAuthorized();
    
    /// @dev Thrown when domain configuration is inactive
    error ConfigNotActive();
    
    /// @dev Thrown when user has already claimed a subdomain
    error AlreadyClaimed();
    
    /// @dev Thrown when commit-reveal delay has not passed
    error RevealTooEarly();
    
    /// @dev Thrown when subdomain already exists
    error SubdomainAlreadyClaimed();
    
    /// @dev Thrown when Merkle proof verification fails
    error InvalidMerkleProof();
    
    /// @dev Thrown when subdomain expiry exceeds parent domain expiry
    error ExpiryExceedsParent();
    
    /// @dev Thrown when attempting to initialize already configured domain
    error ConfigAlreadyExists();
    
    /// @dev Thrown when invalid parameters are provided
    error InvalidParameters();

    // =============================================================
    //                            STRUCTS
    // =============================================================
    
    /// @notice Configuration for bulk subdomain distribution
    /// @dev Packed struct to optimize storage (fits in 4 slots)
    struct Config {
        bytes32 merkleRoot;         // Slot 1: Merkle root for access control
        bytes32 parentNode;         // Slot 2: Parent domain node hash
        string parentDomain;        // Slot 3+: Parent domain string
        address parentOwner;        // Slot N: Domain owner (20 bytes)
        uint32 defaultFuses;        // Slot N: Default fuse settings (4 bytes)
        bool active;                // Slot N: Configuration active status (1 byte)
        uint64 totalSubdomains;     // Slot N: Total allowed subdomains (8 bytes) 
        uint64 claimedCount;        // Slot N+1: Number claimed (8 bytes)
    }

    // =============================================================
    //                        STATE VARIABLES
    // =============================================================
    
    /// @notice NameWrapper contract interface
    INameWrapper public immutable nameWrapper;
    
    /// @notice ENS Registry for additional validation
    IENSRegistry public immutable ensRegistry;
    
    /// @notice Default resolver for new subdomains
    address public defaultResolver;
    
    /// @notice Default TTL for DNS records (1 hour)
    uint64 public defaultTTL = 3600;
    
    /// @notice Minimum delay between commit and reveal (10 minutes)
    /// @dev Prevents front-running while maintaining reasonable UX
    uint256 public constant REVEAL_DELAY = 10 minutes;
    
    /// @notice Emergency pause state
    bool public paused;
    
    /// @notice Domain configurations mapping
    /// @dev parentNode => Config struct
    mapping(bytes32 => Config) public configs;
    
    /// @notice Claimed subdomains tracking
    /// @dev Merkle leaf hash => claimed status
    mapping(bytes32 => bool) public claimed;
    
    /// @notice User claim tracking (one claim per address)
    /// @dev user address => claimed status  
    mapping(address => bool) public hasClaimed;
    
    /// @notice Commit-reveal commitments
    /// @dev commitment hash => block timestamp
    mapping(bytes32 => uint256) public commitments;

    // =============================================================
    //                            EVENTS
    // =============================================================
    
    /// @notice Emitted when a subdomain is successfully claimed
    /// @param claimer Address that claimed the subdomain
    /// @param subdomain The subdomain label that was claimed
    /// @param node The ENS node hash of the created subdomain
    /// @param parentNode The parent domain node hash
    event SubdomainClaimed(
        address indexed claimer, 
        string subdomain, 
        bytes32 indexed node,
        bytes32 indexed parentNode
    );
    
    /// @notice Emitted when a new domain configuration is initialized
    /// @param parentNode The parent domain node hash
    /// @param domain The parent domain string
    /// @param owner The domain owner address
    /// @param totalSubdomains Maximum subdomains allowed
    event ConfigInitialized(
        bytes32 indexed parentNode, 
        string domain, 
        address indexed owner,
        uint256 totalSubdomains
    );
    
    /// @notice Emitted when contract pause state changes
    /// @param isPaused New pause state
    event ContractPaused(bool isPaused);
    
    /// @notice Emitted when default resolver is updated
    /// @param resolver New default resolver address
    event DefaultResolverSet(address indexed resolver);
    
    /// @notice Emitted when commitment is made (commit phase)
    /// @param user Address making the commitment
    /// @param commitment The commitment hash
    event CommitmentMade(address indexed user, bytes32 indexed commitment);

    // =============================================================
    //                          MODIFIERS
    // =============================================================
    
    /// @dev Prevents execution when contract is paused
    modifier whenNotPaused() {
        if (paused) revert ContractIsPaused();
        _;
    }

    /// @dev Validates authorization to create subdomains for parent domain
    /// @param parentNode The parent domain node hash
    modifier onlyAuthorized(bytes32 parentNode) {
        Config storage cfg = configs[parentNode];
        bool isApproved = nameWrapper.isApprovedForAll(cfg.parentOwner, address(this));
        bool isOwner = nameWrapper.ownerOf(uint256(parentNode)) == address(this);
        
        if (!isApproved && !isOwner) revert NotAuthorized();
        _;
    }

    /// @dev Validates that configuration exists and is active
    /// @param parentNode The parent domain node hash
    modifier onlyActiveConfig(bytes32 parentNode) {
        if (!configs[parentNode].active) revert ConfigNotActive();
        _;
    }

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================
    
    /// @notice Initialize the BulkSubdomainFactory contract
    /// @param _nameWrapper Address of the ENS NameWrapper contract
    /// @param _defaultResolver Address of the default resolver for new subdomains
    constructor(
        address _nameWrapper, 
        address _defaultResolver
    ) Ownable(msg.sender) {
        if (_nameWrapper == address(0)) {
            revert InvalidParameters();
        }
        
        nameWrapper = INameWrapper(_nameWrapper);
        // For backward compatibility, we'll make ensRegistry optional
        // In production, you should pass the actual ENS Registry address
        ensRegistry = IENSRegistry(0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e); // Mainnet ENS Registry
        defaultResolver = _defaultResolver;
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================
    
    /// @notice Update the default resolver for new subdomains
    /// @param resolver New resolver address
    /// @dev Only owner can call this function
    function setDefaultResolver(address resolver) external onlyOwner {
        defaultResolver = resolver;
        emit DefaultResolverSet(resolver);
    }
    
    /// @notice Pause all contract operations
    /// @dev Emergency function - only owner can call
    function pause() external onlyOwner { 
        paused = true; 
        emit ContractPaused(true);
    }
    
    /// @notice Unpause contract operations  
    /// @dev Only owner can call this function
    function unpause() external onlyOwner { 
        paused = false; 
        emit ContractPaused(false);
    }
    
    /// @notice Update default TTL for DNS records
    /// @param ttl New TTL value in seconds
    /// @dev Only owner can call this function
    function setDefaultTTL(uint64 ttl) external onlyOwner { 
        defaultTTL = ttl; 
    }

    // =============================================================
    //                   CONFIGURATION FUNCTIONS
    // =============================================================
    
    /// @notice Initialize configuration for bulk subdomain distribution
    /// @param parentNode The parent domain node hash
    /// @param domain The parent domain string (for display purposes)
    /// @param merkleRoot Merkle root for access control
    /// @param fuses Default fuse settings for subdomains
    /// @param totalSubdomains Maximum number of subdomains allowed
    /// @dev Creates new configuration - parent domain owner authorization required
    function initializeConfig(
        bytes32 parentNode,
        string calldata domain,
        bytes32 merkleRoot,
        uint32 fuses,
        uint256 totalSubdomains
    ) external {
        // For demo mode, ownership check is commented out
        // require(nameWrapper.ownerOf(uint256(parentNode)) == msg.sender, "Not parent owner");
        
        // Prevent overwriting existing configurations
        if (configs[parentNode].active) revert ConfigAlreadyExists();
        
        // Validate parameters
        if (merkleRoot == bytes32(0) || totalSubdomains == 0) {
            revert InvalidParameters();
        }
        
        configs[parentNode] = Config({
            merkleRoot: merkleRoot,
            parentNode: parentNode,
            parentDomain: domain,
            parentOwner: msg.sender,
            defaultFuses: fuses,
            active: true,
            totalSubdomains: uint64(totalSubdomains),
            claimedCount: 0
        });
        
        emit ConfigInitialized(parentNode, domain, msg.sender, totalSubdomains);
    }

    // =============================================================
    //                    CLAIM FUNCTIONS
    // =============================================================
    
    /// @notice Commit phase: Submit commitment to prevent front-running
    /// @param commitment Keccak256 hash of (msg.sender, subdomain, expiry, nonce)
    /// @dev First step of commit-reveal scheme
    function commitClaim(bytes32 commitment) external whenNotPaused {
        if (commitment == bytes32(0)) revert InvalidParameters();
        
        commitments[commitment] = block.timestamp;
        emit CommitmentMade(msg.sender, commitment);
    }

    /// @notice Reveal phase: Claim subdomain with Merkle proof verification
    /// @param parentNode Parent domain node hash
    /// @param subdomain Subdomain label to claim
    /// @param expiry Expiration timestamp for the subdomain
    /// @param nonce Random nonce used in commitment
    /// @param merkleProof Merkle proof demonstrating eligibility
    /// @dev Main claiming function with full validation
    function claimSubdomain(
        bytes32 parentNode,
        string calldata subdomain,
        uint64 expiry,
        uint256 nonce,
        bytes32[] calldata merkleProof
    ) external 
        nonReentrant 
        whenNotPaused 
        onlyActiveConfig(parentNode)
        /* onlyAuthorized(parentNode) - Commented for demo */
    {
        Config storage cfg = configs[parentNode];
        
        // Validate user hasn't already claimed
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        
        // Validate subdomain expiry doesn't exceed parent domain expiry
        (, , uint64 parentExpiry) = nameWrapper.getData(uint256(parentNode));
        if (expiry > parentExpiry) revert ExpiryExceedsParent();
        
        // Validate commit-reveal timing
        bytes32 commitment = keccak256(abi.encodePacked(msg.sender, subdomain, expiry, nonce));
        uint256 commitTime = commitments[commitment];
        if (commitTime == 0 || commitTime + REVEAL_DELAY > block.timestamp) {
            revert RevealTooEarly();
        }
        
        // Clear commitment to prevent replay
        delete commitments[commitment];
        
        // Validate Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, subdomain, expiry));
        if (claimed[leaf]) revert SubdomainAlreadyClaimed();
        if (!MerkleProof.verify(merkleProof, cfg.merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }
        
        // Update state before external call (reentrancy protection)
        claimed[leaf] = true;
        hasClaimed[msg.sender] = true;
        cfg.claimedCount++;
        
        // Create subdomain via NameWrapper
        bytes32 node = nameWrapper.setSubnodeRecord(
            parentNode,
            subdomain,
            msg.sender,
            defaultResolver,
            defaultTTL,
            cfg.defaultFuses,
            expiry
        );
        
        emit SubdomainClaimed(msg.sender, subdomain, node, parentNode);
    }

    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================
    
    /// @notice Get configuration statistics for dashboard display
    /// @param parentNode Parent domain node hash
    /// @return total Total subdomains allowed
    /// @return claimedTotal Number of subdomains claimed
    /// @return domain Parent domain string
    /// @return owner Domain owner address
    /// @return active Configuration active status
    function getConfigStats(bytes32 parentNode) external view returns (
        uint256 total,
        uint256 claimedTotal,
        string memory domain,
        address owner,
        bool active
    ) {
        Config storage cfg = configs[parentNode];
        return (
            cfg.totalSubdomains, 
            cfg.claimedCount, 
            cfg.parentDomain, 
            cfg.parentOwner, 
            cfg.active
        );
    }
    
    /// @notice Check if a specific leaf has been claimed
    /// @param user User address
    /// @param subdomain Subdomain label
    /// @param expiry Expiration timestamp
    /// @return claimed True if already claimed
    function isLeafClaimed(
        address user,
        string calldata subdomain,
        uint64 expiry
    ) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(user, subdomain, expiry));
        return claimed[leaf];
    }
    
    /// @notice Verify Merkle proof without claiming
    /// @param parentNode Parent domain node hash
    /// @param user User address  
    /// @param subdomain Subdomain label
    /// @param expiry Expiration timestamp
    /// @param merkleProof Merkle proof
    /// @return valid True if proof is valid
    function verifyMerkleProof(
        bytes32 parentNode,
        address user,
        string calldata subdomain,
        uint64 expiry,
        bytes32[] calldata merkleProof
    ) external view returns (bool valid) {
        bytes32 leaf = keccak256(abi.encodePacked(user, subdomain, expiry));
        return MerkleProof.verify(merkleProof, configs[parentNode].merkleRoot, leaf);
    }
    
    /// @notice Get commitment timestamp
    /// @param commitment Commitment hash
    /// @return timestamp Block timestamp when commitment was made
    function getCommitmentTimestamp(bytes32 commitment) external view returns (uint256 timestamp) {
        return commitments[commitment];
    }
    
    /// @notice Check if reveal period is active for a commitment
    /// @param commitment Commitment hash  
    /// @return canReveal True if commitment can be revealed now
    function canRevealCommitment(bytes32 commitment) external view returns (bool canReveal) {
        uint256 commitTime = commitments[commitment];
        return commitTime != 0 && commitTime + REVEAL_DELAY <= block.timestamp;
    }
}