import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  Maximize,
  AlertTriangle,
  Info,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string | number;
  secondaryTitle?: string; // New prop for secondary title
  secondaryValue?: string | number; // New prop for secondary value
  gradientFrom: string;
  gradientTo: string;
  icon:
    | "package"
    | "maximize"
    | "warning"
    | "info"
    | "clock"
    | "truck"
    | "check"
    | "x";
  onClick?: () => void;
}

const iconMap = {
  package: Package,
  maximize: Maximize,
  warning: AlertTriangle,
  info: Info,
  clock: Clock,
  truck: Truck,
  check: CheckCircle,
  x: XCircle,
};

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  secondaryTitle,
  secondaryValue,
  gradientFrom,
  gradientTo,
  icon,
  onClick,
}) => {
  const IconComponent = iconMap[icon];

  return (
    <Card
      className={`relative overflow-hidden rounded-lg shadow-lg transform transition-transform hover:scale-105 cursor-pointer text-white`}
      onClick={onClick}
    >
      {/* Lapisan gradien sebagai latar belakang */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}
      ></div>
      {/* Konten kartu dengan z-index untuk memastikan di atas gradien */}
      <div className="relative z-10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {IconComponent && <IconComponent className="h-4 w-4 text-white opacity-70" />}
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{value}</div>
          {secondaryValue !== undefined && secondaryTitle && (
            <div className="text-sm opacity-80 mt-1">
              {secondaryTitle}: <span className="font-semibold">{secondaryValue}</span>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
};

export default SummaryCard;