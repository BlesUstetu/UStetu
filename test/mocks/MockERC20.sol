// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _customDecimals;
    uint256 public transferFeeBps;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _customDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setTransferFeeBps(uint256 bps) external {
        require(bps <= 10_000, "FEE_TOO_HIGH");
        transferFeeBps = bps;
    }

    function _update(address from, address to, uint256 amount) internal override {
        uint256 fee = transferFeeBps == 0 || from == address(0) || to == address(0)
            ? 0
            : (amount * transferFeeBps) / 10_000;
        if (fee == 0) {
            super._update(from, to, amount);
            return;
        }
        super._update(from, to, amount - fee);
        super._update(from, address(0), fee);
    }
}
