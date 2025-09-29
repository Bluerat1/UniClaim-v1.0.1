import React, { useState, useEffect } from 'react';
import { format, subDays, startOfDay, endOfDay, isAfter, parseISO } from 'date-fns';

interface DateRangeSelectorProps {
  onDateRangeChange: (startDate: Date | null, endDate: Date | null) => void;
  className?: string;
}

const PRESET_RANGES = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'This year', value: 'year' },
  { label: 'All time', value: 'all' },
  { label: 'Custom', value: 'custom' },
];

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ onDateRangeChange, className = '' }) => {
  const [selectedRange, setSelectedRange] = useState<string>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showCustomRange, setShowCustomRange] = useState<boolean>(false);

  // Initialize default date range
  useEffect(() => {
    updateDateRange('30d');
  }, []);

  const updateDateRange = (range: string) => {
    const today = new Date();
    let newStartDate: Date | null = null;
    let newEndDate: Date | null = endOfDay(today);

    switch (range) {
      case '7d':
        newStartDate = startOfDay(subDays(today, 6));
        break;
      case '30d':
        newStartDate = startOfDay(subDays(today, 29));
        break;
      case '90d':
        newStartDate = startOfDay(subDays(today, 89));
        break;
      case 'year':
        newStartDate = startOfDay(new Date(today.getFullYear(), 0, 1));
        break;
      case 'all':
        newStartDate = null;
        newEndDate = null;
        break;
      case 'custom':
        setShowCustomRange(true);
        return;
      default:
        newStartDate = startOfDay(subDays(today, 29));
    }

    setShowCustomRange(false);
    setStartDate(newStartDate ? format(newStartDate, 'yyyy-MM-dd') : '');
    setEndDate(newEndDate ? format(newEndDate, 'yyyy-MM-dd') : '');
    
    if (onDateRangeChange) {
      onDateRangeChange(newStartDate, newEndDate);
    }
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const range = e.target.value;
    setSelectedRange(range);
    updateDateRange(range);
  };

  const handleCustomDateChange = () => {
    if (!startDate || !endDate) return;
    
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    
    if (isAfter(start, end)) {
      alert('Start date cannot be after end date');
      return;
    }
    
    if (onDateRangeChange) {
      onDateRangeChange(start, end);
    }
  };

  return (
    <div className={`flex flex-col md:flex-row items-start md:items-center gap-4 ${className}`}>
      <div className="flex-1">
        <label htmlFor="date-range" className="block text-sm font-medium text-gray-700 mb-1">
          Date Range
        </label>
        <select
          id="date-range"
          value={selectedRange}
          onChange={handleRangeChange}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          {PRESET_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {showCustomRange && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              max={endDate || format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                min={startDate}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
              <button
                type="button"
                onClick={handleCustomDateChange}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;
