// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract AdminRegistry is Ownable2Step {
    mapping(address => bool) public isAdmin;
    address[] public adminList;

    // Maximum number of admins allowed
    uint256 public maxAdminLimit;

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event MaxAdminLimitUpdated(uint256 newMaxAdminLimit);

    constructor(uint256 _initialMaxAdminLimit) {
        maxAdminLimit = _initialMaxAdminLimit;
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
        require(adminList.length < maxAdminLimit, "Maximum admin limit reached");
        
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

    /**
     * @notice Updates the maximum number of admins allowed
     * @param _newMaxAdminLimit New maximum admin limit
     */
    function setMaxAdminLimit(uint256 _newMaxAdminLimit) external onlySuperAdmin {
        // Can only increase the limit or keep it the same if there are already admins
        if (adminList.length > 0) {
            require(_newMaxAdminLimit >= adminList.length, "Cannot set limit below current admin count");
        }
        
        maxAdminLimit = _newMaxAdminLimit;
        emit MaxAdminLimitUpdated(_newMaxAdminLimit);
    }
}
