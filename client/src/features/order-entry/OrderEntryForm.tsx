import { useMemo, useState } from 'react'
import { AutoComplete, Button, Card, Form, Input, InputNumber, Select, message } from 'antd'
import { useBlotterStore } from '../blotter/store/useBlotterStore'
import type { OrderEntryPayload } from '../blotter/api/submitOrder'
import { submitOrder } from '../blotter/api/submitOrder'
import { buildSymbolTypeaheadOptions } from './symbolTypeahead'

export default function OrderEntryForm() {
  const [form] = Form.useForm<OrderEntryPayload>()
  const [submitting, setSubmitting] = useState(false)

  const orderIds = useBlotterStore((s) => s.orderIds)
  const ordersById = useBlotterStore((s) => s.ordersById)
  const bookSymbols = useMemo(
    () => orderIds.map((id) => ordersById[id]?.symbol).filter((x): x is string => Boolean(x)),
    [orderIds, ordersById],
  )

  const symbolInput = Form.useWatch('symbol', form) as string | undefined
  const symbolOptions = useMemo(
    () => buildSymbolTypeaheadOptions(typeof symbolInput === 'string' ? symbolInput : '', bookSymbols),
    [symbolInput, bookSymbols],
  )

  const onFinish = async (values: OrderEntryPayload) => {
    setSubmitting(true)
    try {
      await submitOrder(values)
      void message.success('Order accepted')
      form.resetFields()
    } catch {
      void message.error('Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="order-entry-section" aria-label="New order">
      <Card className="app-card app-card--form" bordered={false}>
        <div className="order-entry-form__band" aria-hidden>
          <span className="order-entry-form__band-label">New order ticket</span>
        </div>
        <Form
          className="order-entry-form"
          form={form}
          layout="vertical"
          size="small"
          requiredMark={false}
          onFinish={onFinish}
        >
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

                <Form.Item label="Limit price" name="limitPrice">
                  <InputNumber min={0.01} step={0.01} controls className="order-entry-control--numeric" style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item label="Time in force" name="timeInForce" rules={[{ required: true, message: 'TIF is required' }]}>
                  <Select
                    placeholder="TIF"
                    options={[
                      { value: 'day', label: 'DAY' },
                      { value: 'gtc', label: 'GTC' },
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
