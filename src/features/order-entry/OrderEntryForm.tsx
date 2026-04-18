import { useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Select, Space, message } from 'antd'
import type { OrderEntryPayload } from '../blotter/api/submitOrder'
import { submitOrder } from '../blotter/api/submitOrder'

export default function OrderEntryForm() {
  const [form] = Form.useForm<OrderEntryPayload>()
  const [submitting, setSubmitting] = useState(false)

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
      <Card className="app-card app-card--form">
        <Form
          className="order-entry-form"
          form={form}
          layout="vertical"
          size="middle"
          onFinish={onFinish}
        >
          <div className="order-entry-row-inline">
            <Form.Item label="Account" name="account">
              <Input placeholder="PB-ALPHA" />
            </Form.Item>
            <Form.Item label="Counterparty" name="counterparty">
              <Input placeholder="NMR-US" />
            </Form.Item>
          </div>
          <div className="order-entry-grid">
            <Form.Item label="Symbol" name="symbol" rules={[{ required: true, message: 'Symbol is required' }]}>
              <Input placeholder="AAPL" />
            </Form.Item>

            <Form.Item label="Side" name="side" rules={[{ required: true, message: 'Side is required' }]}>
              <Select
                placeholder="Select side"
                options={[
                  { value: 'buy', label: 'Buy' },
                  { value: 'sell', label: 'Sell' },
                ]}
              />
            </Form.Item>

            <Form.Item label="Quantity" name="quantity" rules={[{ required: true, message: 'Quantity is required' }]}>
              <InputNumber min={1} step={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Limit Price" name="limitPrice">
              <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Time In Force" name="timeInForce" rules={[{ required: true, message: 'TIF is required' }]}>
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

          <div className="order-entry-actions">
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Button htmlType="reset" block>
                Reset
              </Button>
              <Button
                type="primary"
                block
                size="large"
                className="order-submit-btn"
                htmlType="submit"
                loading={submitting}
              >
                Submit Order
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </section>
  )
}
