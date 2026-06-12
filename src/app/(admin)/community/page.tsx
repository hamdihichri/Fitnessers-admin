'use client'
import { useState } from 'react'
import { PageHeader, Tabs } from '@/components/ui'
import { BroadcastsTab } from './BroadcastsTab'
import { ClansTab } from './ClansTab'

const TABS = [
  { key: 'broadcasts', label: 'Broadcasts' },
  { key: 'clans', label: 'Clans' },
]

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState('broadcasts')

  return (
    <div>
      <PageHeader 
        title="Community Management" 
        crumb="Community" 
      />
      
      <Tabs 
        tabs={TABS} 
        active={activeTab} 
        onChange={setActiveTab} 
      />

      <div style={{ marginTop: 24 }}>
        {activeTab === 'broadcasts' && <BroadcastsTab />}
        {activeTab === 'clans' && <ClansTab />}
      </div>
    </div>
  )
}
