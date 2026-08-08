import Connection from '@/components/Connection';
import Reserves from '@/components/Reserves';
import Balances from '@/components/Balances';
import Faucet from '@/components/Faucet';

export default function Home() {
  return (
    <>
      <div className='p-4'>
        <p className='text-xl font-bold pb-2'>Welcome to Merion</p>
        <div className='flex gap-4 pb-2'>
          <Reserves />
          <Connection>
            <Balances />
          </Connection>
        </div>
        <Faucet />

      </div>
    </>
  );
}
