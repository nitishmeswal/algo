import { useEffect } from 'react'
import { Form, InputNumber, Modal } from 'antd'
import type { Order } from './types'

export type AmendOrderModalProps = {
  open: boolean
  order: Order | null
  onClose: () => void
  onSubmit: (values: { quantity: number; limitPrice?: number }) => Promise<void>
}

type FormValues = {
  quantity: number
  limitPrice?: number
}

export default function AmendOrderModal({ open, order, onClose, onSubmit }: AmendOrderModalProps) {
  const [form] = Form.useForm<FormValues>()

  useEffect(() => {
    if (!open || !order) return
    form.setFieldsValue({
      quantity: order.quantity,
      limitPrice: order.limitPrice,
    })
  }, [open, order, form])

  const handleOk = async () => {
    const values = await form.validateFields()
    await onSubmit(values)
    onClose()
  }

  return (
    <Modal
      title="Amend order"
      open={open}
      onOk={() => void handleOk()}
      onCancel={onClose}
      destroyOnHidden
      okText="Apply amend"
    >
      {order ? (
        <p className="amend-order-modal__meta">
          {order.id} · {order.symbol} {order.side.toUpperCase()}
        </p>
      ) : null}
      <Form form={form} layout="vertical" size="middle">
        <Form.Item
          label="Quantity"
          name="quantity"
          rules={[{ required: true, message: 'Quantity is required' }]}
        >
          <InputNumber min={order ? Math.max(1, order.filledQuantity) : 1} step={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Limit price" name="limitPrice">
          <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
