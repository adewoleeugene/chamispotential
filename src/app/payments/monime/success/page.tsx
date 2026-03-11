import { SuccessClient } from './SuccessClient';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MonimeSuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <SuccessClient
      attemptId={typeof params.attemptId === 'string' ? params.attemptId : undefined}
      orderId={typeof params.orderId === 'string' ? params.orderId : undefined}
      callbackState={typeof params.callbackState === 'string' ? params.callbackState : undefined}
    />
  );
}
