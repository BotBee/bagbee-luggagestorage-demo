// Display-label mapping for partner-portal service types.
//
// The internal value stored in Airtable (and used in all conditional
// logic — see e.g. `isLocalTransfer`, the Update OC notifications, the
// Pickup & Delivery vs Check-in delivery-window automation) stays as
// 'Pickup & Delivery' because that's the singleSelect option name in
// the Service Type column. But for the UI we render it as
// 'Luggage Transfer' — that's how tour-operator project managers talk
// about it ("transfer" is the industry-standard term for hotel/airport
// movements, used throughout cruise + tour contracts and pairing
// naturally with Atlantik's named-route transfer tiers).
//
// To rename the value itself would mean a destructive migration of
// every existing order, every Airtable automation, and dozens of
// `=== 'Pickup & Delivery'` checks across the codebase. A display-
// label indirection gives us the customer-facing wording change with
// zero downstream risk.

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  'Pickup & Delivery': 'Luggage Transfer',
  // Other service types render verbatim — see serviceTypeLabel below.
}

export const serviceTypeLabel = (value: string | null | undefined): string => {
  if (!value) return ''
  return SERVICE_TYPE_LABELS[value] ?? value
}
