const base=(process.env.PUBLIC_BASE_URL||'http://localhost:3000').replace(/\/$/,'');

export const branding={
  siteName:'PulseVeto',
  shortName:'PulseVeto',
  defaultTitle:'PulseVeto丨Powered by Pulse Studio',
  titleTemplate:'%s｜PulseVeto',
  poweredBy:'Powered by Pulse Studio',
  defaultDescription:'適用於《特戰英豪》的電競賽事地圖 Ban/Pick 系統',
  faviconPath:'/branding/PulseVeto_Favicon.png',
  appleTouchIconPath:'/branding/PulseVeto_MainIcon.png',
  defaultOgImagePath:'/branding/PulseVeto_MainLogo.png',
  pulseStudioLogoPath:'https://cdn.pulse-studio.live/uploads/Logo_Pulse_Studio_W.png',
  themeColor:'#5865F2',
  backgroundColor:'#090B10',
  publicBaseUrl:base,
} as const;

export const absoluteUrl=(resourcePath:string)=>new URL(resourcePath,`${base}/`).toString();
