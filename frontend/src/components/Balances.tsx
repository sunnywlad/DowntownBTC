'use client';

import {useReadContracts, useConnection} from 'wagmi';
import {addresses} from '@/constants/addresses';
import {mockWrappedBTCAbi} from '@/constants/abi';

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
    <div>
      <ul>
        <li>Votre montant de wBTC {data?.[0].result}</li>
        <li>Votre montant de cbBTC {data?.[1].result}</li>
        <li>Votre montant de LBTC {data?.[2].result}</li>
      </ul>
    </div>
  )
}
