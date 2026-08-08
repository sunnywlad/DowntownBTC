'use client';

import {useReadContracts, useConnection} from 'wagmi';
import {tokensInfo} from '@/constants/addresses';
import {mockWrappedBTCAbi} from '@/constants/abi';
import {formatUnits} from 'viem';

export default function Balances() {
  const userAddress = useConnection().address;

  const { data, isLoading, error } = useReadContracts({
    contracts: tokensInfo.map((token) => {
      return {
        address: token.address,
        abi: mockWrappedBTCAbi,
        functionName: 'balanceOf',
        args: [userAddress!]
      } as const;
    }),
    query: { enabled: Boolean(userAddress)}
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
            Votre montant de {token.name} : {value}
          </li>)}) }
    </ul>;
  return (
    <div className='border rounded p-4'>
      {content}
    </div>
  )
}
