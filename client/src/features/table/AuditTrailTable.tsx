import { Empty, Tag, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useMemo } from 'react'
import type { AuditTrailKind } from '../blotter/audit/types'
import { useBlotterStore } from '../blotter/store/useBlotterStore'
import type { Order, OrderStatus } from '../blotter/types'

const kindTagColor: Record<AuditTrailKind, string> = {
  created: 'success',
  updated: 'processing',
  cancelled: 'default',
  rejected: 'error',
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatStatusLabel(status: OrderStatus): string {
  return status.replace(/_/g, ' ')
}

function orderTitle(order: Order | undefined, id: string) {
  return (
    <span className="audit-trail-tree__order-title">
      <span className="audit-trail-tree__order-id">{id}</span>
      {order ? (
        <>
          <span className="audit-trail-tree__order-meta">
            {order.symbol} · {order.side.toUpperCase()}
          </span>
          <Tag className="audit-trail-tree__order-status" color="blue">
            {formatStatusLabel(order.status)}
          </Tag>
        </>
      ) : (
        <span className="audit-trail-tree__order-meta">Unknown order</span>
      )}
    </span>
  )
}

export default function AuditTrailTable() {
  const orderIds = useBlotterStore((s) => s.orderIds)
  const ordersById = useBlotterStore((s) => s.ordersById)
  const auditByOrderId = useBlotterStore((s) => s.auditByOrderId)

  const treeData = useMemo<DataNode[]>(() => {
    return orderIds.map((id) => {
      const order = ordersById[id]
      const entries = auditByOrderId[id] ?? []
      return {
        key: `order:${id}`,
        title: orderTitle(order, id),
        children:
          entries.length === 0
            ? [
                {
                  key: `order:${id}:empty`,
                  title: <span className="audit-trail-tree__empty-leaf">No audit entries</span>,
                  isLeaf: true,
                },
              ]
            : entries.map((e) => ({
                key: e.id,
                isLeaf: true,
                title: (
                  <div className="audit-trail-tree__entry">
                    <span className="audit-trail-tree__time">{formatAuditTime(e.emittedAt)}</span>
                    <Tag className="audit-trail-tree__kind" color={kindTagColor[e.kind]}>
                      {e.kind}
                    </Tag>
                    <span className="audit-trail-tree__summary">{e.summary}</span>
                    <span className="audit-trail-tree__source">{e.source}</span>
                  </div>
                ),
              })),
      }
    })
  }, [orderIds, ordersById, auditByOrderId])

  if (treeData.length === 0) {
    return (
      <Empty
        className="audit-trail-empty"
        description="No orders yet — audit lines appear as stream events arrive."
      />
    )
  }

  return (
    <div className="audit-trail-tree-wrap">
      <Tree
        className="audit-trail-tree"
        blockNode
        showLine
        defaultExpandAll
        treeData={treeData}
        aria-label="Order audit trail"
      />
    </div>
  )
}
