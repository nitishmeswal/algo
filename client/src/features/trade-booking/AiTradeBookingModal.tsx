import { Button, Modal, Typography } from 'antd'
import { useEffect } from 'react'

import { AiTradeBookingAgentContent, AiTradeBookingAgentTitle } from './AiTradeBookingAgentContent'
import { isTradeDescriptionPreviewComplete } from './inferTradeFieldsPreview'
import { useTradeBookingAgentRun } from './useTradeBookingAgentRun'

export type AiTradeBookingModalProps = {
  open: boolean
  onClose: () => void
}

export function AiTradeBookingModal({ open, onClose }: AiTradeBookingModalProps) {
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

  useEffect(() => {
    if (!open) {
      resetAll()
    }
  }, [open, resetAll])

  return (
    <Modal
      title={<AiTradeBookingAgentTitle />}
      open={open}
      onCancel={onClose}
      footer={
        <div className="ai-trade-agent__modal-footer">
          <Typography.Text type="secondary" className="ai-trade-agent__modal-footer-hint">
            Runs server-side tool loop (parse → validate → book)
          </Typography.Text>
          <div className="ai-trade-agent__modal-footer-actions">
            <Button onClick={onClose}>Close</Button>
            <Button
              type="primary"
              loading={agentLoading}
              disabled={!tradeDescription.trim() || !isTradeDescriptionPreviewComplete(tradeDescription)}
              onClick={() => void runAgent()}
            >
              Run agent
            </Button>
          </div>
        </div>
      }
      width="min(880px, calc(100vw - 32px))"
      centered
      destroyOnHidden={false}
      mask={{ blur: true }}
      rootClassName="ai-trade-booking-modal"
      classNames={{ body: 'ai-trade-booking-modal__body' }}
      styles={{
        body: { padding: '16px 20px 8px' },
        mask: {
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
        },
      }}
    >
      <AiTradeBookingAgentContent
        tradeDescription={tradeDescription}
        onTradeDescriptionChange={setTradeDescription}
        agentLoading={agentLoading}
        agentError={agentError}
        agentResult={agentResult}
        agentStepSnapshot={agentStepSnapshot}
        onClearAgentResult={clearAgentResult}
        runHistoryOpen={open}
      />
    </Modal>
  )
}
