import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './card';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: LucideIcon;
  iconColor?: string;
}

export default function StatCard({
  title,
  value,
  change,
  changeType = 'positive',
  icon: Icon,
  iconColor = 'bg-blue-100 text-blue-600',
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm mb-1">{title}</p>
          <p className="text-gray-900 mb-1">{value}</p>
          {change && (
            <p className={`text-sm ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
              {change}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={24} />
        </div>
      </CardContent>
    </Card>
  );
}
