import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatQuantity = (value, unit = '') => {
  const amount = Number(value || 0);
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${formatted}${unit ? ` ${unit}` : ''}`.trim();
};

const truncateLabel = (value = '') => {
  const label = String(value || 'Unnamed item');
  return label.length > 14 ? `${label.slice(0, 13)}...` : label;
};

const buildCriticalStockData = (items = []) =>
  items
    .map((item) => {
      const quantity = Math.max(Number(item.quantity || 0), 0);
      const threshold = Math.max(Number(item.lowStockThreshold || 0), 0);
      const visualTarget = Math.max(threshold, quantity, 1);
      const shortage = Math.max(visualTarget - quantity, 0);
      const severity = item.severity || (quantity <= 0 ? 'critical' : 'warning');
      const ratio = threshold > 0 ? quantity / threshold : quantity <= 0 ? 0 : 1;

      return {
        id: item.id,
        name: item.name || 'Unnamed item',
        label: truncateLabel(item.name),
        quantity,
        threshold,
        shortage,
        unit: item.unit || '',
        severity,
        ratio,
      };
    })
    .sort((first, second) => {
      if (first.severity !== second.severity) {
        return first.severity === 'critical' ? -1 : 1;
      }
      return first.ratio - second.ratio;
    })
    .slice(0, 5);

const CriticalStockTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const shortage = Math.max(Number(data.threshold || 0) - Number(data.quantity || 0), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-gray-900">{data.name}</p>
      <p className="mt-1 text-gray-500">Current: {formatQuantity(data.quantity, data.unit)}</p>
      <p className="text-gray-500">Reorder: {formatQuantity(data.threshold, data.unit)}</p>
      <p className={data.severity === 'critical' ? 'text-red-600 font-semibold' : 'text-amber-700 font-semibold'}>
        {data.severity === 'critical'
          ? 'Critical'
          : `Short by ${formatQuantity(shortage, data.unit)}`}
      </p>
    </div>
  );
};

export default function CriticalStockGraph({ items = [], onViewAll }) {
  const chartData = buildCriticalStockData(items);
  const criticalCount = items.filter((item) => item.severity === 'critical' || Number(item.quantity || 0) <= 0).length;
  const warningCount = Math.max(items.length - criticalCount, 0);
  const chartHeight = Math.max(150, chartData.length * 30);
  const hiddenCount = Math.max(items.length - chartData.length, 0);

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Critical Stock Levels
          </h3>
          <p className="text-[11px] text-gray-500">
            Top urgent items vs reorder level{hiddenCount > 0 ? ` +${hiddenCount} more` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
            {criticalCount} critical
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            {warningCount} low
          </span>
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              View alerts <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl bg-[#FAF8F5] text-sm text-gray-500">
          All active stock levels are above their reorder thresholds.
        </div>
      ) : (
        <>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={102}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip content={<CriticalStockTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="quantity" stackId="stock" radius={[6, 0, 0, 6]} minPointSize={3} barSize={12}>
                  {chartData.map((entry) => (
                    <Cell
                      key={`quantity-${entry.id}`}
                      fill={entry.severity === 'critical' ? '#DC2626' : '#D97706'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="shortage" stackId="stock" fill="#F3F4F6" radius={[0, 6, 6, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-600" /> Critical
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-600" /> Low
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-200" /> Reorder gap
            </span>
          </div>
        </>
      )}
    </div>
  );
}
