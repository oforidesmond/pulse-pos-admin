type BrandConfig = {
  appName: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  metaTitle: string;
  metaDescription: string;
  iconPath: string;
  logoText: string;
  supportUrl: string;
};

function readEnv(key: string) {
  return process.env[key];
}

function withFallback(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function getBrandConfig(): BrandConfig {
  const businessName = withFallback(readEnv('NEXT_PUBLIC_BRAND_BUSINESS_NAME'), 'Pulse POS');
  const appName = withFallback(readEnv('NEXT_PUBLIC_BRAND_APP_NAME'), `${businessName} Admin`);

  return {
    appName,
    businessName,
    businessEmail: withFallback(readEnv('NEXT_PUBLIC_BRAND_BUSINESS_EMAIL'), ''),
    businessPhone: withFallback(readEnv('NEXT_PUBLIC_BRAND_BUSINESS_PHONE'), ''),
    businessAddress: withFallback(readEnv('NEXT_PUBLIC_BRAND_BUSINESS_ADDRESS'), ''),
    metaTitle: withFallback(readEnv('NEXT_PUBLIC_BRAND_META_TITLE'), appName),
    metaDescription: withFallback(
      readEnv('NEXT_PUBLIC_BRAND_META_DESCRIPTION'),
      `Admin dashboard experience for ${businessName}.`
    ),
    iconPath: withFallback(readEnv('NEXT_PUBLIC_BRAND_ICON_PATH'), '/pos-icon.ico'),
    logoText: withFallback(readEnv('NEXT_PUBLIC_BRAND_LOGO_TEXT'), businessName.slice(0, 1).toUpperCase()),
    supportUrl: withFallback(readEnv('NEXT_PUBLIC_BRAND_SUPPORT_URL'), '#'),
  };
}
