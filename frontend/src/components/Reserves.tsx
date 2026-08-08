'use client';

import {useReserves} from '@/hooks/useReserves';
import {formatUnits} from 'viem';
import { tokensInfo } from '@/constants/addresses';

export default function Reserves() {
  const { data, isLoading, error } = useReserves();

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
