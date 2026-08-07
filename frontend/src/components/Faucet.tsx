'use client';
import {useWriteContract, useConnection, useWaitForTransactionReceipt} from 'wagmi';
import {parseUnits} from 'viem';
import {addresses} from '@/constants/addresses';
import {mockWrappedBTCAbi} from '@/constants/abi';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const mintedAmount = parseUnits("10", 8);

const Faucet = () => {
  const userAddress = useConnection().address;
  const { mutate, isPending, error, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  const waiting = isPending || isLoading;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries();
    }
  }, [isSuccess, queryClient]);

  if (userAddress) {return (
    <div>
      <button
      className='border rounded px-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
      onClick={() => mutate({
        address: addresses[31337].wbtc,
        abi: mockWrappedBTCAbi,
        functionName: "mint",
        args: [userAddress, mintedAmount]
      })}
      disabled={waiting}>
        {waiting ? "Mint en cours" : "Mint wBTC"}
      </button>
      {error && <p>{error.message}</p>}
    </div>
  )}
}

export default Faucet
