import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Button, Drawer, Typography } from 'antd'
import { AiTradeBookingAgentContent, AiTradeBookingAgentTitle } from './AiTradeBookingAgentContent'
import { isTradeDescriptionPreviewComplete } from './inferTradeFieldsPreview'
import { useTradeBookingAgentRun } from './useTradeBookingAgentRun'

const DRAWER_WIDTH_LS = 'flowdesk_ai_trade_drawer_width'

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(DRAWER_WIDTH_LS)
    const n = raw == null ? NaN : Number(raw)
    if (Number.isFinite(n) && n >= 360 && n <= 960) return Math.round(n)
  } catch {
    /* ignore */
  }
  return 440
}

function maxDrawerWidth(): number {
  if (typeof window === 'undefined') return 960
  return Math.min(960, Math.max(480, window.innerWidth - 72))
}

export type AiTradeBookingDrawerProps = {
  open: boolean
  onClose: () => void
}

/**
 * Resizable side drawer — same agent UI as {@link AiTradeBookingModal}.
 * Kept for future use; the blotter currently opens the modal instead.
 */
export function AiTradeBookingDrawer({ open, onClose }: AiTradeBookingDrawerProps) {
  const {
    tradeDescription,
    setTradeDescription,
    agentLoading,
    agentError,
    agentResult,
    agentStepSnapshot,
    runAgent,
    clearAgentResult,
    resetAll,
  } = useTradeBookingAgentRun()

  const defaultSize = useMemo(() => readStoredWidth(), [])
  const lastResizeWidthRef = useRef(defaultSize)

  useEffect(() => {
    if (!open) {
      resetAll()
    }
  }, [open, resetAll])

  const handleResize = useCallback((w: number) => {
    lastResizeWidthRef.current = Math.min(maxDrawerWidth(), Math.max(360, Math.round(w)))
  }, [])

  const handleResizeEnd = useCallback((finalSize?: number) => {
    const next =
      typeof finalSize === 'number' && Number.isFinite(finalSize)
        ? Math.min(maxDrawerWidth(), Math.max(360, Math.round(finalSize)))
        : lastResizeWidthRef.current
    lastResizeWidthRef.current = next
    try {
      localStorage.setItem(DRAWER_WIDTH_LS, String(next))
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <Drawer
      title={<AiTradeBookingAgentTitle />}
      placement="right"
      open={open}
      onClose={onClose}
      rootClassName="ai-trade-booking-drawer"
      maxSize={maxDrawerWidth()}
      defaultSize={defaultSize}
      resizable={{
        onResize: handleResize,
        onResizeEnd: handleResizeEnd,
      }}
      destroyOnHidden={false}
      mask={{ blur: true }}
      classNames={{ wrapper: 'ai-trade-booking-drawer__wrapper' }}
      styles={{
        wrapper: {
          pointerEvents: 'auto',
        },
        section: {
          position: 'relative',
          zIndex: 0,
          background: 'linear-gradient(165deg, rgba(22, 27, 34, 0.98) 0%, rgba(18, 21, 28, 0.99) 45%, #12151c 100%)',
        },
        body: { paddingTop: 12 },
        dragger: {
          zIndex: 30,
          width: 14,
          cursor: 'col-resize',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(99,102,241,0.12), rgba(255,255,255,0.06))',
        },
      }}
      footer={
        <div className="ai-trade-drawer__footer">
          <Typography.Text type="secondary" className="ai-trade-drawer__footer-hint">
            Runs server-side tool loop (parse → validate → book)
          </Typography.Text>
          <Button
            type="primary"
            loading={agentLoading}
            disabled={!tradeDescription.trim() || !isTradeDescriptionPreviewComplete(tradeDescription)}
            onClick={() => void runAgent()}
          >
            Run agent
          </Button>
        </div>
      }
    >
      <AiTradeBookingAgentContent
        tradeDescription={tradeDescription}
        onTradeDescriptionChange={setTradeDescription}
        agentLoading={agentLoading}
        agentError={agentError}
        agentResult={agentResult}
        agentStepSnapshot={agentStepSnapshot}
        onClearAgentResult={clearAgentResult}
        footerExtra={
          <Typography.Text type="secondary" className="ai-trade-drawer__resize-hint">
            Drag the left edge to resize this drawer.
          </Typography.Text>
        }
      />
    </Drawer>
  )
}
