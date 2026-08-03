// SPDX-License-Identifier: MIT

pragma solidity 0.8.36;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWrappedBTC is ERC20 {

  constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
  }

  function decimals() public pure override returns (uint8) {
    return 8;
  }

  function mint(address account, uint256 value) external {
    _mint(account, value);
  }
}
