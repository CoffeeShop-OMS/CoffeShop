import { Package, AlertTriangle, TrendingDown, RefreshCcw } from 'lucide-react';

export default function StatCards({ stats, cards: overrideCards, onCardClick }) {
  const defaultCards = [
    { icon: Package, label: 'Total Items', value: stats?.total?.toString() ?? '0', sub: 'Across all categories', accent: '#3D261D', iconBg: 'bg-[#EDE4DC]', iconColor: '#3D261D', action: 'all' },
    { icon: AlertTriangle, label: 'Low Stock', value: stats?.lowCount?.toString() ?? '0', sub: 'Need attention', accent: '#B45309', iconBg: 'bg-amber-100', iconColor: '#B45309', action: 'low-stock' },
    { icon: TrendingDown, label: 'Out of Stock', value: stats?.outCount?.toString() ?? '0', sub: 'Need replenishment', accent: '#DC2626', iconBg: 'bg-red-100', iconColor: '#DC2626', action: 'out-of-stock' },
    { icon: RefreshCcw, label: 'Inventory Value', value: stats ? `₱${Number(stats.value || 0).toFixed(2)}` : '₱0.00', sub: 'Current valuation', accent: '#059669', iconBg: 'bg-emerald-100', iconColor: '#059669', action: 'value' },
  ];

  const cards = overrideCards && overrideCards.length ? overrideCards : defaultCards;
  const gridCols = cards.length === 6
    ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
    : cards.length >= 5
    ? 'grid-cols-2 lg:grid-cols-5'
    : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${gridCols} gap-3 sm:gap-4 mb-5 sm:mb-6`}>
      {cards.map(({ icon: Icon, label, value, sub, accent, iconBg, iconColor, action }) => (
        <div
          key={label}
          className={`relative bg-white rounded-2xl border border-[#EAE5E0] p-4 sm:p-5 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${onCardClick ? 'cursor-pointer hover:border-[#6B3E26]' : 'cursor-default'}`}
          onClick={() => onCardClick && action && onCardClick(action)}
        >
          <div className={`inline-flex rounded-xl p-2 sm:p-2.5 mb-2 sm:mb-3 ${iconBg}`}>
            {Icon ? <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: iconColor }} /> : null}
          </div>
          <p className="text-[9px] sm:text-[10px] font-bold text-[#A89080] uppercase tracking-widest mb-1">{label}</p>
          <p
            className="text-xl sm:text-[26px] font-bold text-[#1C100A] leading-none mb-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >{value}</p>
          <p className="text-[10px] sm:text-[11px] text-[#C4B8B0] hidden sm:block">{sub}</p>
          <div className="absolute bottom-0 right-0 w-12 h-12 sm:w-16 sm:h-16 rounded-tl-full opacity-[0.07]" style={{ background: accent }} />
        </div>
      ))}
    </div>
  );
}
