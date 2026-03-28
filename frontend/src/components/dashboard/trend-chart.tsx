"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
  Bar,
} from 'recharts'

interface DailyTrend {
  date: string
  in_count: number
  out_count: number
  in_value: number
  out_value: number
}

interface TrendChartProps {
  data: DailyTrend[]
  title: string
}

interface ChartDataPoint {
  date: string
  in_count: number
  out_count: number
  total_count: number
  in_value: number
  out_value: number
  total_value: number
}

export function TrendChart({ data, title }: TrendChartProps) {
  const t = useTranslations('dashboard')
  const [chartType, setChartType] = useState<'line' | 'area' | 'mixed'>('line')
  const [metric, setMetric] = useState<'count' | 'value'>('count')
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(30)

  // 计算累计库存总量
  const chartData: ChartDataPoint[] = useMemo(() => {
    // 取最近N天数据
    const slicedData = data.slice(-timeRange)

    // 计算累计总量
    let runningTotalCount = 0
    let runningTotalValue = 0

    return slicedData.map(d => {
      runningTotalCount += d.in_count - d.out_count
      runningTotalValue += d.in_value - d.out_value

      return {
        ...d,
        date: d.date.slice(5), // MM-DD
        total_count: Math.max(0, runningTotalCount),
        total_value: Math.max(0, runningTotalValue),
      }
    })
  }, [data, timeRange])

  const formatValue = (val: number) => {
    if (metric === 'value') {
      if (val >= 10000) {
        return `¥${(val / 10000).toFixed(1)}w`
      }
      return `¥${val.toFixed(0)}`
    }
    return val.toString()
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">
                {entry.dataKey?.includes('value') ? `¥${entry.value.toFixed(2)}` : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  // 根据图表类型选择组件
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 10, left: 0, bottom: 0 },
    }

    const commonAxis = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          stroke="hsl(var(--muted-foreground))"
          interval="preserveStartEnd"
          minTickGap={30}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatValue}
          stroke="hsl(var(--muted-foreground))"
          width={50}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatValue}
          stroke="hsl(var(--muted-foreground))"
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
      </>
    )

    if (chartType === 'mixed') {
      return (
        <ComposedChart {...commonProps}>
          {commonAxis}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey={metric === 'count' ? 'total_count' : 'total_value'}
            name={metric === 'count' ? t('totalQty') : t('totalValue')}
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.1}
            strokeWidth={2}
          />
          <Bar
            yAxisId="right"
            dataKey={metric === 'count' ? 'in_count' : 'in_value'}
            name={metric === 'count' ? t('inQty') : t('inValue')}
            fill="#22c55e"
            radius={[2, 2, 0, 0]}
            maxBarSize={20}
          />
          <Bar
            yAxisId="right"
            dataKey={metric === 'count' ? 'out_count' : 'out_value'}
            name={metric === 'count' ? t('outQty') : t('outValue')}
            fill="#ef4444"
            radius={[2, 2, 0, 0]}
            maxBarSize={20}
          />
        </ComposedChart>
      )
    }

    if (chartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          {commonAxis}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey={metric === 'count' ? 'total_count' : 'total_value'}
            name={metric === 'count' ? t('totalQty') : t('totalValue')}
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey={metric === 'count' ? 'in_count' : 'in_value'}
            name={metric === 'count' ? t('inQty') : t('inValue')}
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey={metric === 'count' ? 'out_count' : 'out_value'}
            name={metric === 'count' ? t('outQty') : t('outValue')}
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      )
    }

    return (
      <LineChart {...commonProps}>
        {commonAxis}
        <Line
          yAxisId="left"
          type="monotone"
          dataKey={metric === 'count' ? 'total_count' : 'total_value'}
          name={metric === 'count' ? t('totalQty') : t('totalValue')}
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={metric === 'count' ? 'in_count' : 'in_value'}
          name={metric === 'count' ? t('inQty') : t('inValue')}
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={metric === 'count' ? 'out_count' : 'out_value'}
          name={metric === 'count' ? t('outQty') : t('outValue')}
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {/* Time range toggle */}
            <div className="flex bg-muted rounded-lg p-0.5">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days as 7 | 14 | 30)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    timeRange === days
                      ? 'bg-background shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {days}天
                </button>
              ))}
            </div>
            {/* Metric toggle */}
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setMetric('count')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  metric === 'count'
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('qty')}
              </button>
              <button
                onClick={() => setMetric('value')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  metric === 'value'
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('value')}
              </button>
            </div>
            {/* Chart type toggle */}
            <div className="flex bg-muted rounded-lg p-0.5">
              {[
                { key: 'line', label: t('line') },
                { key: 'area', label: t('area') },
                { key: 'mixed', label: t('mixed') },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setChartType(key as 'line' | 'area' | 'mixed')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    chartType === key
                      ? 'bg-background shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
