'use client';

import {useReadContracts} from 'wagmi';
import {addresses} from '@/constants/addresses';
import {poolAbi} from '@/constants/abi';

export default function Reserves() {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      {
      address: addresses[31337].pool,
      abi: poolAbi,
      functionName: 'reserves',
      args: [0n]},
      {
      address: addresses[31337].pool,
      abi: poolAbi,
      functionName: 'reserves',
      args: [1n]},
      {
      address: addresses[31337].pool,
      abi: poolAbi,
      functionName: 'reserves',
      args: [2n]}]
  })


  if (isLoading) {
    return (
      <p>Loading</p>
    )
  }
  if (!isLoading && error) {
    return (
      <>Error : {error.message}</>
    )
  }
  return (
    <div>
      <ul>
        <li>Reserves de wBTC {data?.[0].result}</li>
        <li>Reserves de cbBTC {data?.[1].result}</li>
        <li>Reserves de LBTC {data?.[2].result}</li>
      </ul>
    </div>
  )
}
