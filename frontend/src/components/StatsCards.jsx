export default function StatsCards({ stats }) {
  const cards = [
    {
      label: 'Týždenná spotreba',
      value: stats.week_consumption,
      unit: 'm³',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      color: 'blue',
    },
    {
      label: 'Mesačná spotreba',
      value: stats.month_consumption,
      unit: 'm³',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20V10"/>
          <path d="M18 20V4"/>
          <path d="M6 20v-4"/>
        </svg>
      ),
      color: 'cyan',
    },
    {
      label: 'Priemerná denná',
      value: stats.avg_daily,
      unit: 'm³/deň',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
      color: 'indigo',
    },
    {
      label: 'Max hodinová (dnes)',
      value: stats.max_hourly_today,
      unit: 'm³/hod',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      color: 'amber',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[card.color]}`}>
              {card.icon}
            </div>
            <span className="text-sm text-slate-500">{card.label}</span>
          </div>
          <div className="text-2xl font-semibold text-slate-800">
            {card.value != null ? parseFloat(card.value).toFixed(3) : '—'}
            <span className="text-sm font-normal text-slate-400 ml-1">{card.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
