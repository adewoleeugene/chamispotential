'use client';

import React from 'react';
import { CreditCard, ReceiptText, type LucideIcon } from 'lucide-react';
import {
  type ManualPaymentFlow,
  type ManualPaymentMethod,
  type PaymentChannel,
} from '@/lib/payment-flow';

type PaymentFlowSelectorProps = {
  paymentChannel: PaymentChannel;
  onPaymentChannelChange: (value: PaymentChannel) => void;
  manualPaymentMethod: ManualPaymentMethod;
  onManualPaymentMethodChange: (value: ManualPaymentMethod) => void;
  manualPaymentFlow: ManualPaymentFlow;
  onManualPaymentFlowChange: (value: ManualPaymentFlow) => void;
};

export default function PaymentFlowSelector({
  paymentChannel,
  onPaymentChannelChange,
}: PaymentFlowSelectorProps) {
  const channelOptions: Array<{
    value: PaymentChannel;
    title: string;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      value: 'manual',
      title: 'Manual Checkout',
      description: 'Collect payment here and keep the team in one screen.',
      icon: ReceiptText,
    },
    {
      value: 'monime',
      title: 'Monime Checkout',
      description: 'Launch hosted checkout and wait for provider confirmation.',
      icon: CreditCard,
    },
  ];

  return (
    <div className="payment-flow-panel">
      <div className="category-tabs payment-channel-tabs" role="tablist" aria-label="Checkout mode">
        {channelOptions.map((option) => {
          const Icon = option.icon;
          const isActive = paymentChannel === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`category-tab payment-channel-tab ${isActive ? 'active' : ''}`}
              onClick={() => onPaymentChannelChange(option.value)}
            >
              <Icon size={14} />
              <span>{option.title}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
