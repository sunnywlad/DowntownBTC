// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Pool} from "./Pool.sol";
import {Test} from "forge-std/Test.sol";

contract PoolTest is Test {
  Pool pool;

  function setUp() public {
    pool = new Pool();
  }
}
