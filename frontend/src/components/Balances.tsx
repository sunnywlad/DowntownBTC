'use client';

import {useReadContracts, useConnection} from 'wagmi';
import {addresses} from '@/constants/addresses';
import {mockWrappedBTCAbi} from '@/constants/abi';
import {formatUnits} from 'viem';

const labels = ["wBTC", "cbBTC", "LBTC"] as const;

export default function Balances() {
  const userAddress = useConnection().address;

  const { data, isLoading, error } = useReadContracts({
    contracts: [
      {
      address: addresses[31337].wbtc,
      abi: mockWrappedBTCAbi,
      functionName: 'balanceOf',
      args: [userAddress!]},
      {
      address: addresses[31337].cbbtc,
      abi: mockWrappedBTCAbi,
      functionName: 'balanceOf',
      args: [userAddress!]},
      {
      address: addresses[31337].lbtc,
      abi: mockWrappedBTCAbi,
      functionName: 'balanceOf',
      args: [userAddress!]}],
    query: { enabled: Boolean(userAddress)}
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
            Votre montant de {label} : {
              dati?.status==="success" ? formatUnits(dati.result, 8) : dati?.status ?? "-"
              }
          </li>)}) }
    </ul>
  )
}
