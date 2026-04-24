import { Modal, Typography } from 'antd'
import type { EodSectionModel, SelectionSummaryModel } from './deterministicInsights'

type SelectionModalProps = {
  open: boolean
  onClose: () => void
  model: SelectionSummaryModel
}

export function SelectionSummaryModal({ open, onClose, model }: SelectionModalProps) {
  return (
    <Modal
      title={`Summarize ${model.count} row${model.count === 1 ? '' : 's'}`}
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText="Close"
      cancelButtonProps={{ style: { display: 'none' } }}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Deterministic facts from the blotter. Later: optional NLP / LLM narrative grounded on this same payload.
      </Typography.Paragraph>
      <ul className="insight-modal-list">
        {model.bullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Modal>
  )
}

type EodModalProps = {
  open: boolean
  onClose: () => void
  sections: EodSectionModel[]
}

export function EodReportModal({ open, onClose, sections }: EodModalProps) {
  return (
    <Modal
      title="End-of-day report (schema)"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText="Close"
      cancelButtonProps={{ style: { display: 'none' } }}
      width={560}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Sections are deterministic today. Later: schedule + export; add an AI executive summary fed by this JSON-shaped
        content.
      </Typography.Paragraph>
      {sections.map((sec) => (
        <section key={sec.heading} className="eod-section">
          <Typography.Title level={5} className="eod-section__title">
            {sec.heading}
          </Typography.Title>
          <ul className="insight-modal-list">
            {sec.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  )
}
