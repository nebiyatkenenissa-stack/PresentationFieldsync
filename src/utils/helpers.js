export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const getToday = () => new Date().toISOString().slice(0, 10);

export const getCurrentTime = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

export const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const fakeSyncApi = (report) => {
  return new Promise((resolve, reject) => {
    if (!navigator.onLine) {
      reject(new Error('You are offline. Please connect to the internet.'));
      return;
    }
    
    const delay = 500 + Math.random() * 1000;
    setTimeout(() => {
      if (Math.random() < 0.1) {
        reject(new Error('Network error - sync failed'));
      } else {
        resolve({ ...report, synced: true, syncDate: new Date().toISOString() });
      }
    }, delay);
  });
};

export const exportCSV = (data, filename) => {
  if (!data || data.length === 0) { alert('No data to export'); return; }
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
};