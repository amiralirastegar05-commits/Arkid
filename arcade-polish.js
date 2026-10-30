/* ★ پولیش ظاهر: آیکون‌های SVG یکپارچه به‌جای ایموجی + ذخیرهٔ فایل در مرورگرهای داخلی (ایتا، تلگرام، ...)
   مستقل از index.html است و فقط DOM را تکمیل می‌کند. هیچ تابع هاب تغییر نمی‌کند. */
(function () {
  'use strict';

  /* ───────── مجموعهٔ آیکون (۲۴×۲۴، خط ۲، سبک Lucide) ───────── */
  var P = {
    'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'gamepad-2': '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
    'coins': '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    'crown': '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    'sparkle': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    'gift': '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    'share': '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h14"/><path d="M19 12v7a2 2 0 0 1-2 2"/>',
    'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    'gem': '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    'sprout': '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    'palette': '<circle cx="13.5" cy="6.5" r=".6" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".6" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".6" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".6" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    'medal': '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>',
    'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    'award': '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    'party-popper': '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
    'clipboard-check': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    'tv': '<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><path d="m17 2-5 5-5-5"/>',
    'calendar-days': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
    'paw-print': '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
    'ghost': '<path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
    'backpack': '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5"/><path d="M8 10h8"/>',
    'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'dices': '<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>',
    'dice-5': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'headphones': '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    'frame': '<path d="M22 6H2"/><path d="M22 18H2"/><path d="M6 2v20"/><path d="M18 2v20"/>',
    'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'clapperboard': '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'joystick': '<rect x="3" y="16" width="18" height="5" rx="2"/><path d="M12 16V9"/><circle cx="12" cy="6" r="3"/>',
    'activity': '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'tent': '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
    'accessibility': '<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/>',
    'flask-conical': '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
    'siren': '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1H5z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>',
    'diamond': '<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z"/>',
    'grid-3x3': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    'contrast': '<circle cx="12" cy="12" r="10"/><path d="M12 18a6 6 0 0 0 0-12v12z"/>',
    'flower-2': '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>',
    'glasses': '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>',
    'hat': '<path d="M2.5 18.5h19"/><path d="M6.5 18.5v-12a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v12"/><path d="M6.5 14h11"/>',
    'melon': '<path d="M3 10a9 9 0 0 0 18 0Z"/><path d="M6.5 10a5.5 5.5 0 0 0 11 0"/><path d="M9 14h.01"/><path d="M12 16h.01"/><path d="M15 14h.01"/><path d="M3 10h18"/>',
    'egg': '<path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"/>',
    'apple': '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
    'volume-x': '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M22 9l-6 6"/><path d="m16 9 6 6"/>',
    'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    'external': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
  };

  /* ایموجی/نویسه → [نام آیکون، پر؟]. ستاره‌ها و قلب پر می‌شوند. */
  var MAP = {
    '🏆': ['trophy'], '✓': ['check'], '⚠': ['triangle-alert'], '✕': ['x'], '🎮': ['gamepad-2'], '💰': ['coins'],
    '⭐': ['star', 1], '★': ['star', 1], '☆': ['star'], '👑': ['crown'], '⚡': ['zap'], '🔒': ['lock'], '✨': ['sparkles'],
    '🎁': ['gift'], '🎯': ['target'], '🔥': ['flame'], '📥': ['download'], '📤': ['share'], '🗑': ['trash-2'], '💎': ['gem'],
    '🌱': ['sprout'], '🎨': ['palette'], '🛒': ['shopping-cart'], '🏅': ['medal'], '📢': ['megaphone'], '❤': ['heart', 1],
    '📊': ['chart-column'], '🔄': ['refresh-cw'], '🔧': ['wrench'], '🚀': ['rocket'], '🐐': ['award'], '🎉': ['party-popper'],
    '📋': ['clipboard-check'], '📺': ['tv'], '📅': ['calendar-days'], '🐾': ['paw-print'], '🎃': ['ghost'], '🎒': ['backpack'],
    '⚙': ['settings'], '🎰': ['dices'], '🎲': ['dice-5'], '👤': ['user'], '🎧': ['headphones'], '✎': ['pencil'],
    '🎓': ['graduation-cap'], '🖼': ['image'], '🔗': ['link'], '🎬': ['clapperboard'], '👇': ['chevron-down'], '🕹': ['joystick'],
    '🏃': ['activity'], '🌙': ['moon'], '🎪': ['tent'], '♿': ['accessibility'], '🧪': ['flask-conical'], '🚨': ['siren'],
    '✦': ['sparkle', 1], '◈': ['diamond'], '▦': ['grid-3x3'], '◒': ['contrast'], '❀': ['flower-2'], '🕶': ['glasses'],
    '🎩': ['hat'], '🍉': ['melon'], '🥚': ['egg'], '🍎': ['apple'], '🔇': ['volume-x']
  };

  var RE = new RegExp('(' + Object.keys(MAP).sort(function (a, b) { return b.length - a.length; })
    .map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\uFE0F?', 'g');
  var NS = 'http://www.w3.org/2000/svg';
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, TITLE: 1, NOSCRIPT: 1, CANVAS: 1, INPUT: 1 };

  function symbolId(name) { return 'ap-i-' + name; }

  function injectSprite() {
    if (document.getElementById('apSprite')) return;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'apSprite'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = Object.keys(P).map(function (n) {
      return '<symbol id="' + symbolId(n) + '" viewBox="0 0 24 24">' + P[n] + '</symbol>';
    }).join('');
    document.body.insertBefore(svg, document.body.firstChild);
  }

  function makeIcon(key) {
    var m = MAP[key]; if (!m) return null;
    var el = document.createElementNS(NS, 'svg');
    el.setAttribute('class', 'ic' + (m[1] ? ' ic-fill' : ''));
    el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('aria-hidden', 'true'); el.setAttribute('focusable', 'false');
    el.setAttribute('data-ic', m[0]);
    var use = document.createElementNS(NS, 'use'); use.setAttribute('href', '#' + symbolId(m[0]));
    el.appendChild(use);
    return el;
  }

  function eligible(node) {
    var p = node.parentNode;
    if (!p || p.nodeType !== 1) return false;
    if (SKIP[p.nodeName] || p.namespaceURI === NS || p.closest && p.closest('svg,[data-no-icons],[contenteditable=true]')) return false;
    return true;
  }

  function convertText(node) {
    var text = node.nodeValue;
    if (!text || !eligible(node)) return;
    RE.lastIndex = 0;
    if (!RE.test(text)) return;
    RE.lastIndex = 0;
    var frag = document.createDocumentFragment(), last = 0, m;
    while ((m = RE.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var icon = makeIcon(m[1]);
      frag.appendChild(icon || document.createTextNode(m[0]));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function convertTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { convertText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName] || root.namespaceURI === NS) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), batch = [], n;
    while ((n = walker.nextNode())) batch.push(n);
    batch.forEach(convertText);
  }

  var observer = null, queue = new Set(), scheduled = false;
  function flush() {
    scheduled = false;
    if (observer) observer.disconnect();
    try { queue.forEach(function (n) { if (n.isConnected !== false) convertTree(n); }); } catch (e) {}
    queue.clear();
    if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  function schedule() {
    if (scheduled) return; scheduled = true;
    (window.requestAnimationFrame || setTimeout)(flush);
  }
  function startObserver() {
    if (!window.MutationObserver) return;
    observer = new MutationObserver(function (records) {
      records.forEach(function (r) {
        if (r.type === 'characterData') queue.add(r.target);
        else r.addedNodes.forEach(function (n) { if (n.nodeType === 1 || n.nodeType === 3) queue.add(n); });
      });
      if (queue.size) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* برای رسم روی کانواس (کارت اشتراک): تصویر آیکون با رنگ دلخواه */
  function iconSvgString(key, color, size) {
    var m = MAP[key]; if (!m) return '';
    return '<svg xmlns="' + NS + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (m[1] ? color : 'none') +
      '" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + P[m[0]].replace(/currentColor/g, color) + '</svg>';
  }
  function iconImage(key, color, size) {
    key = String(key || '').replace(/️/g, '');
    return new Promise(function (resolve) {
      var s = iconSvgString(key, color || '#f5c518', size || 64);
      if (!s) { resolve(null); return; }
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }

  window.ArcadeIcons = { convert: convertTree, image: iconImage, has: function (k) { return !!MAP[String(k || '').replace(/️/g, '')]; }, paths: P };

  /* ───────── ذخیرهٔ فایل در مرورگرهای داخلی ─────────
     در WebView برنامه‌هایی مثل ایتا و تلگرام، دانلود blob/data با <a download> کار نمی‌کند.
     در این محیط‌ها به‌جای دانلود بی‌اثر، برگهٔ «ذخیره» با چند راه جایگزین نمایش داده می‌شود. */
  var UA = navigator.userAgent || '';
  function inApp() {
    if (/Telegram|Eitaa|Eita|Bale|Rubika|Soroush|iGap|Instagram|FBAN|FBAV|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|; wv\)|WebView/i.test(UA)) return true;
    if (/(iPhone|iPad|iPod)/.test(UA) && !/Safari\//.test(UA)) return true;
    try { if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) return true; } catch (e) {}
    return false;
  }

  function dataUrlToBlob(url) {
    try {
      var parts = url.split(','), mime = (parts[0].match(/:(.*?);/) || [])[1] || 'application/octet-stream', bin = atob(parts[1]), len = bin.length, arr = new Uint8Array(len);
      for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (e) { return null; }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(text, icon) { try { if (window.__arcadeToast) window.__arcadeToast(text, icon || '✓'); } catch (e) {} }
  function icoBtn(name, label, attrs) {
    return '<button type="button" class="ap-btn" ' + (attrs || '') + '><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + symbolId(name) + '"/></svg><span>' + label + '</span></button>';
  }

  var sheetUrls = [];
  function releaseUrls() { sheetUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} }); sheetUrls = []; }

  function openSheet(opts) {
    /* opts: { name, mime, blob, dataUrl, text } */
    injectSprite();
    var blob = opts.blob || (opts.dataUrl ? dataUrlToBlob(opts.dataUrl) : null);
    var isImage = /^image\//.test(opts.mime || (blob && blob.type) || '');
    var file = null;
    try { if (blob && typeof File === 'function') file = new File([blob], opts.name, { type: blob.type || opts.mime }); } catch (e) {}
    var blobUrl = ''; try { if (blob) { blobUrl = URL.createObjectURL(blob); sheetUrls.push(blobUrl); } } catch (e) {}
    var canShareFile = false; try { canShareFile = !!(file && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
    var canCopyImg = !!(isImage && navigator.clipboard && window.ClipboardItem && blob);

    var old = document.getElementById('apSaveSheet'); if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'about-modal ap-sheet'; el.id = 'apSaveSheet';
    var preview = isImage
      ? '<img class="ap-img" alt="پیش‌نمایش تصویر" src="' + (opts.dataUrl || blobUrl) + '">'
      : '<textarea class="ap-text" readonly dir="ltr" spellcheck="false" aria-label="محتوای فایل">' + esc(opts.text || '') + '</textarea>';
    var steps = isImage
      ? '<li>انگشتت را روی تصویر نگه دار و گزینهٔ «ذخیره تصویر» را بزن.</li><li>اگر منو نیامد، از صفحه اسکرین‌شات بگیر؛ تصویر کامل و با کیفیت است.</li>'
      : '<li>متن را با «کپی» بردار و در یادداشت یا «پیام‌های ذخیره‌شده» نگه دار.</li><li>برای بازیابی، فایل را در مرورگر معمولی (کروم یا سافاری) ذخیره کن.</li>';
    el.innerHTML = '<div class="about-backdrop"></div><div class="about-card lg-glass au-modal ap-card" role="dialog" aria-modal="true" aria-labelledby="apSheetTitle" tabindex="-1">' +
      '<button class="about-close" type="button" data-ap-close data-initial-focus aria-label="بستن"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + symbolId('x') + '"/></svg></button>' +
      '<h2 id="apSheetTitle"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + symbolId('download') + '"/></svg> ' + (isImage ? 'ذخیرهٔ تصویر' : 'ذخیرهٔ فایل') + '</h2>' +
      '<p class="ap-note"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + symbolId('info') + '"/></svg><span>مرورگر داخلی این برنامه دانلود مستقیم فایل را پشتیبانی نمی‌کند. با یکی از راه‌های زیر ذخیره کن:</span></p>' +
      preview +
      '<div class="ap-actions">' +
      (canShareFile ? icoBtn('share', 'اشتراک‌گذاری / ذخیره', 'data-ap="share"') : '') +
      (canCopyImg ? icoBtn('copy', 'کپی تصویر', 'data-ap="copyimg"') : '') +
      (!isImage ? icoBtn('copy', 'کپی متن', 'data-ap="copytext"') : '') +
      (blobUrl ? icoBtn('external', 'باز کردن در تب جدید', 'data-ap="open"') : '') +
      '</div><ul class="ap-steps">' + steps + '</ul></div>';
    document.body.appendChild(el);

    function close() {
      if (window.__arcadeModal && window.__arcadeModal.closeModal) { try { window.__arcadeModal.closeModal('apSaveSheet'); } catch (e) { el.classList.remove('show'); } }
      else el.classList.remove('show');
      setTimeout(function () { el.remove(); releaseUrls(); }, 250);
    }
    el.querySelector('[data-ap-close]').onclick = close;
    el.querySelector('.about-backdrop').onclick = close;
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    el.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-ap]'); if (!b) return;
      var act = b.getAttribute('data-ap');
      try {
        if (act === 'share') await navigator.share({ files: [file], title: opts.name });
        else if (act === 'copyimg') { await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]); toast('تصویر کپی شد؛ در چت پیست کن.', '📋'); }
        else if (act === 'copytext') {
          var ta = el.querySelector('.ap-text'); ta.focus(); ta.select();
          if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(opts.text || ta.value); else document.execCommand('copy');
          toast('متن کپی شد.', '📋');
        } else if (act === 'open') window.open(blobUrl, '_blank');
      } catch (err) { if (!err || err.name !== 'AbortError') toast('این روش در این مرورگر کار نکرد؛ روش بعدی را امتحان کن.', '⚠️'); }
    });

    if (window.__arcadeModal && window.__arcadeModal.showModal) window.__arcadeModal.showModal('apSaveSheet');
    else el.classList.add('show');
    convertTree(el);
    return el;
  }

  window.ArcadeSave = {
    needsFallback: inApp,
    sheet: openSheet,
    /* ذخیره با روش عادی؛ در مرورگر داخلی، برگهٔ جایگزین. */
    save: function (opts) {
      if (inApp()) { openSheet(opts); return 'sheet'; }
      try {
        var blob = opts.blob || dataUrlToBlob(opts.dataUrl), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = opts.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        return 'native';
      } catch (e) { openSheet(opts); return 'sheet'; }
    }
  };

  /* دکمهٔ دانلود کارت: در WebView به‌جای <a download> برگهٔ ذخیره باز می‌شود. در همهٔ مرورگرها لینک «دانلود نشد؟» هم اضافه می‌شود. */
  function shareName() {
    var t = (document.getElementById('shareTitle') || {}).textContent || '';
    return /مسابقه/.test(t) ? 'arcade-tournament.png' : /رکورد/.test(t) ? 'arcade-record.png' : 'arcade-profile.png';
  }
  function currentCard() {
    var img = document.querySelector('#shareContent .share-preview');
    return img ? { dataUrl: img.src, name: img.width === 1080 && img.naturalHeight === 1190 ? 'arcade-showcase.png' : shareName(), mime: 'image/png' } : null;
  }
  document.addEventListener('click', function (e) {
    var dl = e.target.closest && e.target.closest('#downloadShare');
    if (dl && inApp()) {
      var card = currentCard(); if (!card) return;
      e.preventDefault(); e.stopImmediatePropagation(); openSheet(card); return;
    }
    var alt = e.target.closest && e.target.closest('[data-ap-alt]');
    if (alt) { var c = currentCard(); if (c) openSheet(c); }
  }, true);

  function decorateShare() {
    var actions = document.querySelector('#shareContent .share-actions');
    if (!actions || (actions.nextElementSibling && actions.nextElementSibling.hasAttribute('data-ap-alt'))) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ap-alt'; b.setAttribute('data-ap-alt', '1');
    b.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + symbolId('info') + '"/></svg><span>دانلود نشد؟ روش‌های دیگر ذخیره</span>';
    actions.insertAdjacentElement('afterend', b);
  }
  function watchShare() {
    var box = document.getElementById('shareContent'); if (!box || !window.MutationObserver) return;
    new MutationObserver(decorateShare).observe(box, { childList: true });
    decorateShare();
  }

  function init() {
    injectSprite(); convertTree(document.body); startObserver(); watchShare();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
