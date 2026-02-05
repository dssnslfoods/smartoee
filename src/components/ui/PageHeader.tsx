import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ 
  title, 
  description, 
  icon: Icon, 
  children,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn('page-header', className)}>
      <div className="page-title">
        {Icon && (
          <div className="page-title-icon">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-foreground/80 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
