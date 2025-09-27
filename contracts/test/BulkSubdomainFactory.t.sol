// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import "forge-std/Test.sol";
import "../src/BulkSubdomainFactory.sol";

contract MockNameWrapper {
    mapping(uint256 => address) public owners;
    event SetSubnodeRecord(bytes32 parentNode, string label, address owner);
    function setOwner(uint256 id, address owner_) external {
        owners[id] = owner_;
    }
    function ownerOf(uint256 id) external view returns (address) {
        return owners[id];
    }
    function isApprovedForAll(address owner, address operator) external pure returns (bool) {
        return true;
    }
    function setSubnodeRecord(
        bytes32 parentNode, string calldata label,
        address owner, address, uint64, uint32, uint64
    ) external returns (bytes32 node) {
        emit SetSubnodeRecord(parentNode, label, owner);
        owners[uint256(keccak256(abi.encodePacked(parentNode, keccak256(bytes(label)))))] = owner;
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
    }
}

contract BulkSubdomainFactoryTest is Test {
    BulkSubdomainFactory factory;
    MockNameWrapper nameWrapper;
    address owner = address(0x1);
    address user = address(0x2);
    bytes32 parentNode = bytes32(uint256(2222));
    string domain = "myparent.eth";
    address resolver = address(0x9);

    function setUp() public {
        vm.startPrank(owner);
        nameWrapper = new MockNameWrapper();
        nameWrapper.setOwner(uint256(parentNode), owner);
        factory = new BulkSubdomainFactory(address(nameWrapper), resolver);
        factory.initializeConfig(
            parentNode, domain, keccak256("root"),
            3, 100
        );
        vm.stopPrank();
    }

    function testCommitAndClaim() public {
        // simulate frontend: commit
        uint64 expiry = uint64(block.timestamp + 1 days);
        uint256 nonce = 1;
        string memory label = "alice";
        bytes32 commitment = keccak256(abi.encodePacked(user, label, expiry, nonce));
        vm.prank(user);
        factory.commitClaim(commitment);

        // simulate time passing
        vm.warp(block.timestamp + 11 minutes);

        // "proof" not valid but contract expects you to have correct merkle tree!
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = keccak256(abi.encodePacked(user, label, expiry)); // dummy
        vm.prank(user);
        vm.expectRevert("Invalid proof");
        factory.claimSubdomain(parentNode, label, expiry, nonce, proof);
    }

    function testConfigStats() public {
        (uint256 total, uint256 claimed, string memory dom, address own, bool active) = factory.getConfigStats(parentNode);
        assertEq(total, 100);
        assertEq(claimed, 0);
        assertEq(dom, domain);
        assertEq(own, owner);
        assertEq(active, true);
    }

    function testPauseUnpause() public {
        vm.prank(owner);
        factory.pause();
        assertTrue(factory.paused());
        vm.prank(owner);
        factory.unpause();
        assertFalse(factory.paused());
    }
}
