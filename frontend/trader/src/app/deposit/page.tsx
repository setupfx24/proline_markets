import { redirect } from 'next/navigation';

/** Same entry as crucial-ui; funding lives on /wallet in this app. */
export default function DepositPage() {
  redirect('/wallet');
}
