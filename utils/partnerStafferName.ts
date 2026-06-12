// Derive a human-readable name for a partner-portal project manager from
// the email address attached to the order.
//
// Partners type their own email when booking, and the local part is
// usually a recognisable form of their name (ragna@atlantik.is → Ragna).
// But it's often the ASCII-fied lowercase version of an Icelandic name
// where the simple "capitalise first letter" rule renders the name
// wrong: `thorhildurr@icelandtravel.is` is Þórhildur, not "Thorhildurr".
//
// To get the proper rendering we maintain an explicit map of known
// partner emails → display names below. The list is built from each
// partner company's public team page; add to it as new PMs join.
//
// Resolution order in `stafferNameFromEmail`:
//   1. Exact-match lookup in STAFFER_NAME_OVERRIDES (this file).
//   2. Fallback: take the email's local part, strip trailing digits,
//      capitalise the first letter. Used when the email isn't in the map.

const STAFFER_NAME_OVERRIDES: Record<string, string> = {
  // ============== Atlantik ==============
  // Sourced from https://www.atlantik.is/meet-the-team/. Public roster
  // doesn't expose emails, so the addresses below are inferred from the
  // known patterns (first-name lowercase, first-name + last-initial when
  // there's a clash — same as sigrunb). Verified entries that have
  // appeared on real bookings are marked; inferred entries should be
  // double-checked the first time they show up on the dashboard.

  // Verified
  'ragna@atlantik.is': 'Ragna',
  'tarif@atlantik.is': 'Tarif',
  'sigrunb@atlantik.is': 'Sigrún B',

  // Inferred — first name with Icelandic accents. The fallback
  // capitalisation rule would render these without the accents (e.g.
  // "Gudrun" instead of "Guðrún"), so an override gets us the proper
  // form even before we see their first booking.
  'bryndis@atlantik.is': 'Bryndís',
  'gudlaug@atlantik.is': 'Guðlaug',
  'gudrun@atlantik.is': 'Guðrún',
  'maria@atlantik.is': 'María',
  'odinn@atlantik.is': 'Óðinn',
  'sigurdur@atlantik.is': 'Sigurður',
  'saerun@atlantik.is': 'Særún',
  'tomas@atlantik.is': 'Tómas',
  'thorhallur@atlantik.is': 'Þórhallur',

  // Inferred — ASCII first names. Override kept anyway so they're
  // documented as known Atlantik staff and the renderer skips its
  // fallback path (microscopically faster, but mostly for
  // completeness).
  'gunnar@atlantik.is': 'Gunnar',
  'hjalti@atlantik.is': 'Hjalti',
  'susanna@atlantik.is': 'Súsanna',
  'alex@atlantik.is': 'Alex',
  'anna@atlantik.is': 'Anna B',
  'birgir@atlantik.is': 'Birgir',
  'bjartur@atlantik.is': 'Bjartur',
  'dana@atlantik.is': 'Dana',
  'erna@atlantik.is': 'Erna',
  'galyna@atlantik.is': 'Galyna',
  'gunnars@atlantik.is': 'Gunnar Steinn',
  'haukur@atlantik.is': 'Haukur',
  'helga@atlantik.is': 'Helga',
  'helgam@atlantik.is': 'Helga Margrét',
  'hlynur@atlantik.is': 'Hlynur',
  'hulda@atlantik.is': 'Hulda',
  'jennifer@atlantik.is': 'Jennifer',
  'justyna@atlantik.is': 'Justyna',
  'kristinn@atlantik.is': 'Kristinn',
  'linda@atlantik.is': 'Linda',
  'mikael@atlantik.is': 'Mikael',
  'nina@atlantik.is': 'Nina',
  'oksana@atlantik.is': 'Oksana',
  'patrizia@atlantik.is': 'Patrizia',
  'raisely@atlantik.is': 'Raisely',
  'viktor@atlantik.is': 'Viktor',

  // ============== Iceland Travel ==============
  // Sourced from https://www.icelandtravel.is/about-iceland-travel/our-team
  // Names use the first-name-only convention by default (matches the
  // "Þórhildur" guidance — disambiguate by surname initial only when the
  // user explicitly requests it, e.g. "Sigrún B"). Where two people share
  // the same first name across the org (e.g. three Þórdís) the email
  // disambiguates visually since it's shown beneath the name in the
  // dashboard cell.

  // Sales
  'gulli@icelandtravel.is': 'Gulli',
  'thuridur@icelandtravel.is': 'Þuríður',
  'ingibjorg@icelandtravel.is': 'Ingibjörg',
  'margretb@icelandtravel.is': 'Margrét',
  'inga@icelandtravel.is': 'Inga',
  'arnaor@icelandtravel.is': 'Arna',
  'thordis@icelandtravel.is': 'Þórdís',
  'johanna@icelandtravel.is': 'Jóhanna',
  'kaori@icelandtravel.is': 'Kaori',
  'marinabo@icelandtravel.is': 'Marina',
  'erlagu@icelandtravel.is': 'Erla',
  'thordiso@icelandtravel.is': 'Þórdís',

  // Leisure Group Operations & Guide Team
  'anna@icelandtravel.is': 'Anna',
  'thorhildurr@icelandtravel.is': 'Þórhildur',
  'haruno@icelandtravel.is': 'Haruno',
  'anastasia@icelandtravel.is': 'Anastasía',
  'rikka@icelandtravel.is': 'Rikka',
  'monika.r@icelandtravel.is': 'Monika',
  'nikola.k@icelandtravel.is': 'Nikola',
  'gratiela@icelandtravel.is': 'Gratiela',

  // FIT Reservations
  'ingunngr@icelandtravel.is': 'Ingunn',
  'irinag@icelandtravel.is': 'Irina',
  'leab@icelandtravel.is': 'Léa',

  // Incentives & Luxury (mixed icelandtravel.is + nineworlds.is)
  'inessa@icelandtravel.is': 'Inessa',
  'sandrast@icelandtravel.is': 'Sandra Rós',
  'audurs@nineworlds.is': 'Auður',
  'elisas@nineworlds.is': 'Elísa',
  'pepe@icelandtravel.is': 'Pepe',
  'denisa@nineworlds.is': 'Denisa',
  'thordis.j@nineworlds.is': 'Þórdís',
  'marina@icelandtravel.is': 'Marina',
  'sandra.yr@icelandtravel.is': 'Sandra Ýr',
  'karolina.k@icelandtravel.is': 'Karólína',

  // Business Development
  'helgithor@icelandtravel.is': 'Helgi Þór',
  'rsylvia@icelandtravel.is': 'Sylvía',
  'thorunnl@icelandtravel.is': 'Þórunn',
  'otilia@icelandtravel.is': 'Otilia',

  // 24/7 Service Center
  'alexandra.h@icelandtravel.is': 'Alexandra',
  'diogo@icelandtravel.is': 'Diogo',
  'theodoros@icelandtravel.is': 'Theodoros',
  'kehinde@icelandtravel.is': 'Kehinde',
  'trisha@icelandtravel.is': 'Trisha',

  // Executive Leadership
  'helgi@icelandtravel.is': 'Helgi',

  // ============== Iceland Travel — Cruise Services ==============
  // Sourced from the Cruise Services team list (Emma Kjartansdóttir's
  // org). These are the partner-portal users we're most likely to see
  // book, since cruise turnarounds are the bulk of what the IT/Atlantik
  // bag-transfer side actually moves.

  // Executive Leadership — Cruise
  'emma@icelandtravel.is': 'Emma',

  // Cruise Sales
  'bergnyv@icelandtravel.is': 'Bergný',
  'hebath@icelandtravel.is': 'Heba',
  'salkarun@icelandtravel.is': 'Salka Rún',

  // Shore Excursions & Turnarounds
  'ingunni@icelandtravel.is': 'Ingunn',
  'andreag@icelandtravel.is': 'Andrea',
  'christel@icelandtravel.is': 'Christel',
  'dani@icelandtravel.is': 'Dani',
  'ingibjorg.magna@icelandtravel.is': 'Ingibjörg Magna',
  'jessica.h@icelandtravel.is': 'Jessica',
  'juliana@icelandtravel.is': 'Juliana',
  'ksvava@icelandtravel.is': 'Kristjana Svava',
  'kolbrun@icelandtravel.is': 'Kolbrún',
  'marija@icelandtravel.is': 'Marija',
  'savannah@icelandtravel.is': 'Savannah',
  'solveigth@icelandtravel.is': 'Sólveig',
  'vilhjalmur@icelandtravel.is': 'Vilhjálmur',
  'asdiseva@icelandtravel.is': 'Ásdís Eva',
  'zofia@icelandtravel.is': 'Zofia',

  // Expeditions
  'hildurkr@icelandtravel.is': 'Hildur',
  'arnar.g@icelandtravel.is': 'Arnar',
  'daniel@icelandtravel.is': 'Daniel',
  'hana@icelandtravel.is': 'Hana',
  'helena@icelandtravel.is': 'Helena',
  'hera.lif@icelandtravel.is': 'Hera Líf',
  'manuel@icelandtravel.is': 'Manuel',
  'maudgl@icelandtravel.is': 'Maud',
  'nikolett@icelandtravel.is': 'Nikolett',
  'roberts@icelandtravel.is': 'Robert',
  'skulih@icelandtravel.is': 'Skúli',

  // Akureyri Operations
  'evahjaltalin@icelandtravel.is': 'Eva',
  'bailey@icelandtravel.is': 'Bailey',
  'eduarda@icelandtravel.is': 'Eduarda',
  'cynthia@icelandtravel.is': 'Cynthia',
}

export const stafferNameFromEmail = (
  email: string | null | undefined,
): string | null => {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return null
  if (STAFFER_NAME_OVERRIDES[trimmed]) return STAFFER_NAME_OVERRIDES[trimmed]
  const local = trimmed.split('@')[0]
  if (!local) return null
  // Strip trailing digits — handles "ragna2@" cases without forcing an
  // override entry. Keep digits in the middle alone (rare but valid).
  const cleaned = local.replace(/\d+$/g, '')
  if (!cleaned) return null
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
