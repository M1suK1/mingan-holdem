import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';

export interface CyberToast {
  id: string;
  tone: 'info' | 'success' | 'warn' | 'error';
  title: string;
  detail?: string;
}

interface CyberToastHubProps {
  toasts: CyberToast[];
  onDismiss: (id: string) => void;
}

export function CyberToastHub({ toasts, onDismiss }: CyberToastHubProps) {
  if (toasts.length === 0) return null;

  return (
    <aside className="cyber-toast-stack" aria-live="polite" aria-label="系统内部通知中心">
      {toasts.map((t) => {
        const Icon =
          t.tone === 'success'
            ? CheckCircle2
            : t.tone === 'warn'
              ? AlertTriangle
              : t.tone === 'error'
                ? ShieldAlert
                : Info;
        const iconColor =
          t.tone === 'success'
            ? 'var(--accent-success)'
            : t.tone === 'warn'
              ? 'var(--accent-warning)'
              : t.tone === 'error'
                ? 'var(--accent-danger)'
                : 'var(--accent-telemetry)';

        return (
          <div key={t.id} className={`cyber-toast-item ${t.tone}`} role="status">
            <Icon size={18} color={iconColor} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t.title}</div>
              {t.detail && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {t.detail}
                </div>
              )}
            </div>
            <button
              id={`toast-dismiss-btn-${t.id}`}
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="关闭此通知"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                padding: 4,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </aside>
  );
}

interface ConfirmCyberModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmCyberModal({
  title,
  description,
  confirmLabel = '确认执行',
  onConfirm,
  onCancel,
}: ConfirmCyberModalProps) {
  return (
    <div
      className="cyber-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="cyber-modal-window narrow">
        <div className="window-titlebar">
          <div className="window-title-left">
            <AlertTriangle size={15} color="var(--accent-warning)" aria-hidden="true" />
            <span id="confirm-modal-title">{title}</span>
          </div>
          <span className="win-pid">SYS::CONFIRM</span>
        </div>
        <div className="modal-content-scroll">
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {description}
          </p>
          <div className="cmd-grid cols-2">
            <button
              id="confirm-modal-btn-cancel"
              type="button"
              className="cyber-cmd-btn"
              onClick={onCancel}
            >
              取消操作
            </button>
            <button
              id="confirm-modal-btn-accept"
              type="button"
              className="cyber-cmd-btn primary-pink"
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
