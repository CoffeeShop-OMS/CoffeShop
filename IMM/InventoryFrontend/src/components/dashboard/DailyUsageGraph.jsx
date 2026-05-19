import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const toLocalDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const toLocalDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
};

const parseLogDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object') {
    const seconds = value._seconds ?? value.seconds;
    if (seconds !== undefined && seconds !== null) {
      const date = new Date(Number(seconds) * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getAdjustmentValue = (log) => {
  const rawAdjustment = log?.details?.adjustment ?? log?.adjustment ?? 0;
  const adjustment = Number(rawAdjustment);
  return Number.isFinite(adjustment) ? adjustment : 0;
};

const isConsumptionLog = (log) => {
  if (log?.action !== 'STOCK_ADJUST') return false;

  const adjustment = getAdjustmentValue(log);
  const direction = String(log?.details?.direction || log?.direction || '').toUpperCase();
  return adjustment < 0 || direction === 'OUT';
};

const getDayLabel = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[toLocalDate(date).getDay()];
};

const getWeekLabel = (date) => {
  const sourceDate = toLocalDate(date);
  const startOfWeek = new Date(sourceDate);
  startOfWeek.setDate(sourceDate.getDate() - sourceDate.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startOfWeek.getDate();
  const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
  const endDay = endOfWeek.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
};

const getMonthLabel = (date) => {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const getQuarterLabel = (date) => {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
};

const getYearLabel = (date) => {
  return date.getFullYear().toString();
};

const getQuarterStartKey = (date) => {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return `${date.getFullYear()}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`;
};

const getLast5Years = () => {
  const years = [];
  for (let i = 4; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setFullYear(date.getFullYear() - i);
    date.setMonth(0, 1); // Set to January 1st
    const yearKey = `${date.getFullYear()}-01-01`;
    years.push({ date: yearKey, label: getYearLabel(date) });
  }
  return years;
};

const getLast7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const dateStr = toLocalDateKey(date);
    days.push({ date: dateStr, label: getDayLabel(dateStr) });
  }
  return days;
};

const getLast4Weeks = () => {
  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (i * 7));
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = toLocalDateKey(weekStart);
    weeks.push({ date: weekKey, label: getWeekLabel(weekStart) });
  }
  return weeks;
};

const getLast12Months = () => {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - i);
    date.setDate(1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    months.push({ date: monthKey, label: getMonthLabel(date) });
  }
  return months;
};

const getLast4Quarters = () => {
  const quarters = [];
  for (let i = 3; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (i * 3), 1);
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    const quarterStart = new Date(date.getFullYear(), quarterStartMonth, 1);

    quarters.push({
      date: getQuarterStartKey(quarterStart),
      label: getQuarterLabel(quarterStart),
    });
  }
  return quarters;
};

const aggregateUsage = (logs, periods, periodType) => {
  if (!logs || logs.length === 0) {
    return periods.map((p) => ({ ...p, usage: 0 }));
  }

  const aggregated = {};

  // Initialize all periods with 0 usage
  periods.forEach((period) => {
    aggregated[period.date] = 0;
  });

  // Sum stock deductions by period for all ingredients.
  logs.forEach((log) => {
    if (isConsumptionLog(log)) {
      const date = parseLogDate(log.timestamp || log.createdAt);

      if (date) {
        let periodKey = null;

        // Determine period key based on period type
        switch (periodType) {
          case 'daily':
            periodKey = toLocalDateKey(date);
            break;
          case 'weekly': {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            periodKey = toLocalDateKey(weekStart);
            break;
          }
          case 'monthly':
            periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
            break;
          case 'quarterly':
            periodKey = getQuarterStartKey(date);
            break;
          case 'yearly':
            periodKey = `${date.getFullYear()}-01-01`;
            break;
        }

        if (periodKey && Object.prototype.hasOwnProperty.call(aggregated, periodKey)) {
          aggregated[periodKey] += Math.abs(getAdjustmentValue(log));
        }
      }
    }
  });

  // Return data in chronological order with labels
  return periods.map((period) => ({
    date: period.date,
    label: period.label,
    usage: aggregated[period.date],
  }));
};

