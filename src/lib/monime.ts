type MonimeCheckoutLineItem = {
  name: string;
  quantity: number;
  type: 'custom';
  reference: string;
  price: {
    currency: string;
    value: number;
  };
  description?: string;
};

export type CreateMonimeCheckoutSessionInput = {
  reference: string;
  name: string;
  successUrl: string;
  cancelUrl: string;
  callbackState: string;
  lineItems: MonimeCheckoutLineItem[];
  financialAccountId?: string;
  metadata?: Record<string, string>;
};

type MonimeRequestOptions = {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
};

type MonimePaymentResponse = {
  id?: string;
  status?: string;
  reference?: string;
  ownershipGraph?: {
    owner?: {
      type?: string;
      id?: string;
    };
  };
};

type MonimeCheckoutSessionResponse = {
  id?: string;
  status?: string;
  reference?: string;
  orderNumber?: string;
  metadata?: Record<string, string>;
};

const DEFAULT_MONIME_VERSION = 'caph.2025-08-23';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getMonimeConfig() {
  return {
    apiBaseUrl: process.env.MONIME_API_BASE_URL || 'https://api.monime.io',
    bearerToken: getRequiredEnv('MONIME_BEARER_TOKEN'),
    spaceId: getRequiredEnv('MONIME_SPACE_ID'),
    apiVersion: process.env.MONIME_VERSION || DEFAULT_MONIME_VERSION,
    financialAccountId: process.env.MONIME_FINANCIAL_ACCOUNT_ID,
    currency: process.env.MONIME_CURRENCY || 'SLE',
    webhookSecret: process.env.MONIME_WEBHOOK_SECRET,
  };
}

async function monimeRequest<T>(path: string, options: MonimeRequestOptions = {}): Promise<{ data: T; requestId: string | null }> {
  const config = getMonimeConfig();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${config.bearerToken}`,
      'Content-Type': 'application/json',
      'Monime-Space-Id': config.spaceId,
      'Monime-Version': config.apiVersion,
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const requestId = response.headers.get('Monime-Request-Id');
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  const unwrappedData = data?.result ?? data;

  if (!response.ok) {
    const errorMessage =
      typeof data?.message === 'string' ? data.message :
        typeof data?.error?.message === 'string' ? data.error.message :
          typeof data?.detail === 'string' ? data.detail :
            typeof data?.error === 'string' ? data.error :
              `Monime request failed with status ${response.status}`;
    throw new Error(requestId ? `${errorMessage} (Monime-Request-Id: ${requestId})` : errorMessage);
  }

  return { data: unwrappedData as T, requestId };
}

export async function createMonimeCheckoutSession(input: CreateMonimeCheckoutSessionInput, idempotencyKey: string) {
  const config = getMonimeConfig();

  return monimeRequest<{
    id: string;
    redirectUrl: string;
    paymentId?: string;
    status?: string;
  }>('/v1/checkout-sessions', {
    method: 'POST',
    idempotencyKey,
    body: {
      reference: input.reference,
      name: input.name,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      callbackState: input.callbackState,
      lineItems: input.lineItems,
      financialAccountId: input.financialAccountId || config.financialAccountId,
      metadata: input.metadata,
    },
  });
}

export async function getMonimePayment(paymentId: string) {
  return monimeRequest<MonimePaymentResponse>(`/v1/payments/${paymentId}`);
}

export async function getMonimeCheckoutSession(checkoutSessionId: string) {
  return monimeRequest<MonimeCheckoutSessionResponse>(`/v1/checkout-sessions/${checkoutSessionId}`);
}
