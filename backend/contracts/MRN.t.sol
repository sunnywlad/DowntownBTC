// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.36;

import {MRN} from "./MRN.sol";
import {Test} from "forge-std/Test.sol";

contract MRNTest is Test {

  MRN public mrn;
  uint256 public constant FIXED_SUPPLY = 100000000 * 10 ** 18;

  function setUp() public {
    mrn = new MRN();
  }

  function test_metadata() public view {
    assertEq(mrn.name(), "Merion");
    assertEq(mrn.symbol(), "MRN");
  }

  function test_decimalsIs18() public view {
    assertEq(mrn.decimals(), 18);
  }

  function test_fixedSupplyMintedToDeployer() public view {
    assertEq(mrn.totalSupply(), FIXED_SUPPLY);
    assertEq(mrn.balanceOf(address(this)), FIXED_SUPPLY);
  }

  function test_transferMovesBalance() public {
    address alice = address(0xA11CE);
    mrn.transfer(alice, 1000 * 10 ** 18);

    assertEq(mrn.balanceOf(alice), 1000 * 10 ** 18);
    assertEq(mrn.balanceOf(address(this)), FIXED_SUPPLY - 1000 * 10 ** 18);
    assertEq(mrn.totalSupply(), FIXED_SUPPLY);
  }
}
