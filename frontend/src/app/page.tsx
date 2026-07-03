'use client';

import { Badge } from '@/components/reui/badge';
import {
    Frame,
    FrameDescription,
    FrameHeader,
    FramePanel,
    FrameTitle,
} from '@/components/reui/frame';
import { SessionInitializer } from '@/components/session-initializer';
import { useSession } from '@/components/session-provider';
import {
    ArrowRight,
    ClipboardList,
    Factory,
    HardHat,
    Loader2,
    Truck,
    Warehouse,
} from 'lucide-react';
import Link from 'next/link';

const ROLES = [
  {
    href: '/ppic',
    title: 'PPIC',
    description: 'Production Planning & Inventory Control',
    icon: ClipboardList,
  },
  {
    href: '/supervisor',
    title: 'Supervisor',
    description: 'Oversee factory floor operations',
    icon: HardHat,
  },
  {
    href: '/warehouse',
    title: 'Warehouse',
    description: 'Manage raw material inventory',
    icon: Warehouse,
  },
  {
    href: '/shipping',
    title: 'Shipping',
    description: 'Handle final product delivery',
    icon: Truck,
  },
  { href: '/ws/WS1', title: 'Workstation 1', description: 'Perakitan Chassis & Axle', icon: Factory },
  { href: '/ws/WS2', title: 'Workstation 2', description: 'Perakitan Roda', icon: Factory },
  { href: '/ws/WS3', title: 'Workstation 3', description: 'Pemasangan Body', icon: Factory },
  { href: '/ws/WS4', title: 'Workstation 4', description: 'Quality Inspection', icon: Factory },
];

export default function HubPage() {
  const { activeSessionId, isLoadingSession, setActiveSessionId } = useSession();

  if (isLoadingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (!activeSessionId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-muted/50">
        <SessionInitializer onSessionStart={setActiveSessionId} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/50 p-4">
      <Frame className="w-full max-w-4xl">
        <FrameHeader className="flex-row items-center justify-between">
          <div>
            <FrameTitle>Welcome to the Factory Floor</FrameTitle>
            <FrameDescription>Select your role to continue.</FrameDescription>
          </div>
          <Badge variant="outline">Active Session: {activeSessionId}</Badge>
        </FrameHeader>
        <FramePanel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {ROLES.map((role) => (
              <Link key={role.href} href={role.href} className="group block rounded-lg border border-border bg-card p-4 text-card-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <role.icon className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-semibold">{role.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}