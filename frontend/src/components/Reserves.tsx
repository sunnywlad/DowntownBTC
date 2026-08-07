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
            Réserves de {label} : {value}
          </li>)}) }
    </ul>;
  return (
    <div className='border rounded p-4'>
      {content}
    </div>
  )
}
