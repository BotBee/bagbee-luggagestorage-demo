// User-facing strings. **Needs native-speaker review before launch** — the Icelandic below
// is Claude-authored and may have register or declension issues.

export type Locale = 'is' | 'en'

export const strings: Record<Locale, Record<string, string>> = {
  is: {
    launcher_aria: 'Opna spjall',
    header_title: 'BagBee aðstoð',
    header_subtitle: 'Venjulega svörum við innan nokkurra mínútna',
    greeting:
      'Hæ! Ég er BagBee aðstoðin. Ég get flett upp pöntunum, breytt bókunum og svarað spurningum. Hvernig get ég hjálpað?',
    input_placeholder: 'Skrifaðu skilaboð…',
    send_aria: 'Senda',
    minimise_aria: 'Minnka',
    close_aria: 'Loka',
    error_network: 'Eitthvað fór úrskeiðis. Reynið aftur eftir smá stund.',
    offline_notice: 'Spjallið er tímabundið úr sambandi. Sendu póst á bagbee@bagbee.is.',
    typing: 'BagBee skrifar…',
    language_toggle: 'EN',
  },
  en: {
    launcher_aria: 'Open chat',
    header_title: 'BagBee support',
    header_subtitle: 'We usually reply within a few minutes',
    greeting:
      "Hi! I'm the BagBee assistant. I can look up orders, make booking changes and answer questions. How can I help?",
    input_placeholder: 'Type a message…',
    send_aria: 'Send',
    minimise_aria: 'Minimise',
    close_aria: 'Close',
    error_network: 'Something went wrong. Please try again in a moment.',
    offline_notice: "Chat is temporarily unavailable. Please email bagbee@bagbee.is.",
    typing: 'BagBee is typing…',
    language_toggle: 'IS',
  },
}
