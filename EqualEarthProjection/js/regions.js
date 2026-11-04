// Region data for the map. Country names match the world-atlas data
// (https://github.com/topojson/world-atlas), except for Russia, which app.js
// splits at the Urals into "European Russia" and "Asian Russia".

// Russia's split line (longitude of the Urals). West of it is European Russia.
const RUSSIA_SPLIT_LON = 60;

// Turkey, the Caucasus and Cyprus count as Asia.
const CONTINENTS = {
  "Africa": ["Tanzania", "W. Sahara", "Dem. Rep. Congo", "Somalia", "Kenya", "Sudan", "Chad", "South Africa", "Lesotho", "Zimbabwe", "Botswana", "Namibia", "Senegal", "Mali", "Mauritania", "Benin", "Niger", "Nigeria", "Cameroon", "Togo", "Ghana", "Côte d'Ivoire", "Guinea", "Guinea-Bissau", "Liberia", "Sierra Leone", "Burkina Faso", "Central African Rep.", "Congo", "Gabon", "Eq. Guinea", "Zambia", "Malawi", "Mozambique", "eSwatini", "Angola", "Burundi", "Madagascar", "Gambia", "Tunisia", "Algeria", "Eritrea", "Morocco", "Egypt", "Libya", "Ethiopia", "Djibouti", "Somaliland", "Uganda", "Rwanda", "S. Sudan"],
  "Asia": ["Asian Russia", "Kazakhstan", "Uzbekistan", "Indonesia", "Timor-Leste", "Israel", "Lebanon", "Palestine", "Jordan", "United Arab Emirates", "Qatar", "Kuwait", "Iraq", "Oman", "Cambodia", "Thailand", "Laos", "Myanmar", "Vietnam", "North Korea", "South Korea", "Mongolia", "India", "Bangladesh", "Bhutan", "Nepal", "Pakistan", "Afghanistan", "Tajikistan", "Kyrgyzstan", "Turkmenistan", "Iran", "Syria", "Armenia", "Turkey", "Sri Lanka", "China", "Taiwan", "Azerbaijan", "Georgia", "Philippines", "Malaysia", "Brunei", "Japan", "Yemen", "Saudi Arabia", "N. Cyprus", "Cyprus"],
  "Europe": ["European Russia", "Norway", "France", "Sweden", "Belarus", "Ukraine", "Poland", "Austria", "Hungary", "Moldova", "Romania", "Lithuania", "Latvia", "Estonia", "Germany", "Bulgaria", "Greece", "Albania", "Croatia", "Switzerland", "Luxembourg", "Belgium", "Netherlands", "Portugal", "Spain", "Ireland", "Italy", "Denmark", "United Kingdom", "Iceland", "Slovenia", "Finland", "Slovakia", "Czechia", "Bosnia and Herz.", "Macedonia", "Serbia", "Montenegro", "Kosovo"],
  "North America": ["Canada", "United States of America", "Haiti", "Dominican Rep.", "Bahamas", "Greenland", "Mexico", "Panama", "Costa Rica", "Nicaragua", "Honduras", "El Salvador", "Guatemala", "Belize", "Puerto Rico", "Jamaica", "Cuba", "Trinidad and Tobago"],
  "South America": ["Argentina", "Chile", "Falkland Is.", "Uruguay", "Brazil", "Bolivia", "Peru", "Colombia", "Venezuela", "Guyana", "Suriname", "Ecuador", "Paraguay"],
  "Oceania": ["Fiji", "Papua New Guinea", "Vanuatu", "New Caledonia", "Solomon Is.", "New Zealand", "Australia"]
};

// Selections made of several map shapes that aren't continents.
const GROUPS = {
  "Russia": ["European Russia", "Asian Russia"]
};

// Every shape that can be clicked or picked on its own (Antarctica is left out).
const COUNTRIES = Object.values(CONTINENTS).flat();

// Dropdown options: continents first, then countries A–Z.
const COUNTRY_OPTIONS = [...COUNTRIES, ...Object.keys(GROUPS)]
  .sort((a, b) => a.localeCompare(b));
const ALL_OPTIONS = [...Object.keys(CONTINENTS), ...COUNTRY_OPTIONS];

const DEFAULTS = { a: "Greenland", b: "Africa" };
