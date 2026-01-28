export default function StatsCards({ stats }) {
  const cards = [
    {
      label: 'Týždenná spotreba',
      value: stats.week_consumption,
      unit: 'm³',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      gradient: 'from-cyan-500 to-blue-500',
      bgLight: 'bg-cyan-50',
    },
    {
      label: 'Mesačná spotreba',
      value: stats.month_consumption,
      unit: 'm³',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20V10"/>
          <path d="M18 20V4"/>
          <path d="M6 20v-4"/>
        </svg>
      ),
      gradient: 'from-violet-500 to-purple-500',
      bgLight: 'bg-violet-50',
    },
    {
      label: 'Priemerná denná',
      value: stats.avg_daily,
      unit: 'm³/deň',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="20" x2="12" y2="10"/>
          <line x1="12" y1="10" x2="16" y2="14"/>
          <line x1="12" y1="10" x2="8" y2="14"/>
          <circle cx="12" cy="5" r="2"/>
        </svg>
      ),
      gradient: 'from-emerald-500 to-teal-500',
      bgLight: 'bg-emerald-50',
    },
    {
      label: 'Max hodinová (dnes)',
      value: stats.max_hourly_today,
      unit: 'm³/hod',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      gradient: 'from-amber-500 to-orange-500',
      bgLight: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-200">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <div className="text-white">
                {card.icon}
              </div>
            </div>
            <span className="text-sm font-medium text-slate-500">{card.label}</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight">
            {card.value != null ? parseFloat(card.value).toFixed(3) : '—'}
            <span className="text-sm font-medium text-slate-400 ml-1.5">{card.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
