'use client';

import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SocialLinks } from '../types';

const PLATFORMS: Array<{ key: keyof SocialLinks; label: string; icon: React.ElementType; placeholder: string }> = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/yourgym' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourgym' },
  { key: 'twitter', label: 'Twitter / X', icon: Twitter, placeholder: 'https://twitter.com/yourgym' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@yourgym' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/company/yourgym' },
];

interface SocialLinksEditorProps {
  value: SocialLinks;
  onChange: (value: SocialLinks) => void;
  disabled?: boolean;
}

export function SocialLinksEditor({ value, onChange, disabled }: SocialLinksEditorProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PLATFORMS.map(({ key, label, icon: Icon, placeholder }) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={`social-${key}`} className="flex items-center gap-1.5">
            <Icon className="size-4 text-muted-foreground" />
            {label}
          </Label>
          <Input
            id={`social-${key}`}
            type="url"
            placeholder={placeholder}
            value={value[key] ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
