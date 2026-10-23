import React, { useState, useEffect } from 'react';

export interface SiteLogoProps {
  siteLogo?: string | null;
  variant?: 'header' | 'footer' | 'modal' | 'checkout' | 'admin' | 'hero' | 'compact';
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
  showSubtitle?: boolean;
}

export const SiteLogo: React.FC<SiteLogoProps> = ({
  siteLogo,
  variant = 'header',
  className = '',
  containerClassName = '',
  onClick,
  showSubtitle = true,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset error & loaded state whenever siteLogo prop changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [siteLogo]);

  // Variant size definitions
  const sizeStyles = {
    header: 'h-10 sm:h-12 max-h-10 sm:max-h-12 w-auto max-w-full object-contain object-left drop-shadow-md',
    footer: 'h-10 sm:h-12 max-h-10 sm:max-h-12 w-auto max-w-full object-contain object-left drop-shadow-md',
    modal: 'h-9 sm:h-10 max-h-10 w-auto max-w-[220px] object-contain drop-shadow',
    checkout: 'h-8 sm:h-9 max-h-9 w-auto max-w-[180px] object-contain object-left drop-shadow',
    admin: 'h-8 sm:h-10 max-h-10 w-auto max-w-[200px] object-contain object-left drop-shadow',
    hero: 'h-11 sm:h-13 max-h-13 w-auto max-w-[240px] object-contain object-left drop-shadow-lg',
    compact: 'h-7 sm:h-8 max-h-8 w-auto max-w-[140px] object-contain drop-shadow',
  };

  const badgeBoxSizes = {
    header: 'w-9 h-9 sm:w-10 sm:h-10 text-sm sm:text-base rounded-xl',
    footer: 'w-9 h-9 sm:w-10 sm:h-10 text-sm sm:text-base rounded-xl',
    modal: 'w-9 h-9 text-sm rounded-xl',
    checkout: 'w-8 h-8 text-xs rounded-lg',
    admin: 'w-8 h-8 text-xs rounded-lg',
    hero: 'w-10 h-10 text-base rounded-xl',
    compact: 'w-7 h-7 text-[11px] rounded-lg',
  };

  const titleSizes = {
    header: 'text-sm sm:text-base',
    footer: 'text-sm sm:text-base',
    modal: 'text-sm sm:text-base',
    checkout: 'text-xs sm:text-sm',
    admin: 'text-xs sm:text-sm',
    hero: 'text-base sm:text-lg',
    compact: 'text-xs',
  };

  const hasValidLogo = !!siteLogo && !imageError && siteLogo.trim().length > 0;

  return (
    <div 
      className={`inline-flex items-center shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${containerClassName}`}
      onClick={onClick}
    >
      {hasValidLogo ? (
        <div className="relative flex items-center overflow-hidden">
          <img
            src={siteLogo}
            alt="Website Logo"
            className={`${sizeStyles[variant]} ${imageLoaded ? 'opacity-100' : 'opacity-90'} transition-opacity duration-200 ${className}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
            loading="eager"
          />
        </div>
      ) : (
        /* Fallback 360° Uniform Brand Mark */
        <div className="flex items-center gap-2 group">
          <div className={`${badgeBoxSizes[variant]} bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/25 shrink-0 group-hover:scale-105 transition-transform`}>
            360°
          </div>
          <div className="flex flex-col">
            <span className={`font-black text-white ${titleSizes[variant]} tracking-tight leading-tight group-hover:text-blue-400 transition-colors`}>
              E-Commerce 360°
            </span>
            {showSubtitle && variant !== 'compact' && (
              <span className="text-[9px] sm:text-[10px] text-blue-400 font-semibold tracking-wider uppercase">
                Official Store
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
