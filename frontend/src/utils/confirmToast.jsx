import toast from 'react-hot-toast';

export function confirmToast(message, { confirmText = 'Confirm', cancelText = 'Cancel', danger = true } = {}) {
  return new Promise((resolve) => {
    toast(
      (t) => (
        <div>
          <div style={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#1f2937',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.45'
          }}>
            {message}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
            <button
              onClick={() => { toast.dismiss(t.id); resolve(true); }}
              style={{
                padding: '7px 16px',
                background: danger ? '#dc2626' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              {confirmText}
            </button>
            <button
              onClick={() => { toast.dismiss(t.id); resolve(false); }}
              style={{
                padding: '7px 16px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              {cancelText}
            </button>
          </div>
        </div>
      ),
      {
        duration: Infinity,
        style: {
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          border: '1px solid #e5e7eb',
          padding: '16px 18px',
          minWidth: '280px',
          maxWidth: '360px'
        }
      }
    );
  });
}