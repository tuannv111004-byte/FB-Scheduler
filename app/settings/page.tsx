"use client"

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings, Bell, Clock, Database } from 'lucide-react'
import { useTheme } from 'next-themes'
import { ThemeToggle } from '@/components/theme-toggle'

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDarkMode = mounted ? resolvedTheme !== 'light' : true

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="app-main transition-[margin] md:ml-64">
        <Header title="Settings" subtitle="Configure your PostOps preferences" />
        <div className="p-6 space-y-6">
          {/* General Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">General Settings</CardTitle>
              </div>
              <CardDescription>Basic application configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">Switch between dark and light theme</p>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  disabled={!mounted}
                />
              </div>
              <div className="flex justify-end">
                <ThemeToggle />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact View</Label>
                  <p className="text-xs text-muted-foreground">Use smaller spacing in tables</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Notification Settings</CardTitle>
              </div>
              <CardDescription>Configure how you receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Browser Notifications</Label>
                  <p className="text-xs text-muted-foreground">Show desktop notifications for due posts</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Late Post Alerts</Label>
                  <p className="text-xs text-muted-foreground">Alert when posts are overdue</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Empty Slot Warnings</Label>
                  <p className="text-xs text-muted-foreground">Warn about unfilled time slots</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder">Reminder Time (minutes before)</Label>
                <Input
                  id="reminder"
                  type="number"
                  defaultValue={15}
                  className="w-32"
                  min={5}
                  max={60}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule Settings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Schedule Settings</CardTitle>
              </div>
              <CardDescription>Default posting schedule configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultSlots">Default Posts Per Day</Label>
                <Input
                  id="defaultSlots"
                  type="number"
                  defaultValue={5}
                  className="w-32"
                  min={1}
                  max={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  defaultValue="Asia/Ho_Chi_Minh (UTC+7)"
                  disabled
                  className="w-64"
                />
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Data Management</CardTitle>
              </div>
              <CardDescription>Export and manage your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outline">Export Pages</Button>
                <Button variant="outline">Export Posts</Button>
                <Button variant="outline">Export Schedule</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Data is currently stored locally. Connect a database for persistent storage.
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button>Save Settings</Button>
          </div>
        </div>
      </main>
    </div>
  )
}
