'use client';

import MintButton from './MintButton';

const labels = [["wBTC", "wbtc"], ["cbBTC", "cbbtc"], ["LBTC", "lbtc"]] as const;

const Faucet = () => {
  return(
    <div className='flex gap-4'>
      {labels.map((label) => {
        return <MintButton key={label[0]} name={label[0]} address={label[1]} />
      })}
    </div>
  )
}

export default Faucet
