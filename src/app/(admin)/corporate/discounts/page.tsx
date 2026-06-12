'use client'
import { CorporateBulkDiscounts } from '@/components/CorporateBulkDiscounts'
import { PageHeader } from '@/components/ui'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function CorporateDiscountsPage() {
  return (
    <div className="page-enter">
      <PageHeader 
        title="Corporate Bulk Discounts" 
        crumb="Corporate / Discounts"
        actions={
          <Link href="/corporate" className="btn btn-ghost btn-sm">
            <ChevronLeft size={14} style={{ marginRight: 6 }} /> Back to Corporate
          </Link>
        }
      />
      
      <div style={{ maxWidth: 800 }}>
        <CorporateBulkDiscounts />
      </div>
    </div>
  )
}
