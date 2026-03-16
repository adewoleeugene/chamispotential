'use client';

import React from 'react';
import { CreditCard, ReceiptText, Smartphone, Wallet } from 'lucide-react';
import {
  type ManualPaymentFlow,
  type ManualPaymentMethod,
  type PaymentChannel,
  getManualPaymentMethodLabel,
} from '@/lib/payment-flow';

type PaymentFlowSelectorProps = {
  paymentChannel: PaymentChannel;
  onPaymentChannelChange: (value: PaymentChannel) => void;
  manualPaymentMethod: ManualPaymentMethod;
  onManualPaymentMethodChange: (value: ManualPaymentMethod) => void;
  manualPaymentFlow: ManualPaymentFlow;
  onManualPaymentFlowChange: (value: ManualPaymentFlow) => void;
};

const manualPaymentOptions: Array<{
  value: ManualPaymentMethod;
  description: string;
  icon: typeof Wallet;
}> = [
  { value: 'cash', description: 'Fast counter settlement for walk-ins and table turns.', icon: Wallet },
  { value: 'card', description: 'Record POS terminal or swipe payments without leaving the order.', icon: CreditCard },
  { value: 'mobile', description: 'Use mobile money or transfer and keep service moving.', icon: Smartphone },
];

export default function PaymentFlowSelector({
  paymentChannel,
  onPaymentChannelChange,
  manualPaymentMethod,
  onManualPaymentMethodChange,
  manualPaymentFlow,
  onManualPaymentFlowChange,
}: PaymentFlowSelectorProps) {
  return (
    <div className="payment-flow-panel">
      <div className="payment-flow-grid">
        <button
          type="button"
          className={`payment-flow-card ${paymentChannel === 'manual' ? 'active' : ''}`}
          onClick={() => onPaymentChannelChange('manual')}
        >
          <div className="payment-flow-icon">
            <ReceiptText size={16} />
          </div>
          <div className="payment-flow-copy">
            <div className="payment-flow-title">Manual Checkout</div>
            <div className="payment-flow-text">Collect payment here and keep the team in one screen.</div>
          </div>
        </button>

        <button
          type="button"
          className={`payment-flow-card ${paymentChannel === 'monime' ? 'active' : ''}`}
          onClick={() => onPaymentChannelChange('monime')}
        >
          <div className="payment-flow-icon">
            <CreditCard size={16} />
          </div>
          <div className="payment-flow-copy">
            <div className="payment-flow-title">Monime Checkout</div>
            <div className="payment-flow-text">Launch hosted checkout and wait for provider confirmation.</div>
          </div>
        </button>
      </div>

      {paymentChannel === 'manual' ? (
        <>
          <div className="manual-method-grid">
            {manualPaymentOptions.map((option) => {
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`manual-method-card ${manualPaymentMethod === option.value ? 'active' : ''}`}
                  onClick={() => onManualPaymentMethodChange(option.value)}
                >
                  <div className="manual-method-header">
                    <Icon size={15} />
                    <strong>{getManualPaymentMethodLabel(option.value)}</strong>
                  </div>
                  <span>{option.description}</span>
                </button>
              );
            })}
          </div>

          <div className="payment-flow-note">
            Record the payment method and confirm. Keep it in draft if not paid yet.
          </div>
        </>
      ) : (
        <div className="payment-flow-note">
          Monime keeps the order in payment confirmation until the hosted checkout or webhook reports a final result.
        </div>
      )}
    </div>
  );
}
