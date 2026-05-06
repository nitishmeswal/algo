import { useMemo, useState } from 'react'
import { AutoComplete, Button, Card, Form, Input, InputNumber, Select, message } from 'antd'
import { useBlotterStore } from '../blotter/store/useBlotterStore'
import type { OrderEntryPayload } from '../blotter/api/submitOrder'
import { submitOrder } from '../blotter/api/submitOrder'
import { buildSymbolTypeaheadOptions } from './symbolTypeahead'

export default function OrderEntryForm() {
  const [form] = Form.useForm<OrderEntryPayload>()
  const [submitting, setSubmitting] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const orderIds = useBlotterStore((s) => s.orderIds)
  const ordersById = useBlotterStore((s) => s.ordersById)
  const bookSymbols = useMemo(
    () => orderIds.map((id) => ordersById[id]?.symbol).filter((x): x is string => Boolean(x)),
    [orderIds, ordersById],
  )

  const symbolInput = Form.useWatch('symbol', form) as string | undefined
  const orderType = Form.useWatch('orderType', form) as OrderEntryPayload['orderType'] | undefined
  const timeInForce = Form.useWatch('timeInForce', form) as OrderEntryPayload['timeInForce'] | undefined
  const symbolOptions = useMemo(
    () => buildSymbolTypeaheadOptions(typeof symbolInput === 'string' ? symbolInput : '', bookSymbols),
    [symbolInput, bookSymbols],
  )

  const onFinish = async (values: OrderEntryPayload) => {
    const normalizedOrderType = values.orderType ?? 'limit'
    const normalized: OrderEntryPayload = {
      ...values,
      orderType: normalizedOrderType,
      limitPrice: normalizedOrderType === 'market' || normalizedOrderType === 'stop' ? undefined : values.limitPrice,
      stopPrice: normalizedOrderType === 'stop' || normalizedOrderType === 'stop_limit' ? values.stopPrice : undefined,
      expireAt: values.timeInForce === 'gtd' ? values.expireAt : undefined,
    }
    setSubmitting(true)
    try {
      await submitOrder(normalized)
      void message.success('Order accepted')
      form.resetFields()
    } catch {
      void message.error('Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className={`order-entry-section${advancedOpen ? ' order-entry-section--advanced' : ''}`}
      aria-label="New order"
    >
      <Card className="app-card app-card--form" bordered={false}>
        <div className="order-entry-form__band">
          <div className="order-entry-form__band-inner">
            <span className="order-entry-form__band-label">New order ticket</span>
            <Button
              type="link"
              size="small"
              className="order-entry-form__advanced-toggle"
              aria-expanded={advancedOpen}
              aria-controls="order-entry-advanced-panel"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              {advancedOpen ? 'Hide advanced' : 'Advanced'}
            </Button>
          </div>
        </div>
        <Form
          className="order-entry-form"
          form={form}
          layout="vertical"
          size="small"
          requiredMark={false}
          initialValues={{ orderType: 'limit' }}
          onFinish={onFinish}
        >
          <div className="order-entry-form__panels">
            <div className="order-entry-form__panel order-entry-form__panel--core">
              <div className="order-entry-form__fields">
                <div className="order-entry-form__section">
                  <div className="order-entry-form__section-title">Route</div>
                  <div className="order-entry-row-inline">
                    <Form.Item label="Account" name="account">
                      <Input placeholder="PB-ALPHA" autoFocus className="order-entry-input--mono" />
                    </Form.Item>
                    <Form.Item label="Counterparty" name="counterparty">
                      <Input placeholder="NMR-US" className="order-entry-input--mono" />
                    </Form.Item>
                  </div>
                </div>
                <div className="order-entry-form__section order-entry-form__section--order">
                  <div className="order-entry-form__section-title">Order</div>
                  <div className="order-entry-grid">
                    <Form.Item label="Symbol" name="symbol" rules={[{ required: true, message: 'Symbol is required' }]}>
                      <AutoComplete
                        allowClear
                        options={symbolOptions}
                        filterOption={false}
                        placeholder="Search or type symbol"
                        className="order-entry-symbol-autocomplete"
                        popupClassName="order-entry-symbol-typeahead-dropdown"
                        notFoundContent={
                          symbolOptions.length === 0 && symbolInput?.trim() ? 'No matches' : undefined
                        }
                        maxLength={16}
                      />
                    </Form.Item>

                    <Form.Item label="Side" name="side" rules={[{ required: true, message: 'Side is required' }]}>
                      <Select
                        placeholder="Side"
                        options={[
                          { value: 'buy', label: 'Buy' },
                          { value: 'sell', label: 'Sell' },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item label="Quantity" name="quantity" rules={[{ required: true, message: 'Quantity is required' }]}>
                      <InputNumber min={1} step={100} controls className="order-entry-control--numeric" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item label="Order type" name="orderType" rules={[{ required: true, message: 'Order type is required' }]}>
                      <Select
                        options={[
                          { value: 'limit', label: 'Limit' },
                          { value: 'market', label: 'Market' },
                          { value: 'stop', label: 'Stop' },
                          { value: 'stop_limit', label: 'Stop limit' },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item
                      label="Limit price"
                      name="limitPrice"
                      dependencies={['orderType']}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            const ot = getFieldValue('orderType')
                            const requiresLimit = ot === 'limit' || ot === 'stop_limit'
                            if (requiresLimit && (value == null || value === '')) {
                              return Promise.reject(new Error('Limit price is required for limit/stop-limit'))
                            }
                            return Promise.resolve()
                          },
                        }),
                      ]}
                    >
                      <InputNumber min={0.01} step={0.01} controls className="order-entry-control--numeric" style={{ width: '100%' }} />
                    </Form.Item>

                    {(orderType === 'stop' || orderType === 'stop_limit') ? (
                      <Form.Item
                        label="Stop price"
                        name="stopPrice"
                        rules={[{ required: true, message: 'Stop price is required for stop orders' }]}
                      >
                        <InputNumber min={0.01} step={0.01} controls className="order-entry-control--numeric" style={{ width: '100%' }} />
                      </Form.Item>
                    ) : null}

                    <Form.Item label="Time in force" name="timeInForce" rules={[{ required: true, message: 'TIF is required' }]}>
                      <Select
                        placeholder="TIF"
                        options={[
                          { value: 'day', label: 'DAY' },
                          { value: 'gtc', label: 'GTC' },
                          { value: 'gtd', label: 'GTD' },
                          { value: 'ioc', label: 'IOC' },
                          { value: 'fok', label: 'FOK' },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item label="Venue" name="venue" rules={[{ required: true, message: 'Venue is required' }]}>
                      <Select
                        placeholder="Venue"
                        options={[
                          { value: 'MOCK', label: 'MOCK' },
                          { value: 'MOCK_ALT', label: 'MOCK_ALT' },
                        ]}
                      />
                    </Form.Item>
                  </div>
                </div>
              </div>
            </div>

            {advancedOpen ? (
              <div
                className="order-entry-form__panel order-entry-form__panel--advanced"
                id="order-entry-advanced-panel"
              >
                <div className="order-entry-form__section order-entry-form__section--advanced-block">
                  <div className="order-entry-form__section-title">Advanced</div>
                  <Form.Item label="Client order ID" name="clientOrderId">
                    <Input placeholder="Optional — leave blank to auto-assign" className="order-entry-input--mono" maxLength={64} />
                  </Form.Item>
                  <Form.Item label="Strategy tag" name="strategyTag">
                    <Input placeholder="e.g. earnings-reversion" className="order-entry-input--mono" maxLength={48} />
                  </Form.Item>
                  <Form.Item
                    label="Display qty"
                    name="displayQuantity"
                    dependencies={['quantity']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (value == null) return Promise.resolve()
                          const q = Number(getFieldValue('quantity'))
                          if (Number.isFinite(q) && value > q) {
                            return Promise.reject(new Error('Display qty cannot exceed total quantity'))
                          }
                          return Promise.resolve()
                        },
                      }),
                    ]}
                  >
                    <InputNumber min={1} step={1} controls className="order-entry-control--numeric" style={{ width: '100%' }} placeholder="Optional iceberg size" />
                  </Form.Item>
                  {timeInForce === 'gtd' ? (
                    <Form.Item
                      label="Expire at"
                      name="expireAt"
                      rules={[
                        { required: true, message: 'Expire timestamp is required when TIF = GTD' },
                        {
                          validator(_, value) {
                            if (typeof value !== 'string' || value.trim() === '') return Promise.resolve()
                            const n = Date.parse(value)
                            return Number.isNaN(n) ? Promise.reject(new Error('Use a valid date/time')) : Promise.resolve()
                          },
                        },
                      ]}
                    >
                      <Input type="datetime-local" />
                    </Form.Item>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="order-entry-actions">
            <div className="order-entry-actions__row">
              <Button htmlType="reset" size="small" className="order-entry-btn-reset">
                Reset
              </Button>
              <Button type="primary" htmlType="submit" size="small" loading={submitting} className="order-entry-btn-submit">
                Submit order
              </Button>
            </div>
          </div>
        </Form>
      </Card>
    </section>
  )
}
