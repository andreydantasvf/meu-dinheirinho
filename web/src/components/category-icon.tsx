import React from 'react';
import {
  IconShoppingBag,
  IconShoppingCart,
  IconHome,
  IconToolsKitchen2,
  IconCar,
  IconSparkles,
  IconHeartbeat,
  IconCash,
  IconWallet,
  IconPlane,
  IconDeviceLaptop,
  IconArmchair,
  IconCategory,
} from '@tabler/icons-react';

interface CategoryIconProps {
  name?: string;
  icon?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}

const iconMap: Record<string, React.ElementType> = {
  mercado: IconShoppingCart,
  supermercado: IconShoppingCart,
  alimentacao: IconToolsKitchen2,
  restaurante: IconToolsKitchen2,
  casa: IconHome,
  aluguel: IconHome,
  moradia: IconHome,
  transporte: IconCar,
  uber: IconCar,
  combustivel: IconCar,
  viagem: IconPlane,
  saude: IconHeartbeat,
  farmacia: IconHeartbeat,
  assinaturas: IconSparkles,
  lazer: IconSparkles,
  entretenimento: IconSparkles,
  salario: IconCash,
  receita: IconWallet,
  trabalho: IconDeviceLaptop,
  moveis: IconArmchair,
  compras: IconShoppingBag,
};

function getIconComponent(
  name?: string,
  icon?: string | null,
): React.ElementType {
  if (icon && icon.length > 2 && iconMap[icon.toLowerCase()]) {
    return iconMap[icon.toLowerCase()];
  }
  if (name) {
    const key = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    for (const [k, Component] of Object.entries(iconMap)) {
      if (key.includes(k)) return Component;
    }
  }
  return IconCategory;
}

export function CategoryIcon({
  name,
  icon,
  color,
  size = 18,
  className = '',
}: CategoryIconProps) {
  const isEmoji = Boolean(
    icon && icon.trim() && Array.from(icon.trim()).length <= 2,
  );
  const IconComponent = getIconComponent(name, icon);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl transition-all ${className}`}
      style={{
        backgroundColor: color ? `${color}20` : 'rgba(0, 200, 255, 0.14)',
        color: color || 'var(--primary)',
      }}
    >
      {isEmoji ? (
        <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>{icon}</span>
      ) : (
        <React.Fragment>
          {React.createElement(IconComponent, { size, stroke: 2 })}
        </React.Fragment>
      )}
    </span>
  );
}
