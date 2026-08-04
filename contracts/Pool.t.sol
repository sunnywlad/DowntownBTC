// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.36;

import {Pool} from "./Pool.sol";
import {MockWrappedBTC} from "./MockWrappedBTC.sol";
import {Test} from "forge-std/Test.sol";

contract PoolTest is Test {

  MockWrappedBTC public wbtc;
  MockWrappedBTC public cbbtc;
  MockWrappedBTC public lbtc;
  Pool public pool;

  function setUp() public {
    wbtc = new MockWrappedBTC("Wrapped BTC", "wBTC");
    cbbtc = new MockWrappedBTC("Coinbase BTC", "cbBTC");
    lbtc = new MockWrappedBTC("Lombard BTC", "lBTC");

    address[3] memory tokens = [address(wbtc), address(cbbtc), address(lbtc)];
    uint256 feeNum = 5;
    address feeSetter = address(this);

    pool = new Pool(tokens, feeNum, feeSetter);

    wbtc.mint(address(this), 1000 * 10 ** 8);
    cbbtc.mint(address(this), 1000 * 10 ** 8);
    lbtc.mint(address(this), 1000 * 10 ** 8);

    wbtc.approve(address(pool), 1000 * 10 ** 8);
    cbbtc.approve(address(pool), 1000 * 10 ** 8);
    lbtc.approve(address(pool), 1000 * 10 ** 8);
  }

  function test_addLiquidity() public {
    pool.addLiquidity(0, 100 * 10 **8, 0);
    pool.addLiquidity(1, 100 * 10 **8, 0);
  }

  function test_removeLiquidity() public {
    pool.addLiquidity(0, 100 * 10 **8, 0);
    pool.removeLiquidity(pool.balanceOf(address(this)) / 2, [uint256(0), 0, 0]);
  }

  function test_swap() public {
    pool.addLiquidity(0, 100 * 10 **8, 0);
    pool.swap(0, 10 * 10 ** 8, 2, 0);
  }
}
