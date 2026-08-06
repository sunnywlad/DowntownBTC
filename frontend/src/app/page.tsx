import Connection from '@/components/Connection';
import Reserves from '@/components/Reserves';
import Balances from '@/components/Balances';

export default function Home() {
  return (
    <>
    <Connection>
      <p>Welcome to Merion</p>
      <Reserves />
      <Balances />
    </Connection>
    </>
  );
}
