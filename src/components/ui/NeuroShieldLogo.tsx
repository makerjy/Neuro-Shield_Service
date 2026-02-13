const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;

interface NeuroShieldLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textColor?: string;
  subtitle?: string;
  subtitleColor?: string;
  variant?: 'light' | 'dark';
}

/**
 * Neuro-Shield 공식 로고 (실제 이미지 사용)
 * public/logo.png 파일 참조
 */
export function NeuroShieldLogo({
  size = 40,
  className = '',
  showText = false,
  textColor,
  subtitle,
  subtitleColor,
  variant = 'dark',
}: NeuroShieldLogoProps) {
  const finalTextColor = textColor || (variant === 'dark' ? '#ffffff' : '#1e293b');
  const finalSubColor = subtitleColor || (variant === 'dark' ? '#94a3b8' : '#64748b');

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={LOGO_URL}
        alt="Neuro-Shield"
        width={size}
        height={size}
        className="shrink-0 object-contain"
        draggable={false}
      />

      {showText && (
        <div className="min-w-0">
          <h1 className="font-bold text-sm leading-tight truncate" style={{ color: finalTextColor }}>
            Neuro-Shield
          </h1>
          {subtitle && (
            <p className="text-[10px] leading-tight truncate" style={{ color: finalSubColor }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 큰 로고 (로그인 화면용)
 */
export function NeuroShieldLogoLarge({
  size = 80,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src={LOGO_URL}
        alt="Neuro-Shield"
        width={size}
        height={size}
        className="object-contain"
        draggable={false}
      />

      <h1 className="mt-4 text-4xl font-bold bg-gradient-to-r from-blue-700 via-teal-600 to-teal-500 bg-clip-text text-transparent">
        Neuro-Shield
      </h1>
      <p className="text-gray-500 text-sm mt-1">치매 예방 및 관리 시스템</p>
    </div>
  );
}
