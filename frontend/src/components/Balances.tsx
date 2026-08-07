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

  let content;

  if (isLoading) content = <p>Loading</p>;
  else if (error) content = <p>Error : {error.message}</p>;
  else content =
    <ul>
      { labels.map((label, i) => {
        const dati = data?.[i];
        let value;
        if (!dati) value = "No data";
        else if (dati.status === "success") value = formatUnits(dati.result, 8);
        else value = dati.error?.message ?? "échec";
        return(
          <li key={label}>
            Votre montant de {label} : {value}
          </li>)}) }
    </ul>;
  return (
    <div className='border rounded p-4'>
      {content}
    </div>
  )
}
