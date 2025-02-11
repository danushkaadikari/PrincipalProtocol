// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AdminRegistry is Ownable {
    mapping(address => bool) public isAdmin;
    address[] public adminList;

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    constructor() {
        // Add deployer as the first admin
        _addAdmin(msg.sender);
    }

    modifier onlySuperAdmin() {
        require(owner() == msg.sender, "Caller is not the super admin");
        _;
    }

    function addAdmin(address admin) external onlySuperAdmin {
        _addAdmin(admin);
    }

    function removeAdmin(address admin) external onlySuperAdmin {
        require(admin != owner(), "Cannot remove super admin");
        require(isAdmin[admin], "Address is not an admin");
        
        isAdmin[admin] = false;
        
        // Remove from adminList
        for (uint i = 0; i < adminList.length; i++) {
            if (adminList[i] == admin) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }

        emit AdminRemoved(admin);
    }

    function _addAdmin(address admin) internal {
        require(admin != address(0), "Invalid address");
        require(!isAdmin[admin], "Already an admin");
        
        isAdmin[admin] = true;
        adminList.push(admin);
        
        emit AdminAdded(admin);
    }

    function getAdminList() external view returns (address[] memory) {
        return adminList;
    }

    function isAdminOrSuperAdmin(address account) external view returns (bool) {
        return isAdmin[account] || account == owner();
    }
}
