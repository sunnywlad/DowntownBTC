// SPDX-License-Identifier: MIT

pragma solidity 0.8.36;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MRN is ERC20 {
  constructor() ERC20("Merion", "MRN") {
    _mint(msg.sender, 100000000 * 10**18);
  }
}
