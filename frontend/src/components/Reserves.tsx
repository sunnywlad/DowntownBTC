'use client';

import {useReadContracts} from 'wagmi';
import {addresses, tokensInfo} from '@/constants/addresses';
import {poolAbi} from '@/constants/abi';
import {formatUnits} from 'viem';

export default function Reserves() {
  const { data, isLoading, error } = useReadContracts({
    contracts: tokensInfo.map((token) => {
      return {
        address: addresses[31337].pool,
        abi: poolAbi,
        functionName: 'reserves',
        args: [token.index]
      } as const;
    })
  })

  let content;

  if (isLoading) content = <p>Loading</p>;
  else if (error) content = <p>Error : {error.message}</p>;
  else content =
    <ul>
      { tokensInfo.map((token, i) => {
        const dati = data?.[i];
        let value;
        if (!dati) value = "No data";
        else if (dati.status === "success") value = formatUnits(dati.result, 8);
        else value = dati.error?.message ?? "échec";
        return(
          <li key={token.name}>
            Réserves de {token.name} : {value}
          </li>)}) }
    </ul>;
  return (
    <div className='border rounded p-4'>
      {content}
    </div>
  )
}
