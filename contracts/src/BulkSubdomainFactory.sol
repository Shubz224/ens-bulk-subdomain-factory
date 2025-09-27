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
}

contract BulkSubdomainFactory is Ownable, ReentrancyGuard {
    struct Config {
        bytes32 merkleRoot;
        bytes32 parentNode;
        string parentDomain;
        address parentOwner;
        uint32 defaultFuses;
        bool active;
        uint256 totalSubdomains;
        uint256 claimedCount;
    }
    INameWrapper public immutable nameWrapper;
    address public defaultResolver;
    uint64 public defaultTTL = 3600; // 1 hour
    uint256 public constant REVEAL_DELAY = 10 minutes;
    bool public paused;
    mapping(bytes32 => Config) public configs;              // parentNode => config
    mapping(bytes32 => bool) public claimed;                // leaf => claimed
    mapping(address => bool) public hasClaimed;             // user => claimed
    mapping(bytes32 => uint256) public commitments;         // commitment => timestamp

    event SubdomainClaimed(address indexed claimer, string subdomain, bytes32 indexed node);
    event ConfigInitialized(bytes32 indexed parentNode, string domain, address owner);
    event ContractPaused(bool isPaused);
    event DefaultResolverSet(address resolver);

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    modifier onlyAuthorized(bytes32 parentNode) {
        Config storage cfg = configs[parentNode];
        require(
            nameWrapper.isApprovedForAll(cfg.parentOwner, address(this)) || 
            nameWrapper.ownerOf(uint256(parentNode)) == address(this),
            "Not authorized"
        );
        _;
    }

    constructor(address _nameWrapper, address _defaultResolver) Ownable(msg.sender) {
        nameWrapper = INameWrapper(_nameWrapper);
        defaultResolver = _defaultResolver;
    }

    // Admin
    function setDefaultResolver(address resolver) external onlyOwner {
        defaultResolver = resolver;
        emit DefaultResolverSet(resolver);
    }
    function pause() external onlyOwner { paused = true; emit ContractPaused(true);}
    function unpause() external onlyOwner { paused = false; emit ContractPaused(false);}
    function setDefaultTTL(uint64 ttl) external onlyOwner { defaultTTL = ttl; }

    // Set up a new config for a parent node
    function initializeConfig(
        bytes32 parentNode, string calldata domain, bytes32 merkleRoot,
        uint32 fuses, uint256 totalSubdomains
    ) external {
        //For Demo mode 

       // require(nameWrapper.ownerOf(uint256(parentNode)) == msg.sender, "Not parent owner");
        configs[parentNode] = Config({
            merkleRoot: merkleRoot,
            parentNode: parentNode,
            parentDomain: domain,
            parentOwner: msg.sender,
            defaultFuses: fuses,
            active: true,
            totalSubdomains: totalSubdomains,
            claimedCount: 0
        });
        emit ConfigInitialized(parentNode, domain, msg.sender);
    }

    // Anti front-running: commit-reveal phase
    function commitClaim(bytes32 commitment) external whenNotPaused {
        commitments[commitment] = block.timestamp;
    }

    // Main: claim subdomain with commit-reveal and Merkle proof
    function claimSubdomain(
        bytes32 parentNode,
        string calldata subdomain,
        uint64 expiry,
        uint256 nonce,
        bytes32[] calldata merkleProof
    ) external nonReentrant whenNotPaused /* onlyAuthorized(parentNode) */ {
        Config storage cfg = configs[parentNode];
        require(cfg.active, "Config not active");
        require(!hasClaimed[msg.sender], "Already claimed");

        // commit-reveal
        bytes32 commitment = keccak256(abi.encodePacked(msg.sender, subdomain, expiry, nonce));
        require(commitments[commitment] + REVEAL_DELAY <= block.timestamp, "Too early");
        delete commitments[commitment];

        // merkle
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, subdomain, expiry));
        require(!claimed[leaf], "Already claimed");
        require(MerkleProof.verify(merkleProof, cfg.merkleRoot, leaf), "Invalid proof");

        // reentrancy protection
        claimed[leaf] = true;
        hasClaimed[msg.sender] = true;
        cfg.claimedCount++;

        // mint
        bytes32 node = nameWrapper.setSubnodeRecord(
            parentNode,
            subdomain,
            msg.sender,
            defaultResolver,
            defaultTTL,
            cfg.defaultFuses,
            expiry
        );
        emit SubdomainClaimed(msg.sender, subdomain, node);
    }

    // For demo dashboard: get config stats
    function getConfigStats(bytes32 parentNode) external view returns (
        uint256 total,
        uint256 claimed,
        string memory domain,
        address owner,
        bool active
    ) {
        Config storage cfg = configs[parentNode];
        return (cfg.totalSubdomains, cfg.claimedCount, cfg.parentDomain, cfg.parentOwner, cfg.active);
    }
}
