// Single source of truth for turning a destId slug into something a person
// reads, and for populating destination pickers. There's no reliable public
// "list destinations" endpoint yet (the backend serves them from seed files,
// not a queryable collection), so this mirrors that seed data here rather
// than guessing at display names per-page.
export const DESTINATION_GROUPS = [
  {
    state: 'Himachal Pradesh',
    destinations: [
      { id: 'manali', label: 'Manali' },
      { id: 'shimla', label: 'Shimla' },
      { id: 'kasauli', label: 'Kasauli' },
      { id: 'dalhousie', label: 'Dalhousie' },
      { id: 'khajjiar', label: 'Khajjiar' },
      { id: 'dharamshala', label: 'Dharamshala' },
      { id: 'mcleodganj', label: 'McLeod Ganj' },
      { id: 'kasol', label: 'Kasol' },
      { id: 'tosh', label: 'Tosh' },
      { id: 'jibhi', label: 'Jibhi' },
      { id: 'tirthan-valley', label: 'Tirthan Valley' },
      { id: 'bir-billing', label: 'Bir Billing' },
      { id: 'palampur', label: 'Palampur' },
      { id: 'chail', label: 'Chail' },
      { id: 'kalpa', label: 'Kalpa, Kinnaur' },
      { id: 'chhitkul', label: 'Chhitkul, Kinnaur' },
      { id: 'naggar', label: 'Naggar' },
      { id: 'solan', label: 'Solan' },
      { id: 'spiti-kaza', label: 'Kaza, Spiti Valley' },
      { id: 'mandi', label: 'Mandi' },
    ],
  },
  {
    state: 'Telangana',
    destinations: [
      { id: 'yadapalli-yadadri', label: 'Yadadri, Bhuvanagiri' },
      { id: 'ramappa-temple', label: 'Ramappa Temple, Mulugu' },
      { id: 'thousand-pillar-temple', label: 'Thousand Pillar Temple, Hanamkonda' },
      { id: 'warangal-fort', label: 'Warangal Fort' },
      { id: 'bhadrachalam', label: 'Bhadrachalam' },
      { id: 'charminar-hyderabad', label: 'Charminar, Hyderabad' },
      { id: 'golconda-hyderabad', label: 'Golconda Fort, Hyderabad' },
      { id: 'hussain-sagar-hyderabad', label: 'Hussain Sagar, Hyderabad' },
      { id: 'nagarjuna-sagar', label: 'Nagarjuna Sagar, Nalgonda' },
      { id: 'medak-church', label: 'Medak Cathedral' },
      { id: 'alampur-jogulamba', label: 'Alampur, Jogulamba Gadwal' },
      { id: 'ananthagiri-hills', label: 'Ananthagiri Hills, Vikarabad' },
      { id: 'bogatha-waterfalls', label: 'Bogatha Waterfalls' },
      { id: 'kondagattu', label: 'Kondagattu, Jagtial' },
      { id: 'kuntala-waterfalls', label: 'Kuntala Waterfalls, Adilabad' },
      { id: 'laknavaram-lake', label: 'Laknavaram Lake, Mulugu' },
    ],
  },
]

const LOOKUP = new Map(
  DESTINATION_GROUPS.flatMap((g) => g.destinations.map((d) => [d.id, d.label]))
)

// "tirthan-valley" -> "Tirthan Valley" as a last resort for anything not in
// the table above (a new seed destination, a typo'd id, etc.) so the UI never
// shows a raw slug even in that case.
function humanizeSlug(id) {
  return String(id || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function getDestinationLabel(destId) {
  if (!destId) return 'Unknown destination'
  return LOOKUP.get(destId) || humanizeSlug(destId)
}