export default function DailyUsageGraph({ logs = [], isLoading = false }) {
  const [selectedPeriod, setSelectedPeriod] = useState('daily');

  const getYAxisStep = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return 20;
      case 'monthly':
        return 50;
      case 'quarterly':
        return 100;
      case 'yearly':
        return 200;
      default:
        return 5;
    }
  };

  const getPeriods = () => {
    switch (selectedPeriod) {
      case 'daily':
        return getLast7Days();
      case 'weekly':
        return getLast4Weeks();
      case 'monthly':
        return getLast12Months();
      case 'quarterly':
        return getLast4Quarters();
      case 'yearly':
        return getLast5Years();
      default:
        return getLast7Days();
    }
  };

  const getPeriodTitle = () => {
    switch (selectedPeriod) {
      case 'daily':
        return 'Daily Stock Usage';
      case 'weekly':
        return 'Weekly Stock Usage';
      case 'monthly':
        return 'Monthly Stock Usage';
      case 'quarterly':
        return 'Quarterly Stock Usage';
      case 'yearly':
        return 'Yearly Stock Usage';
      default:
        return 'Daily Stock Usage';
    }
  };

  const getPeriodDescription = () => {
    switch (selectedPeriod) {
      case 'daily':
        return 'Volume of all stock consumed past 7 days';
      case 'weekly':
        return 'Volume of all stock consumed past 4 weeks';
      case 'monthly':
        return 'Volume of all stock consumed past 12 months';
      case 'quarterly':
        return 'Volume of all stock consumed past 4 quarters';
      case 'yearly':
        return 'Volume of all stock consumed past 5 years';
      default:
        return 'Volume of all stock consumed past 7 days';
    }
  };

  const periods = getPeriods();
  const chartData = aggregateUsage(logs, periods, selectedPeriod);
  const maxUsage = Math.max(...chartData.map((d) => d.usage), 24);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col">
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Loading data...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-gray-900">{getPeriodTitle()}</h3>
          <p className="text-xs text-gray-500">{getPeriodDescription()}</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-[#F7F4F0] rounded-lg p-1">
          <button
            onClick={() => setSelectedPeriod('daily')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'daily'
                ? 'bg-[#3D261D] text-white shadow-sm'
                : 'text-[#6B5744] hover:text-[#2E1C15]'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setSelectedPeriod('weekly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'weekly'
                ? 'bg-[#3D261D] text-white shadow-sm'
                : 'text-[#6B5744] hover:text-[#2E1C15]'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setSelectedPeriod('monthly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'monthly'
                ? 'bg-[#3D261D] text-white shadow-sm'
                : 'text-[#6B5744] hover:text-[#2E1C15]'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setSelectedPeriod('quarterly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'quarterly'
                ? 'bg-[#3D261D] text-white shadow-sm'
                : 'text-[#6B5744] hover:text-[#2E1C15]'
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setSelectedPeriod('yearly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'yearly'
                ? 'bg-[#3D261D] text-white shadow-sm'
                : 'text-[#6B5744] hover:text-[#2E1C15]'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div
        className={`w-full ${
          selectedPeriod === 'monthly' ? 'h-[360px] sm:h-[400px]' : 'h-[300px] sm:h-[340px]'
        }`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{
              top: 10,
              right: 0,
              left: -35,
              bottom: selectedPeriod === 'monthly' ? 40 : 20
            }}
          >
            <defs>
              <linearGradient id="gradientBrown" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3D261D" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#3D261D" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval={selectedPeriod === 'monthly' ? 1 : 0}
              angle={selectedPeriod === 'monthly' ? -45 : 0}
              textAnchor={selectedPeriod === 'monthly' ? 'end' : 'middle'}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              domain={[0, Math.ceil(maxUsage / getYAxisStep()) * getYAxisStep()]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              cursor={{ stroke: '#d1d5db', strokeWidth: 1 }}
              formatter={(value) => [value.toFixed(2), 'Total Usage']}
              labelFormatter={(label) => {
                switch (selectedPeriod) {
                  case 'daily':
                    return `Day: ${label}`;
                  case 'weekly':
                    return `Week: ${label}`;
                  case 'monthly':
                    return `Month: ${label}`;
                  case 'quarterly':
                    return `Quarter: ${label}`;
                  case 'yearly':
                    return `Year: ${label}`;
                  default:
                    return label;
                }
              }}
            />
            <Area
              type="monotone"
              dataKey="usage"
              stroke="#3D261D"
              strokeWidth={2}
              fill="url(#gradientBrown)"
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
