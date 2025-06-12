import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, Clock, Package, Maximize, CalendarDays } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: number | string;
  gradientFrom: string;
  gradientTo: string;
  icon?: "warning" | "info" | "clock" | "package" | "maximize" | "calendar";
  onClick?: () => void;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  gradientFrom,
  gradientTo,
  icon,
  onClick,
}) => {
  const IconComponent =
    icon === "warning"
      ? AlertTriangle
      : icon === "info"
      ? Info
      : icon === "clock"
      ? Clock
      : icon === "package"
      ? Package
      : icon === "maximize"
      ? Maximize
      : icon === "calendar"
      ? CalendarDays
      : null;

  return (
    <Card
      className={cn(
        `relative overflow-hidden text-white shadow-lg cursor-pointer`,
        `bg-gradient-to-br ${gradientFrom} ${gradientTo}`
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {IconComponent && <IconComponent className="h-4 w-4 text-white opacity-70" />}
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
};

export default SummaryCard;