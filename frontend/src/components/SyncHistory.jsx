export default function SyncHistory({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Žiadna história</h3>
        <p className="text-slate-500">Zatiaľ nebola vykonaná žiadna synchronizácia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">História synchronizácií</h2>
        <span className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{logs.length} záznamov</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {logs.map((log, idx) => (
            <div key={log.id || idx} className="p-4 hover:bg-slate-50/50 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    log.status === 'success' 
                      ? 'bg-emerald-100' 
                      : log.status === 'error' 
                        ? 'bg-red-100' 
                        : 'bg-slate-100'
                  }`}>
                    {log.status === 'success' ? (
                      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : log.status === 'error' ? (
                      <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-slate-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">
                      {log.status === 'success' 
                        ? `Synchronizované ${log.records_synced || 0} záznamov`
                        : log.status === 'error'
                          ? 'Synchronizácia zlyhala'
                          : 'Prebieha synchronizácia...'
                      }
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {new Date(log.started_at).toLocaleString('sk-SK')}
                      {log.completed_at && (
                        <span className="text-slate-400"> • Trvanie: {Math.round((new Date(log.completed_at) - new Date(log.started_at)) / 1000)}s</span>
                      )}
                    </div>
                    {log.error_message && (
                      <div className="text-sm text-red-600 mt-2 bg-red-50 px-3 py-1.5 rounded-lg">{log.error_message}</div>
                    )}
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
                  log.status === 'success'
                    ? 'bg-emerald-100 text-emerald-700'
                    : log.status === 'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-700'
                }`}>
                  {log.status === 'success' ? 'Úspešne' : log.status === 'error' ? 'Chyba' : 'Prebieha'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
