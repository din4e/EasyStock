"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'
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

export function TrendChart({ data, title }: TrendChartProps) {
  const [chartType, setChartType] = useState<'line' | 'area'>('line')
  const [metric, setMetric] = useState<'count' | 'value'>('count')

  // 最近7天数据
  const last7Days = data.slice(-7)

  const chartData = last7Days.map(d => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }))

  const formatValue = (val: number) => {
    if (metric === 'value') {
      return `¥${val.toFixed(0)}`
    }
    return val.toString()
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">
                {entry.name.includes('金额') ? `¥${entry.value.toFixed(2)}` : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const ChartComponent = chartType === 'line' ? LineChart : AreaChart

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <div className="flex gap-2">
            {/* Metric toggle */}
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setMetric('count')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  metric === 'count'
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                数量
              </button>
              <button
                onClick={() => setMetric('value')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  metric === 'value'
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                金额
              </button>
            </div>
            {/* Chart type toggle */}
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  chartType === 'line'
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                折线
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  chartType === 'area'
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                面积
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
                className="text-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {chartType === 'area' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey={metric === 'count' ? 'in_count' : 'in_value'}
                    name={metric === 'count' ? '入库数量' : '入库金额'}
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey={metric === 'count' ? 'out_count' : 'out_value'}
                    name={metric === 'count' ? '出库数量' : '出库金额'}
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.2}
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey={metric === 'count' ? 'in_count' : 'in_value'}
                    name={metric === 'count' ? '入库数量' : '入库金额'}
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric === 'count' ? 'out_count' : 'out_value'}
                    name={metric === 'count' ? '出库数量' : '出库金额'}
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </>
              )}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
