// SPDX-License-Identifier: MIT

pragma solidity 0.8.36;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Pool is ERC20, Ownable {


  address public immutable token0;
  address public immutable token1;
  address public immutable token2;

  uint256[3] public reserves;

  uint256 public feeNum;
  uint256 constant MAX_FEE_NUM = 10;
  uint256 constant FEE_DEN = 1000;

  uint256 public lastFeeUpdate;
  uint256 constant MIN_SET_FEE_DELAY = 1 days;

  uint256 constant MINIMUM_LIQUIDITY = 1000;

  constructor(address[3] memory _tokens, uint256 _feeNum, address _feesetter) ERC20("DowntownLP", "DLP") Ownable(_feesetter) {
    require(_feeNum <= MAX_FEE_NUM, "too expansive fees");
    feeNum = _feeNum;
    lastFeeUpdate = block.timestamp;

    token0 = _tokens[0];
    token1 = _tokens[1];
    token2 = _tokens[2];
  }

  function decimals() public pure override returns(uint8) {
    return 8;
  }

  function setFees(uint256 _feeNum) external onlyOwner {
    require(_feeNum <= MAX_FEE_NUM, "too expansive fees");
    require(block.timestamp - lastFeeUpdate >= MIN_SET_FEE_DELAY, "fees to be set later");
    feeNum = _feeNum;
    lastFeeUpdate = block.timestamp;
  }

  function indexToAddress(uint256 _tokenIndex) internal view returns (address tokenAddress) {
    require(_tokenIndex < 3, "bad index");
    if (_tokenIndex == 0) {
      tokenAddress = token0;
    }  else if (_tokenIndex == 1) {
      tokenAddress = token1;
    } else if (_tokenIndex == 2) {
      tokenAddress = token2;
    }
  }

  function addLiquidity(uint256 _tokenIndex, uint256 _amount, uint256 _minIn) external returns (uint256 mintedLPTokens) {
    // Les trois tokens WBTC, LBTC et cbBTC ont comme transferFrom true ou revert, et ne sont pas des tokens à frais de transfert : pas besoin de vérifier balanceOf
    if (totalSupply() == 0) {
      for (uint256 i; i < 3; i++) {
      IERC20(indexToAddress(i)).transferFrom(msg.sender, address(this), _amount);
      }
      mintedLPTokens = 3 * _amount - MINIMUM_LIQUIDITY;
      _mint(0x000000000000000000000000000000000000dEaD, MINIMUM_LIQUIDITY);
      reserves[0] = reserves[1] = reserves[2] = _amount;
    } else {
      uint256 reserve = reserves[_tokenIndex];
      mintedLPTokens = totalSupply() * _amount / reserve;
      for (uint256 i; i < 3; i++) {
        uint256 amount_i = _amount * reserves[i] / reserve;
        IERC20(indexToAddress(i)).transferFrom(msg.sender, address(this), amount_i);
        reserves[i] += amount_i;
      }
    }
    require(mintedLPTokens >= _minIn, "bad slippage");
    _mint(msg.sender, mintedLPTokens);
  }

  function removeLiquidity(uint256 _toBurnLPTokens, uint256[3] calldata _minOut) external returns (uint256[3] memory tokensBack) {
    uint256 supply = totalSupply();
    for (uint256 i; i < 3; i++) {
      tokensBack[i] = reserves[i] * _toBurnLPTokens / supply;
      require(tokensBack[i] >= _minOut[i], "bad slippage");
      reserves[i] -= tokensBack[i];
    }
    _burn(msg.sender, _toBurnLPTokens);
    for (uint256 i; i < 3; i++) {
      IERC20(indexToAddress(i)).transfer(msg.sender, tokensBack[i]);
    }
  }

  function swap(uint256 _indexSold, uint256 _amount, uint256 _indexBought, uint256 _minOut) external returns (uint256 tokensBought) {
    uint256 amountAfterFees = _amount * (FEE_DEN - feeNum) / FEE_DEN;
    tokensBought = amountAfterFees * reserves[_indexBought] / (amountAfterFees + reserves[_indexSold]);
    require(tokensBought >= _minOut, "bad slippage");

    reserves[_indexSold] += _amount;
    reserves[_indexBought] -= tokensBought;

    IERC20(indexToAddress(_indexSold)).transferFrom(msg.sender, address(this), _amount);
    IERC20(indexToAddress(_indexBought)).transfer(msg.sender, tokensBought);
  }

}
