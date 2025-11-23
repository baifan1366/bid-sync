"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import type { ClientType } from "@/lib/roles/constants"

interface ClientTypeSelectorProps {
    clientType?: ClientType | null
    onClientTypeChange: (type: ClientType) => void
    businessName?: string
    onBusinessNameChange?: (name: string) => void
    companyRegistration?: string
    onCompanyRegistrationChange?: (reg: string) => void
    disabled?: boolean
}

export function ClientTypeSelector({
    clientType,
    onClientTypeChange,
    businessName,
    onBusinessNameChange,
    companyRegistration,
    onCompanyRegistrationChange,
    disabled = false,
}: ClientTypeSelectorProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <Label>Client Type</Label>
                <RadioGroup
                    value={clientType || ''}
                    onValueChange={(value: string) => onClientTypeChange(value as ClientType)}
                    disabled={disabled}
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="individual" id="individual" />
                        <Label htmlFor="individual" className="cursor-pointer font-normal">
                            Individual
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="business" id="business" />
                        <Label htmlFor="business" className="cursor-pointer font-normal">
                            Business / Organization
                        </Label>
                    </div>
                </RadioGroup>
            </div>

            {clientType === 'business' && (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="business_name">
                            Business Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="business_name"
                            placeholder="Acme Corporation"
                            value={businessName || ''}
                            onChange={(e) => onBusinessNameChange?.(e.target.value)}
                            disabled={disabled}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="company_registration">
                            Company Registration Number (optional)
                        </Label>
                        <Input
                            id="company_registration"
                            placeholder="123456789"
                            value={companyRegistration || ''}
                            onChange={(e) => onCompanyRegistrationChange?.(e.target.value)}
                            disabled={disabled}
                        />
                    </div>
                </>
            )}
        </div>
    )
}
