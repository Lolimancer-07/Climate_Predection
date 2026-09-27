import React from 'react';

interface ProviderModeBadgeProps {
  provider: 'mock' | 'imd' | 'jtwc' | 'gdacs';
}

export const ProviderModeBadge: React.FC<ProviderModeBadgeProps> = ({ provider }) => {
  const getBadgeConfig = () => {
    switch (provider) {
      case 'mock':
        return { label: 'Data Source: MOCK', color: 'bg-orange-500 text-white', icon: '⚠️' };
      case 'imd':
        return { label: 'Data Source: IMD (Live)', color: 'bg-green-600 text-white', icon: '📡' };
      default:
        return { label: `Data Source: ${provider.toUpperCase()}`, color: 'bg-blue-600 text-white', icon: '📡' };
    }
  };

  const config = getBadgeConfig();

  return (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold ${config.color} shadow-sm border border-black/10`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
};
