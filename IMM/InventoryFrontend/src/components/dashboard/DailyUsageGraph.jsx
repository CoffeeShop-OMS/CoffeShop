import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const getDayLabel = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(date).getDay()];
};

const getWeekLabel = (date) => {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
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

const getYearLabel = (date) => {
  return date.getFullYear().toString();
};

const getLast5Years = () => {
  const years = [];
  for (let i = 4; i >= 0; i--) {
    const date = new Date();
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
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    days.push({ date: dateStr, label: getDayLabel(dateStr) });
  }
  return days;
};

const getLast4Weeks = () => {
  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - (i * 7));
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    weeks.push({ date: weekKey, label: getWeekLabel(weekStart) });
  }
  return weeks;
};

const getLast12Months = () => {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    date.setDate(1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    months.push({ date: monthKey, label: getMonthLabel(date) });
  }
  return months;
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

  // Sum negative adjustments (consumption) by period for ALL ingredients
  logs.forEach((log) => {
    if (log.action === 'STOCK_ADJUST' && log.details?.adjustment < 0) {
      const timestamp = log.timestamp;
      let date = null;

      // Handle different timestamp formats
      if (typeof timestamp?.toDate === 'function') {
        date = timestamp.toDate();
      } else if (typeof timestamp === 'object' && (timestamp._seconds || timestamp.seconds)) {
        date = new Date((timestamp._seconds || timestamp.seconds) * 1000);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      }

      if (date) {
        let periodKey = null;

        // Determine period key based on period type
        switch (periodType) {
          case 'daily':
            periodKey = date.toISOString().split('T')[0];
            break;
          case 'weekly':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            periodKey = weekStart.toISOString().split('T')[0];
            break;
          case 'monthly':
            periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
            break;
          case 'yearly':
            periodKey = `${date.getFullYear()}-01-01`;
            break;
        }

        if (periodKey && aggregated.hasOwnProperty(periodKey)) {
          // Sum absolute value of negative adjustments
          aggregated[periodKey] += Math.abs(log.details.adjustment);
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

  const getPeriods = () => {
    switch (selectedPeriod) {
      case 'daily':
        return getLast7Days();
      case 'weekly':
        return getLast4Weeks();
      case 'monthly':
        return getLast12Months();
      case 'yearly':
        return getLast5Years();
      default:
        return getLast7Days();
    }
  };

  const getPeriodTitle = () => {
    switch (selectedPeriod) {
      case 'daily':
        return 'Daily Ingredient Usage';
      case 'weekly':
        return 'Weekly Ingredient Usage';
      case 'monthly':
        return 'Monthly Ingredient Usage';
      case 'yearly':
        return 'Yearly Ingredient Usage';
      default:
        return 'Daily Ingredient Usage';
    }
  };

  const getPeriodDescription = () => {
    switch (selectedPeriod) {
      case 'daily':
        return 'Volume of all ingredients consumed past 7 days';
      case 'weekly':
        return 'Volume of all ingredients consumed past 4 weeks';
      case 'monthly':
        return 'Volume of all ingredients consumed past 12 months';
      case 'yearly':
        return 'Volume of all ingredients consumed past 5 years';
      default:
        return 'Volume of all ingredients consumed past 7 days';
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
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSelectedPeriod('daily')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'daily'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setSelectedPeriod('weekly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'weekly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setSelectedPeriod('monthly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setSelectedPeriod('yearly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedPeriod === 'yearly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
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
              domain={[0, Math.ceil(maxUsage / (selectedPeriod === 'yearly' ? 200 : selectedPeriod === 'monthly' ? 50 : selectedPeriod === 'weekly' ? 20 : 5)) * (selectedPeriod === 'yearly' ? 200 : selectedPeriod === 'monthly' ? 50 : selectedPeriod === 'weekly' ? 20 : 5)]}
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
