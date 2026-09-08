export const Colors = {
  // Primary palette from splash-logo.png
  primaryGreen: "#1B4332",
  accentOrange: "#E86A33",
  mintGreen: "#C6E7CE",
  cream: "#F5EFE5",

  // Neutral colors
  white: "#FFFFFF",
  black: "#000000",

  // Status colors
  error: "#E05252",
  success: "#2ECC71",
  warning: "#F39C12",

  // Gray scale
  gray100: "#F8F9FA",
  gray200: "#E9ECEF",
  gray300: "#DEE2E6",
  gray400: "#CED4DA",
  gray500: "#ADB5BD",
  gray600: "#6C757D",
  gray700: "#495057",
  gray800: "#343A40",
  gray900: "#212529",
};

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  card: string;
  cardSecondary: string;

  // Primary brand
  primary: string;
  primaryLight: string;
  accent: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Input
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;

  // Borders
  border: string;
  borderLight: string;

  // Status
  error: string;
  success: string;
  warning: string;

  // Tab bar
  tabBarBackground: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;

  // Header
  headerBackground: string;
  headerText: string;
}

export const LightTheme: ThemeColors = {
  // Backgrounds - using splash mint/cream colors
  background: Colors.mintGreen,
  backgroundSecondary: Colors.cream,
  card: Colors.white,
  cardSecondary: Colors.gray100,

  // Primary brand
  primary: Colors.primaryGreen,
  primaryLight: Colors.mintGreen,
  accent: Colors.accentOrange,

  // Text
  text: Colors.primaryGreen,
  textSecondary: Colors.gray700,
  textMuted: Colors.gray600,
  textInverse: Colors.white,

  // Input
  inputBackground: Colors.white,
  inputBorder: Colors.gray300,
  inputText: Colors.gray900,
  placeholder: Colors.gray500,

  // Borders
  border: Colors.gray300,
  borderLight: Colors.gray200,

  // Status
  error: Colors.error,
  success: Colors.success,
  warning: Colors.warning,

  // Tab bar
  tabBarBackground: Colors.white,
  tabBarBorder: Colors.gray200,
  tabActive: Colors.accentOrange,
  tabInactive: Colors.gray500,

  // Header
  headerBackground: Colors.primaryGreen,
  headerText: Colors.white,
};

export const DarkTheme: ThemeColors = {
  // Backgrounds - dark theme
  background: "#0D0D0D",
  backgroundSecondary: "#1A1A1A",
  card: "#1A1A1A",
  cardSecondary: "#252525",

  // Primary brand
  primary: Colors.primaryGreen,
  primaryLight: "#2D5A47",
  accent: Colors.accentOrange,

  // Text
  text: Colors.white,
  textSecondary: "#CCCCCC",
  textMuted: "#6B6B6B",
  textInverse: Colors.black,

  // Input
  inputBackground: "#1A1A1A",
  inputBorder: "#2D2D2D",
  inputText: Colors.white,
  placeholder: "#6B6B6B",

  // Borders
  border: "#2D2D2D",
  borderLight: "#3D3D3D",

  // Status
  error: Colors.error,
  success: Colors.success,
  warning: Colors.warning,

  // Tab bar
  tabBarBackground: "#0D0D0D",
  tabBarBorder: "#2D2D2D",
  tabActive: Colors.accentOrange,
  tabInactive: "#6B6B6B",

  // Header
  headerBackground: Colors.primaryGreen,
  headerText: Colors.white,
};
