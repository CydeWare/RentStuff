/**
 * Supported locations for the MVP. Jakarta and its surrounding areas (Jabodetabek)
 * are covered in detail; a few other large Indonesian cities are included so the
 * structure can grow. This is the single source of truth: the client fetches it
 * from GET /api/meta/locations.
 */
export interface CityInfo {
  name: string;
  districts: string[];
}
export interface ProvinceInfo {
  name: string;
  cities: CityInfo[];
}

export const LOCATIONS: ProvinceInfo[] = [
  {
    name: 'DKI Jakarta',
    cities: [
      { name: 'Jakarta Selatan', districts: ['Kebayoran Baru', 'Kebayoran Lama', 'Cilandak', 'Pasar Minggu', 'Mampang Prapatan', 'Tebet', 'Setiabudi', 'Pancoran', 'Jagakarsa', 'Pesanggrahan'] },
      { name: 'Jakarta Pusat', districts: ['Menteng', 'Tanah Abang', 'Gambir', 'Senen', 'Cempaka Putih', 'Kemayoran', 'Sawah Besar', 'Johar Baru'] },
      { name: 'Jakarta Barat', districts: ['Kebon Jeruk', 'Grogol Petamburan', 'Palmerah', 'Kembangan', 'Cengkareng', 'Taman Sari', 'Tambora', 'Kalideres'] },
      { name: 'Jakarta Timur', districts: ['Jatinegara', 'Duren Sawit', 'Cakung', 'Pulo Gadung', 'Matraman', 'Kramat Jati', 'Makasar', 'Cipayung'] },
      { name: 'Jakarta Utara', districts: ['Kelapa Gading', 'Penjaringan', 'Tanjung Priok', 'Pademangan', 'Koja', 'Cilincing'] },
    ],
  },
  {
    name: 'Jawa Barat',
    cities: [
      { name: 'Depok', districts: ['Beji', 'Margonda', 'Sukmajaya', 'Cimanggis', 'Pancoran Mas', 'Cinere'] },
      { name: 'Bekasi', districts: ['Bekasi Selatan', 'Bekasi Barat', 'Bekasi Timur', 'Jatiasih', 'Rawalumbu', 'Summarecon Bekasi'] },
      { name: 'Bogor', districts: ['Bogor Tengah', 'Bogor Utara', 'Bogor Selatan', 'Tanah Sareal', 'Bogor Barat'] },
      { name: 'Bandung', districts: ['Coblong', 'Dago', 'Sukajadi', 'Lengkong', 'Buahbatu', 'Cicendo'] },
    ],
  },
  {
    name: 'Banten',
    cities: [
      { name: 'Tangerang', districts: ['Karawaci', 'Cipondoh', 'Ciledug', 'Tangerang Kota', 'Pinang'] },
      { name: 'Tangerang Selatan', districts: ['BSD', 'Serpong', 'Pondok Aren', 'Ciputat', 'Bintaro', 'Pamulang'] },
    ],
  },
  {
    name: 'Jawa Timur',
    cities: [{ name: 'Surabaya', districts: ['Gubeng', 'Wonokromo', 'Tegalsari', 'Rungkut', 'Sukolilo'] }],
  },
  {
    name: 'Bali',
    cities: [{ name: 'Denpasar', districts: ['Denpasar Selatan', 'Denpasar Barat', 'Denpasar Timur', 'Denpasar Utara'] }],
  },
  {
    name: 'DI Yogyakarta',
    cities: [{ name: 'Yogyakarta', districts: ['Gondokusuman', 'Jetis', 'Kraton', 'Mergangsan', 'Umbulharjo'] }],
  },
];

export const ALL_CITIES = LOCATIONS.flatMap((p) => p.cities.map((c) => c.name));

export function provinceForCity(city: string): string | undefined {
  return LOCATIONS.find((p) => p.cities.some((c) => c.name === city))?.name;
}
