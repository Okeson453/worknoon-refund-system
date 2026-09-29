import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { CustomerSwitcher } from '../components/refund/CustomerSwitcher';
import { OrderPicker } from '../components/refund/OrderPicker';
import { ItemSelector } from '../components/refund/ItemSelector';
import { RefundChat } from '../components/refund/RefundChat';
import { RefundResult } from '../components/refund/RefundResult';
import { ScenarioChips, type Scenario } from '../components/refund/ScenarioChips';
import { Card } from '../components/common/Card';
import { useCustomers } from '../hooks/useCustomers';
import { useOrders } from '../hooks/useOrders';
import { useRefund } from '../hooks/useRefund';
import { useToast } from '../app/providers';
import { useDevSession } from '../dev/SessionContext';
import { formatCurrency } from '../utils/formatCurrency';
import { daysSince } from '../utils/formatDate';
import { MESSAGE_MAX_LENGTH, MESSAGE_MIN_LENGTH, type ChatEntry } from '../types/refund';

let entryCounter = 0;
function nextEntryId(): string {
  entryCounter += 1;
  return `entry-${entryCounter}-${Date.now()}`;
}

export function CustomerRefundPage(): JSX.Element {
  const { customers, isLoading, error: customersError, refetch } = useCustomers();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const { orders, isLoading: isLoadingOrders, error: ordersError } = useOrders(customerId);
  const { state, result, error, submit, reset } = useRefund();
  const { pushToast } = useToast();
  const devSession = useDevSession();

  const selectedOrder = useMemo(() => orders.find((order) => order.id === orderId) ?? null, [orders, orderId]);
  const items = useMemo(() => selectedOrder?.items ?? [], [selectedOrder]);
  const selectedTotalCents = useMemo(
    () => items.filter((item) => itemIds.includes(item.id)).reduce((total, item) => total + item.priceCents * item.quantity, 0),
    [items, itemIds],
  );

  const isBusy = state === 'validating' || state === 'submitting';

  const handleCustomerChange = useCallback((nextCustomerId: string) => {
    setCustomerId(nextCustomerId === '' ? null : nextCustomerId);
    setOrderId(null);
    setItemIds([]);
  }, []);

  const handleOrderChange = useCallback((nextOrderId: string) => {
    setOrderId(nextOrderId);
    setItemIds([]);
  }, []);

  const handleToggleItem = useCallback((itemId: string) => {
    setItemIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  }, []);

  const handleSelectAll = useCallback(() => {
    setItemIds((current) => (current.length === items.length ? [] : items.map((item) => item.id)));
  }, [items]);

  const handleApplyScenario = useCallback(
    (scenario: Scenario) => {
      setCustomerId(scenario.customerId);
      setOrderId(scenario.orderId);
      setItemIds(scenario.itemIds);
      setMessage(scenario.message);
      setValidationMessage(null);
      reset();
    },
    [reset],
  );

  // Dev-only: publish the current selection so the recording calls out what the policy sees on camera.
  useEffect(() => {
    if (devSession === null) return;
    const lines: string[] = [];
    lines.push(`customer   ${customerId ?? '—'}`);
    lines.push(`order      ${orderId ?? '—'}`);
    lines.push(`items      ${itemIds.length > 0 ? itemIds.join(', ') : '—'}`);
    lines.push(`message    ${message.trim() === '' ? '—' : `"${message.trim()}"`}`);
    lines.push(`age        ${selectedOrder === null ? '—' : `${daysSince(selectedOrder.orderDate)} days`}`);
    lines.push(`amount     ${formatCurrency(selectedTotalCents)}`);
    devSession.setContext(lines.join('\n'));
  }, [devSession, customerId, orderId, itemIds, message, selectedOrder, selectedTotalCents]);

  const handleReset = useCallback(() => {
    setMessage('');
    setEntries([]);
    setItemIds([]);
    setValidationMessage(null);
    reset();
  }, [reset]);

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (customerId === null || orderId === null) {
      setValidationMessage('Choose a customer and an order first.');
      return;
    }
    if (itemIds.length === 0) {
      setValidationMessage('Select at least one item.');
      return;
    }
    if (trimmed.length < MESSAGE_MIN_LENGTH) {
      setValidationMessage('Tell us what is wrong so the request can be classified.');
      return;
    }
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      setValidationMessage(`Keep the message under ${MESSAGE_MAX_LENGTH} characters.`);
      return;
    }
    setValidationMessage(null);

    setEntries((current) => [
      ...current,
      { id: nextEntryId(), role: 'customer', text: trimmed, createdAt: new Date().toISOString() },
    ]);

    const response = await submit({ customerId, orderId, itemIds, message: trimmed });

    if (response === null) return;

    setEntries((current) => [
      ...current,
      { id: nextEntryId(), role: 'system', text: response.customerMessage, createdAt: new Date().toISOString() },
    ]);
    pushToast({
      tone: response.decision === 'APPROVED' ? 'success' : 'error',
      title: `Refund request ${response.decision.toLowerCase()}`,
      message: `${formatCurrency(response.refundAmountCents)} · reference ${response.id}`,
    });
  }, [customerId, orderId, itemIds, message, submit, pushToast]);

  return (
    <PageContainer>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Request a refund</h1>
          <p className="page-header__subtitle">
            Describe the problem and the system decides against a fixed refund policy. The assistant reads your message and
            explains the outcome — it can never authorise a refund on its own.
          </p>
        </div>
        <p className="page-header__meta">Demo data · no real payments</p>
      </div>

      <div className="refund-layout">
        <div className="refund-layout__aside">
          <Card title="Quick start" hint="Prefill a seeded scenario">
            <ScenarioChips onApply={handleApplyScenario} disabled={isBusy} />
          </Card>

          <CustomerSwitcher
            customers={customers}
            selectedCustomerId={customerId}
            onSelect={handleCustomerChange}
            isLoading={isLoading}
            error={customersError}
            onRetry={refetch}
            disabled={isBusy}
          />

          <OrderPicker
            orders={orders}
            selectedOrderId={orderId}
            onSelect={handleOrderChange}
            isLoading={isLoadingOrders}
            error={ordersError}
            onRetry={() => handleCustomerChange(customerId ?? '')}
            disabled={isBusy}
          />

          <ItemSelector
            items={items}
            selectedItemIds={itemIds}
            onToggle={handleToggleItem}
            onSelectAll={handleSelectAll}
            selectedTotalCents={selectedTotalCents}
            disabled={isBusy}
          />
        </div>

        <div className="refund-layout__main">
          <RefundChat
            entries={entries}
            message={message}
            onMessageChange={setMessage}
            onSubmit={() => void handleSubmit()}
            onReset={handleReset}
            isSubmitting={isBusy}
            canSubmit={customerId !== null && orderId !== null && itemIds.length > 0 && message.trim().length > 0}
            validationMessage={validationMessage}
          />

          {error !== null ? (
            <div className="refund-result" role="alert">
              <p className="refund-result__label">Request not sent</p>
              <p className="decision-banner__text">{error.message}</p>
              {error.fieldErrors.length > 0 ? (
                <ul className="refund-result__reasons">
                  {error.fieldErrors.map((field) => (
                    <li key={`${field.path}-${field.message}`} className="refund-result__reason">
                      {field.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {error.requestId !== null ? <p className="inline-note">Request id: {error.requestId}</p> : null}
            </div>
          ) : null}

          {result !== null ? <RefundResult result={result} /> : null}

          {selectedOrder !== null ? (
            <Card title="What the policy sees" hint="Trusted database facts, never customer input" headingLevel={3}>
              <div className="detail-grid">
                <div className="detail-grid__item">
                  <span className="detail-grid__label">Order</span>
                  <span className="detail-grid__value">{selectedOrder.id}</span>
                </div>
                <div className="detail-grid__item">
                  <span className="detail-grid__label">Order age</span>
                  <span className="detail-grid__value">{daysSince(selectedOrder.orderDate)} days</span>
                </div>
                <div className="detail-grid__item">
                  <span className="detail-grid__label">Refund window</span>
                  <span className="detail-grid__value">30 days, inclusive</span>
                </div>
                <div className="detail-grid__item">
                  <span className="detail-grid__label">Manual review above</span>
                  <span className="detail-grid__value">$500.00</span>
                </div>
                <div className="detail-grid__item">
                  <span className="detail-grid__label">Selected amount</span>
                  <span className="detail-grid__value">{formatCurrency(selectedTotalCents)}</span>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
