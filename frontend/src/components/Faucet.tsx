'use client';

import MintButton from './MintButton';
import {tokensInfo} from '@/constants/addresses';

const Faucet = () => {
  return(
    <div className='flex gap-4'>
      {tokensInfo.map((token) => {
        return <MintButton key={token.name} name={token.name} address={token.address} />
      })}
    </div>
  )
}

export default Faucet
