/**
 * frontend/src/components/RoleGate.tsx
 * Role-based access control wrapper.
 * Renders children only if the current role matches allowed roles.
 */
import React, { createContext, useContext, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

export type UserRole = 'ddma_operator' | 'insurer_viewer' | 'admin' | 'public';

interface RoleContextValue {
  role: UserRole;
  setRole: (r: UserRole) => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'ddma_operator',
  setRole: () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('ddma_operator');
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

interface RoleGateProps {
  allowed: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ allowed, children, fallback }: RoleGateProps) {
  const { role } = useRole();
  if (allowed.includes(role)) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '12px', padding: '48px',
      color: 'var(--text-muted)', textAlign: 'center',
    }}>
      <ShieldAlert size={40} style={{ color: 'var(--color-warning)' }} />
      <p style={{ fontSize: 'var(--text-sm)' }}>
        Access restricted to: <strong>{allowed.join(', ')}</strong>
      </p>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        Current role: {role}
      </p>
    </div>
  );
}
