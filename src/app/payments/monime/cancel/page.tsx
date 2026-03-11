import { CancelClient } from './CancelClient';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MonimeCancelPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <CancelClient
      attemptId={typeof params.attemptId === 'string' ? params.attemptId : undefined}
      orderId={typeof params.orderId === 'string' ? params.orderId : undefined}
      callbackState={typeof params.callbackState === 'string' ? params.callbackState : undefined}
    />
  );
}
