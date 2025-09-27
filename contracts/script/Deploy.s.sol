// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Script.sol";
import "../src/BulkSubdomainFactory.sol";

contract Deploy is Script {
    function run() external {
        // Load your .env values
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address resolver = vm.envAddress("RESOLVER_ADDR");
        address wrapper = vm.envAddress("NAMEWRAPPER_ADDR");

        vm.startBroadcast(pk);

        BulkSubdomainFactory factory = new BulkSubdomainFactory(wrapper, resolver);

        vm.stopBroadcast();

        console.log("BulkSubdomainFactory deployed at:", address(factory));
    }
}
