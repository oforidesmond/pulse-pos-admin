'use client';

import { useState } from 'react';
import { Save, CheckCircle, XCircle, RefreshCw, Building2, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const [businessName, setBusinessName] = useState('Sika Ventures Admin');
  const [businessEmail, setBusinessEmail] = useState('descoservicesgh2@gmail.com');
  const [businessPhone, setBusinessPhone] = useState('0554492626');
  const [businessAddress, setBusinessAddress] = useState('Spintex Road, Texpo');
  const [timezone, setTimezone] = useState('America/New_York');
  const [syncStatus, setSyncStatus] = useState<'active' | 'inactive'>('active');

  const handleSaveSettings = () => {
    alert('Settings saved successfully!');
  };

  const handleSyncNow = () => {
    alert('Syncing data...');
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your store settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-gray-700" />
                <h3 className="text-gray-900">Business Information</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Business Name"
                type="text"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Your business name"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Email Address"
                  type="email"
                  value={businessEmail}
                  onChange={(event) => setBusinessEmail(event.target.value)}
                  placeholder="admin@example.com"
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  value={businessPhone}
                  onChange={(event) => setBusinessPhone(event.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <Input
                label="Business Address"
                type="text"
                value={businessAddress}
                onChange={(event) => setBusinessAddress(event.target.value)}
                placeholder="123 Main Street, City, State ZIP"
              />

              {/* <div>
                <label className="block text-gray-700 mb-2">Timezone</label>
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div> */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock size={20} className="text-gray-700" />
                <h3 className="text-gray-900">Security</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full">
                <Lock size={20} />
                Change Password
              </Button>
              <Button variant="outline" className="w-full">
                <User size={20} />
                Manage Users
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} variant="primary" size="lg">
              <Save size={20} />
              Save Settings
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw size={20} className="text-gray-700" />
                <h3 className="text-gray-900">Sync Status</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {syncStatus === 'active' ? (
                    <CheckCircle size={24} className="text-green-600" />
                  ) : (
                    <XCircle size={24} className="text-red-600" />
                  )}
                  <div>
                    <p className="text-gray-900">Status</p>
                    <p className={`text-sm ${syncStatus === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                      {syncStatus === 'active' ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-900 text-sm mb-1">Last Synced</p>
                <p className="text-blue-700">Today at 2:45 PM</p>
              </div>

              <Button onClick={handleSyncNow} variant="primary" className="w-full">
                <RefreshCw size={20} />
                Sync Now
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-gray-900">System Information</h3>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Version</span>
                <span className="text-gray-900">v2.5.1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Database</span>
                <span className="text-gray-900">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Storage Used</span>
                <span className="text-gray-900">2.4 GB / 10 GB</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <h4 className="text-blue-900 mb-2">Need Help?</h4>
              <p className="text-blue-700 text-sm mb-4">Check our documentation or contact support for assistance.</p>
              <Button variant="primary" size="sm" className="w-full">
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
