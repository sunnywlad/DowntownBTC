'use client';

import {useReadContracts} from 'wagmi';
import {addresses} from '@/constants/addresses';
import {poolAbi} from '@/constants/abi';
import {formatUnits} from 'viem';

const labels = ["wBTC", "cbBTC", "LBTC"] as const;

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
    <ul>
      { labels.map((label, i) => {
        const dati = data?.[i];
        return(
          <li key={label}>
            Réserves de {label} : {
              dati?.status==="success" ? formatUnits(dati.result, 8) : dati?.status ?? "-"
              }
          </li>)}) }
    </ul>
  )
}
