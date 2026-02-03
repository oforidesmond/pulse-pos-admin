'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package, TrendingUp, ShoppingCart } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { describeChange, MetricChange } from '@/lib/metrics';

type DashboardMetrics = {
  totalRevenue: number;
  totalSales: number;
  totalProducts: number;
  todaysRevenue: number;
};

type WeeklyPoint = {
  name: string;
  sales: number;
};

type QuickStats = {
  averageOrderValue: number;
  conversionRate: number;
  lowStockItems: number;
};

type Activity = {
  id: string;
  action: string;
  context: string;
  amount: number | null;
  timestamp: string;
};

type DashboardMetricChanges = {
  totalRevenue: MetricChange;
  totalSales: MetricChange;
  totalProducts: MetricChange;
  todaysRevenue: MetricChange;
};

type DashboardResponse = {
  metrics: DashboardMetrics;
  metricChanges: DashboardMetricChanges;
  weeklySalesOverview: WeeklyPoint[];
  quickStats: QuickStats;
  recentActivity: Activity[];
};

const currencyFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace('GHS', '₵').trim();
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const {
    data: dashboardData,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        throw new Error('Unable to load dashboard data.');
      }
      return (await response.json()) as DashboardResponse;
    },
    retry: 1,
  });

  const metrics = dashboardData?.metrics;
  const metricChanges = dashboardData?.metricChanges;
  const weeklySalesOverview = dashboardData?.weeklySalesOverview ?? [];
  const quickStats = dashboardData?.quickStats;
  const recentActivity = dashboardData?.recentActivity ?? [];

  const statCards = useMemo(
    () => [
      {
        title: 'Total Revenue',
        value: metrics ? formatCurrency(metrics.totalRevenue) : '₵0.00',
        change: describeChange(metricChanges?.totalRevenue, {
          descriptor: 'vs last week',
          formatter: formatCurrency,
        }).text,
        changeType: describeChange(metricChanges?.totalRevenue, {
          descriptor: 'vs last week',
          formatter: formatCurrency,
        }).type,
        icon: ShoppingCart,
        iconColor: 'bg-green-100 text-green-600',
      },
      {
        title: 'Total Sales',
        value: metrics ? metrics.totalSales.toLocaleString() : '0',
        change: describeChange(metricChanges?.totalSales, {
          descriptor: 'vs last week',
          formatter: (value) => value.toLocaleString(),
        }).text,
        changeType: describeChange(metricChanges?.totalSales, {
          descriptor: 'vs last week',
          formatter: (value) => value.toLocaleString(),
        }).type,
        icon: ShoppingCart,
        iconColor: 'bg-blue-100 text-blue-600',
      },
      {
        title: 'Total Products',
        value: metrics ? metrics.totalProducts.toLocaleString() : '0',
        change: describeChange(metricChanges?.totalProducts, {
          descriptor: 'vs last week',
          formatter: (value) => value.toLocaleString(),
        }).text,
        changeType: describeChange(metricChanges?.totalProducts, {
          descriptor: 'vs last week',
          formatter: (value) => value.toLocaleString(),
        }).type,
        icon: Package,
        iconColor: 'bg-purple-100 text-purple-600',
      },
      {
        title: "Today's Revenue",
        value: metrics ? formatCurrency(metrics.todaysRevenue) : '₵0.00',
        change: describeChange(metricChanges?.todaysRevenue, {
          descriptor: 'vs same day last week',
          formatter: formatCurrency,
        }).text,
        changeType: describeChange(metricChanges?.todaysRevenue, {
          descriptor: 'vs same day last week',
          formatter: formatCurrency,
        }).type,
        icon: TrendingUp,
        iconColor: 'bg-orange-100 text-orange-600',
      },
    ],
    [metrics, metricChanges],
  );

  const renderChart = () => {
    if (isPending) {
      return (
        <div className="flex items-center justify-center h-[300px] text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} />
          Loading weekly sales…
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex items-center justify-center h-[300px] text-red-500">
          Failed to load weekly sales overview.
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={weeklySalesOverview}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" stroke="#6B7280" />
          <YAxis stroke="#6B7280" />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
            }}
          />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#2563EB"
            strokeWidth={3}
            dot={{ fill: '#2563EB', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderQuickStats = () => {
    const stats = [
      {
        label: 'Average Order Value',
        value: quickStats ? formatCurrency(quickStats.averageOrderValue) : '₵0.00',
        color: 'bg-blue-50 text-blue-900',
      },
      {
        label: 'Conversion Rate',
        value: quickStats ? `${quickStats.conversionRate.toFixed(1)}%` : '0.0%',
        color: 'bg-green-50 text-green-900',
      },
      {
        label: 'Low Stock Items',
        value: quickStats ? `${quickStats.lowStockItems} products` : '0 products',
        color: 'bg-orange-50 text-orange-900',
      },
    ];

    if (isPending) {
      return (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} />
          Loading quick stats…
        </div>
      );
    }

    if (isError) {
      return <div className="text-red-500 text-center py-4">Failed to load quick stats.</div>;
    }

    return (
      <div className="space-y-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`p-4 rounded-lg ${stat.color.replace('text', 'border')} border`}>
            <p className={`${stat.color.split(' ')[1]} text-sm mb-1`}>{stat.label}</p>
            <p className={stat.color.replace('bg', 'text').split(' ')[1]}>{stat.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderRecentActivity = () => {
    if (isPending) {
      return (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} />
          Loading recent activity…
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex items-center justify-center py-12 text-red-500">Failed to load recent activity.</div>
      );
    }

    if (recentActivity.length === 0) {
      return <div className="flex items-center justify-center py-12 text-gray-500">No activity recorded yet.</div>;
    }

    return (
      <tbody className="divide-y divide-gray-200">
        {recentActivity.map((activity) => (
          <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-6 py-4 text-gray-900">{activity.action}</td>
            <td className="px-6 py-4 text-gray-700">{activity.context}</td>
            <td className="px-6 py-4 text-gray-700">
              {activity.amount !== null ? formatCurrency(activity.amount) : '—'}
            </td>
            <td className="px-6 py-4 text-gray-500 text-sm">{formatTimestamp(activity.timestamp)}</td>
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-gray-900 mb-2">Dashboard Overview</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your store today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            change={card.change}
            icon={card.icon}
            iconColor={card.iconColor}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h3 className="text-gray-900">Weekly Sales Overview</h3>
          </CardHeader>
          <CardContent className="pt-4">{renderChart()}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-gray-900">Quick Stats</h3>
          </CardHeader>
          <CardContent>{renderQuickStats()}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-gray-900">Recent Activity</h3>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Action</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Context</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Amount</th>
                  <th className="px-6 py-3 text-left text-gray-700 text-sm">Time</th>
                </tr>
              </thead>
              {renderRecentActivity()}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
