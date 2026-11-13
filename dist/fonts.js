"use strict";
// Web fonts, linked from script so a slow or offline network never holds up the first paint.
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:opsz,wght@14..32,400..700'
    + '&family=IBM+Plex+Mono:wght@400;500&family=Cormorant+Garamond:ital,wght@1,500&display=swap';
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = FONTS;
document.head.append(link);
