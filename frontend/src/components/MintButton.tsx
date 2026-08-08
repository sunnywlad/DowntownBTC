import {useWriteContract, useConnection, useWaitForTransactionReceipt} from 'wagmi';
import {parseUnits, Address} from 'viem';
import {mockWrappedBTCAbi} from '@/constants/abi';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const mintedAmount = parseUnits("10", 8);

const MintButton = ({name, address}: {name: string, address: Address}) => {
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

  return (
    <div>
      <button
      className='border rounded px-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
      onClick={() => {
        if (!userAddress) return;
        mutate({
        address: address,
        abi: mockWrappedBTCAbi,
        functionName: "mint",
        args: [userAddress, mintedAmount]
      })}}
      disabled={waiting || !userAddress}>
        {waiting ? "Mint en cours" : `Mint ${name}`}
      </button>
      {error && <p>{error.message}</p>}
    </div>
  )
}

export default MintButton;
