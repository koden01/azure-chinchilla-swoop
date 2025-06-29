import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Maximize, TriangleAlert, Info, Clock } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: number | string | React.ReactNode;
  secondaryTitle?: string;
  secondaryValue?: number | string | React.ReactNode;
  sisaTitle?: string;
  sisaValue?: number | string | React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  icon: "package" | "maximize" | "warning" | "info" | "clock";
  onClick?: () => void;
  onSisaClick?: () => void;
}

const iconMap = {
  package: Package,
  maximize: Maximize,
  warning: TriangleAlert,
  info: Info,
  clock: Clock,
};

const SummaryCard: React.FC<SummaryCardProps> = React.memo(({
  title,
  value,
  secondaryTitle,
  secondaryValue,
  sisaTitle,
  sisaValue,
  gradientFrom,
  gradientTo,
  icon,
  onClick,
  onSisaClick,
}) => {
  const IconComponent = iconMap[icon];

  return (
    <Card
      className={`relative overflow-hidden rounded-lg shadow-lg transform transition-transform hover:scale-105 text-white ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}
      ></div>
      <div className="relative z-10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {IconComponent && <IconComponent className="h-4 w-4 text-white opacity-70" />}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {secondaryTitle && secondaryValue !== undefined && (
            <p className="text-xs text-white opacity-80">
              {secondaryTitle}: {secondaryValue}
            </p>
          )}
          {sisaTitle && sisaValue !== undefined && (
            <p
              className={`text-xs text-white opacity-80 mt-1 ${onSisaClick ? "cursor-pointer hover:underline" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSisaClick && onSisaClick();
              }}
            >
              {sisaTitle}: {sisaValue}
            </p>
          )}
        </CardContent>
      </div>
    </Card>
  );
});

export default SummaryCard;