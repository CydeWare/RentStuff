/**
 * Demo data for local development. WARNING: wipes all existing data first.
 * Prices are fictional and for development only.
 *
 * Demo accounts (password for all: Rentora123):
 *   budi@rentora.test   - regular user (renter + owner)
 *   siti@rentora.test   - regular user (owner with several listings)
 *   admin@rentora.test  - administrator
 */
import { PrismaClient, type BookingStatus, type ItemCondition, type PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculatePrice } from '../src/utils/pricing.js';
import { addDays, todayInMarket } from '../src/utils/dates.js';
import { provinceForCity } from '../src/config/locations.js';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Rentora123';

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const categories = [
  { slug: 'electronics', name: 'Electronics', icon: 'Laptop', description: 'Laptops, cameras, monitors, projectors and more' },
  { slug: 'travel-outdoor', name: 'Travel & Outdoor', icon: 'Tent', description: 'Backpacks, suitcases, tents and camping gear' },
  { slug: 'household', name: 'Household', icon: 'Sofa', description: 'Vacuum cleaners, kitchen appliances and cleaning equipment' },
  { slug: 'tools', name: 'Tools', icon: 'Wrench', description: 'Drills, toolkits, ladders and DIY equipment' },
  { slug: 'events', name: 'Events', icon: 'PartyPopper', description: 'Speakers, lighting, cameras and decorations' },
  { slug: 'sports', name: 'Sports', icon: 'Bike', description: 'Bicycles, rackets, fitness and team sports gear' },
  { slug: 'other', name: 'Other', icon: 'Package', description: 'Musical instruments, office equipment and everything else' },
];

const users = [
  { key: 'admin', name: 'Admin Rentora', email: 'admin@rentora.test', phone: '081200000001', city: 'Jakarta Pusat', district: 'Menteng', role: 'ADMIN' as const },
  { key: 'budi', name: 'Budi Santoso', email: 'budi@rentora.test', phone: '081234567801', city: 'Jakarta Selatan', district: 'Tebet', bio: 'Product designer who loves photography and weekend camping trips.' },
  { key: 'siti', name: 'Siti Rahayu', email: 'siti@rentora.test', phone: '081234567802', city: 'Jakarta Selatan', district: 'Kebayoran Baru', bio: 'Videographer. I rent out my camera gear when I am not on a shoot.' },
  { key: 'andi', name: 'Andi Wijaya', email: 'andi@rentora.test', phone: '081234567803', city: 'Jakarta Barat', district: 'Kebon Jeruk', bio: 'Software engineer with a few spare gadgets.' },
  { key: 'dewi', name: 'Dewi Lestari', email: 'dewi@rentora.test', phone: '081234567804', city: 'Tangerang Selatan', district: 'BSD', bio: 'Event organizer. Speakers, lights and decorations available.' },
  { key: 'rizky', name: 'Rizky Pratama', email: 'rizky@rentora.test', phone: '081234567805', city: 'Depok', district: 'Margonda', bio: 'Outdoor enthusiast. Ask me about camping spots around Bogor!' },
  { key: 'putri', name: 'Putri Maharani', email: 'putri@rentora.test', phone: '081234567806', city: 'Jakarta Timur', district: 'Duren Sawit' },
  { key: 'agus', name: 'Agus Setiawan', email: 'agus@rentora.test', phone: '081234567807', city: 'Bekasi', district: 'Bekasi Selatan', bio: 'Contractor. Tools are well maintained and ready to use.' },
  { key: 'nadia', name: 'Nadia Kusuma', email: 'nadia@rentora.test', phone: '081234567808', city: 'Jakarta Utara', district: 'Kelapa Gading', bio: 'Fitness coach and weekend cyclist.' },
  { key: 'fajar', name: 'Fajar Hidayat', email: 'fajar@rentora.test', phone: '081234567809', city: 'Jakarta Pusat', district: 'Tanah Abang' },
  { key: 'maya', name: 'Maya Anggraini', email: 'maya@rentora.test', phone: '081234567810', city: 'Tangerang', district: 'Karawaci' },
];

interface SeedListing {
  key: string;
  owner: string;
  category: string;
  title: string;
  subcategory?: string;
  description: string;
  daily: number;
  weekly?: number;
  monthly?: number;
  deposit: number;
  condition: ItemCondition;
  city: string;
  district: string;
  address: string;
  delivery?: number; // delivery fee; undefined = no delivery
  pickup?: boolean;
  minDays?: number;
  maxDays?: number;
  images: string[];
  daysAgo: number;
  status?: 'ACTIVE' | 'PAUSED';
}

const listings: SeedListing[] = [
  { key: 'asus', owner: 'andi', category: 'electronics', subcategory: 'Laptops', title: 'ASUS VivoBook 14 Laptop', description: 'ASUS VivoBook 14 with Intel Core i5, 16 GB RAM and 512 GB SSD. Great for office work, online classes and light editing. Comes with charger and a padded sleeve. Windows 11 and Microsoft Office installed.', daily: 100_000, weekly: 600_000, monthly: 2_000_000, deposit: 1_000_000, condition: 'LIKE_NEW', city: 'Jakarta Barat', district: 'Kebon Jeruk', address: 'Pickup near Kebon Jeruk Mall lobby', delivery: 25_000, images: [img('1496181133206-80ce9b88a853'), img('1588872657578-7efd1f1555ed')], daysAgo: 40 },
  { key: 'macbook', owner: 'andi', category: 'electronics', subcategory: 'Laptops', title: 'MacBook Air M2 13"', description: 'Apple MacBook Air M2, 8-core CPU, 8 GB RAM, 256 GB SSD in Midnight. Perfect for presentations, travel and design work. Includes USB-C charger. Battery health 95%.', daily: 150_000, weekly: 900_000, monthly: 3_000_000, deposit: 2_000_000, condition: 'LIKE_NEW', city: 'Jakarta Barat', district: 'Kebon Jeruk', address: 'Pickup at Jl. Panjang area, Kebon Jeruk', delivery: 30_000, minDays: 2, images: [img('1541807084-5c52b6b3adef'), img('1611186871348-b1ce696e52c9'), img('1517336714731-489689fd1ca8')], daysAgo: 35 },
  { key: 'canon', owner: 'siti', category: 'electronics', subcategory: 'Cameras', title: 'Canon EOS 600D DSLR + 18-55mm Lens', description: 'Reliable Canon EOS DSLR with kit lens, 2 batteries, charger, 64 GB SD card and camera bag. Ideal for events, travel and learning photography. I can give a quick tutorial at pickup.', daily: 120_000, weekly: 700_000, deposit: 1_500_000, condition: 'GOOD', city: 'Jakarta Selatan', district: 'Kebayoran Baru', address: 'Pickup near Blok M Plaza', delivery: 20_000, images: [img('1502920917128-1aa500764cbd'), img('1520390138845-fd2d229dd553')], daysAgo: 60 },
  { key: 'sony', owner: 'siti', category: 'electronics', subcategory: 'Cameras', title: 'Sony Alpha Mirrorless Camera Kit', description: 'Sony mirrorless camera with two prime lenses (35mm and 50mm), 3 batteries and 128 GB card. Excellent autofocus for video and portraits. Gimbal available on request.', daily: 175_000, weekly: 1_050_000, deposit: 3_000_000, condition: 'LIKE_NEW', city: 'Jakarta Selatan', district: 'Kebayoran Baru', address: 'Pickup near Blok M Plaza', delivery: 20_000, minDays: 1, maxDays: 14, images: [img('1516035069371-29a1b244cc32')], daysAgo: 20 },
  { key: 'projector', owner: 'fajar', category: 'electronics', subcategory: 'Projectors', title: 'Full HD Projector 3500 Lumens', description: 'Bright Full HD projector for presentations, movie nights and small events. Includes HDMI cable, remote and a 100" portable screen. Works great in dim rooms.', daily: 75_000, weekly: 450_000, deposit: 750_000, condition: 'GOOD', city: 'Jakarta Pusat', district: 'Tanah Abang', address: 'Pickup at Thamrin City area', delivery: 25_000, images: [img('1626379953822-baec19c3accd'), img('1478720568477-152d9b164e26')], daysAgo: 25 },
  { key: 'monitor', owner: 'andi', category: 'electronics', subcategory: 'Monitors', title: '27" 4K IPS Monitor', description: '27-inch 4K IPS monitor with USB-C, HDMI and DisplayPort. Color accurate (99% sRGB), great for working from home or editing. Stand and cables included.', daily: 50_000, weekly: 300_000, monthly: 1_000_000, deposit: 800_000, condition: 'LIKE_NEW', city: 'Jakarta Barat', district: 'Kebon Jeruk', address: 'Pickup at Jl. Panjang area, Kebon Jeruk', delivery: 30_000, images: [img('1527443224154-c4a3942d3acf'), img('1593642632559-0c6d3fc62b89')], daysAgo: 15 },
  { key: 'ipad', owner: 'putri', category: 'electronics', subcategory: 'Tablets', title: 'iPad Pro 11" with Apple Pencil', description: 'iPad Pro 11-inch (Wi-Fi, 128 GB) with Apple Pencil 2nd gen and a keyboard folio case. Great for note taking, drawing and presentations.', daily: 90_000, weekly: 550_000, deposit: 1_500_000, condition: 'GOOD', city: 'Jakarta Timur', district: 'Duren Sawit', address: 'Pickup near Buaran Plaza', images: [img('1611532736597-de2d4265fba3'), img('1544244015-0df4b3ffc6b0')], daysAgo: 12 },
  { key: 'mic', owner: 'budi', category: 'electronics', subcategory: 'Audio', title: 'Podcast Microphone Kit (XLR + Boom Arm)', description: 'Dynamic broadcast microphone with boom arm, pop filter and USB audio interface. Plug-and-play for podcasts, streaming and voice-over recording.', daily: 45_000, weekly: 270_000, deposit: 500_000, condition: 'LIKE_NEW', city: 'Jakarta Selatan', district: 'Tebet', address: 'Pickup at Tebet Eco Park entrance', delivery: 20_000, images: [img('1590602847861-f357a9332bbc')], daysAgo: 18 },
  { key: 'headphones', owner: 'maya', category: 'electronics', subcategory: 'Audio', title: 'Noise-Cancelling Wireless Headphones', description: 'Over-ear wireless headphones with active noise cancelling and 30-hour battery. Great for flights and focus work. Cleaned and sanitized after every rental.', daily: 35_000, weekly: 200_000, deposit: 400_000, condition: 'GOOD', city: 'Tangerang', district: 'Karawaci', address: 'Pickup at Supermal Karawaci', images: [img('1583394838336-acd977736f90'), img('1550009158-9ebf69173e03')], daysAgo: 8 },
  { key: 'drone', owner: 'rizky', category: 'electronics', subcategory: 'Drones', title: 'DJI Camera Drone with 3 Batteries', description: 'Camera drone shooting 4K video with a 3-axis gimbal. Includes 3 batteries, charging hub, spare propellers and carry case. Renter must follow local drone regulations.', daily: 200_000, weekly: 1_200_000, deposit: 4_000_000, condition: 'GOOD', city: 'Depok', district: 'Margonda', address: 'Pickup near Margo City', minDays: 1, maxDays: 7, images: [img('1473968512647-3e447244af8f')], daysAgo: 30 },
  { key: 'ps5', owner: 'fajar', category: 'electronics', subcategory: 'Gaming', title: 'PlayStation 5 + 2 Controllers', description: 'PS5 disc edition with two DualSense controllers and 3 games (racing, football and co-op adventure). Perfect for weekend gatherings.', daily: 80_000, weekly: 480_000, deposit: 1_500_000, condition: 'LIKE_NEW', city: 'Jakarta Pusat', district: 'Tanah Abang', address: 'Pickup at Thamrin City area', delivery: 30_000, images: [img('1606144042614-b2417e99c4e3')], daysAgo: 5 },
  { key: 'tent', owner: 'rizky', category: 'travel-outdoor', subcategory: 'Camping', title: '4-Person Waterproof Camping Tent', description: 'Spacious double-layer dome tent for 4 people. Waterproof flysheet, easy setup in 10 minutes. Includes ground sheet, pegs and carry bag. Sleeping bags available on request.', daily: 50_000, weekly: 300_000, deposit: 300_000, condition: 'GOOD', city: 'Depok', district: 'Margonda', address: 'Pickup near Margo City', delivery: 25_000, images: [img('1504280390367-361c6d9f38f4'), img('1510312305653-8ed496efae75')], daysAgo: 50 },
  { key: 'backpack', owner: 'rizky', category: 'travel-outdoor', subcategory: 'Bags', title: '45L Hiking & Travel Backpack', description: 'Lightweight 45-liter backpack with rain cover, hip belt and laptop sleeve. Comfortable for hiking trips or backpacking around Southeast Asia.', daily: 25_000, weekly: 150_000, deposit: 200_000, condition: 'LIKE_NEW', city: 'Depok', district: 'Margonda', address: 'Pickup near Margo City', images: [img('1501555088652-021faa106b9b'), img('1553062407-98eeb64c6a62')], daysAgo: 45 },
  { key: 'suitcase', owner: 'maya', category: 'travel-outdoor', subcategory: 'Luggage', title: 'Large 28" Hard-Shell Suitcase', description: '28-inch polycarbonate suitcase with TSA lock and 4 spinner wheels. Fits 2 weeks of clothes. Great for international trips.', daily: 30_000, weekly: 180_000, monthly: 500_000, deposit: 300_000, condition: 'GOOD', city: 'Tangerang', district: 'Karawaci', address: 'Pickup at Supermal Karawaci', delivery: 30_000, images: [img('1565026057447-bc90a3dceb87')], daysAgo: 28 },
  { key: 'robotvac', owner: 'putri', category: 'household', subcategory: 'Cleaning', title: 'Robot Vacuum Cleaner', description: 'Smart robot vacuum with app control and auto-recharge. Try it before you buy one, or use it for a deep clean before guests arrive.', daily: 45_000, weekly: 250_000, deposit: 500_000, condition: 'GOOD', city: 'Jakarta Timur', district: 'Duren Sawit', address: 'Pickup near Buaran Plaza', delivery: 20_000, images: [img('1558317374-067fb5f30001')], daysAgo: 22 },
  { key: 'stickvac', owner: 'putri', category: 'household', subcategory: 'Cleaning', title: 'Cordless Stick Vacuum', description: 'Powerful cordless vacuum with 40 minutes of runtime, crevice tool and mini motorized head. Ideal for moving out, sofas and cars.', daily: 35_000, weekly: 200_000, deposit: 400_000, condition: 'LIKE_NEW', city: 'Jakarta Timur', district: 'Duren Sawit', address: 'Pickup near Buaran Plaza', delivery: 20_000, images: [img('1527515637462-cff94eecc1ac')], daysAgo: 10 },
  { key: 'espresso', owner: 'budi', category: 'household', subcategory: 'Kitchen', title: 'Espresso Machine + Coffee Grinder', description: 'Semi-automatic espresso machine with burr grinder, milk jug and tamper. Great for office events or trying home barista life. Beans not included.', daily: 55_000, weekly: 330_000, deposit: 700_000, condition: 'GOOD', city: 'Jakarta Selatan', district: 'Tebet', address: 'Pickup at Tebet Eco Park entrance', delivery: 25_000, images: [img('1570222094114-d054a817e56b')], daysAgo: 14 },
  { key: 'cookware', owner: 'dewi', category: 'household', subcategory: 'Kitchen', title: 'Complete Cookware Set for Gatherings', description: 'Stainless steel pots, pans, large wok and serving trays for cooking for 20+ people. Perfect for arisan, family gatherings or open house events.', daily: 30_000, weekly: 180_000, deposit: 300_000, condition: 'GOOD', city: 'Tangerang Selatan', district: 'BSD', address: 'Pickup near AEON Mall BSD', delivery: 35_000, images: [img('1556911220-bff31c812dba')], daysAgo: 33 },
  { key: 'drill', owner: 'agus', category: 'tools', subcategory: 'Power tools', title: 'Cordless Drill Machine 18V', description: '18V cordless drill/driver with 2 batteries, fast charger and 30-piece bit set. Handles wood, metal and masonry with the hammer function.', daily: 40_000, weekly: 220_000, deposit: 400_000, condition: 'GOOD', city: 'Bekasi', district: 'Bekasi Selatan', address: 'Pickup at Summarecon Mall Bekasi', delivery: 25_000, images: [img('1504148455328-c376907d081c')], daysAgo: 55 },
  { key: 'toolbox', owner: 'agus', category: 'tools', subcategory: 'Hand tools', title: 'Complete Home Toolbox (120 pcs)', description: 'Toolbox with hammer, screwdrivers, wrenches, pliers, measuring tape, level and more. Everything you need for furniture assembly and home repairs.', daily: 25_000, weekly: 140_000, deposit: 200_000, condition: 'GOOD', city: 'Bekasi', district: 'Bekasi Selatan', address: 'Pickup at Summarecon Mall Bekasi', delivery: 25_000, images: [img('1581092160562-40aa08e78837')], daysAgo: 38 },
  { key: 'speaker', owner: 'dewi', category: 'events', subcategory: 'Audio', title: 'JBL Portable Bluetooth Speaker', description: 'Waterproof portable speaker with deep bass and 12-hour battery. Great for picnics, pool parties and small gatherings. Two units can be paired.', daily: 60_000, weekly: 350_000, deposit: 500_000, condition: 'LIKE_NEW', city: 'Tangerang Selatan', district: 'BSD', address: 'Pickup near AEON Mall BSD', delivery: 30_000, images: [img('1608043152269-423dbba4e7e1')], daysAgo: 42 },
  { key: 'lighting', owner: 'dewi', category: 'events', subcategory: 'Lighting', title: 'Stage Lighting Kit (8 LED Par + Controller)', description: 'Eight RGBW LED par lights with DMX controller, stands and cables. Transform weddings, birthdays and band nights. Setup assistance available.', daily: 150_000, deposit: 1_500_000, condition: 'GOOD', city: 'Tangerang Selatan', district: 'BSD', address: 'Pickup at warehouse near AEON Mall BSD', delivery: 75_000, pickup: false, images: [img('1516450360452-9312f5e86fc7')], daysAgo: 26 },
  { key: 'decor', owner: 'dewi', category: 'events', subcategory: 'Decorations', title: 'Party Decoration Pack (Confetti Cannons & Backdrop)', description: 'Reusable backdrop stand, fairy lights, balloon arch frame and 4 confetti cannons (consumables included). Great for birthdays and launches.', daily: 50_000, deposit: 250_000, condition: 'GOOD', city: 'Tangerang Selatan', district: 'BSD', address: 'Pickup near AEON Mall BSD', delivery: 35_000, maxDays: 5, images: [img('1492684223066-81342ee5ff30')], daysAgo: 6 },
  { key: 'polaroid', owner: 'siti', category: 'events', subcategory: 'Cameras', title: 'Instant Camera for Parties', description: 'Polaroid-style instant camera for weddings and parties. Two film packs (16 photos) included; extra film available for purchase at pickup.', daily: 40_000, deposit: 400_000, condition: 'LIKE_NEW', city: 'Jakarta Selatan', district: 'Kebayoran Baru', address: 'Pickup near Blok M Plaza', images: [img('1526170375885-4d8ecf77b99f')], daysAgo: 3 },
  { key: 'bike', owner: 'nadia', category: 'sports', subcategory: 'Cycling', title: 'Road Bike (Size M) with Helmet', description: 'Lightweight aluminum road bike with 18 speeds, fits riders 165-180 cm. Helmet, lights and lock included. Perfect for Car Free Day rides.', daily: 70_000, weekly: 400_000, deposit: 1_000_000, condition: 'GOOD', city: 'Jakarta Utara', district: 'Kelapa Gading', address: 'Pickup at Mall Kelapa Gading', images: [img('1485965120184-e220f721d03e'), img('1517649763962-0c623066013b')], daysAgo: 48 },
  { key: 'badminton', owner: 'nadia', category: 'sports', subcategory: 'Racket sports', title: 'Badminton Set (4 Rackets + Shuttlecocks)', description: 'Four rackets, a tube of 12 feather shuttlecocks and a carry bag. Great for weekend games with friends.', daily: 20_000, weekly: 110_000, deposit: 150_000, condition: 'GOOD', city: 'Jakarta Utara', district: 'Kelapa Gading', address: 'Pickup at Mall Kelapa Gading', delivery: 20_000, images: [img('1626224583764-f87db24ac4ea')], daysAgo: 16 },
  { key: 'barbell', owner: 'nadia', category: 'sports', subcategory: 'Fitness', title: 'Home Gym Barbell & Plates Set (60 kg)', description: 'Olympic barbell with 60 kg of rubber plates and collars. Delivery recommended because of the weight.', daily: 30_000, weekly: 170_000, monthly: 550_000, deposit: 500_000, condition: 'FAIR', city: 'Jakarta Utara', district: 'Kelapa Gading', address: 'Pickup at Kelapa Gading residential area', delivery: 50_000, minDays: 3, images: [img('1517836357463-d25dfeac3438')], daysAgo: 21 },
  { key: 'tennis', owner: 'maya', category: 'sports', subcategory: 'Racket sports', title: 'Tennis Racket Pair + Balls', description: 'Two mid-weight tennis rackets with a can of balls. Great for beginners who want to try before buying.', daily: 30_000, deposit: 200_000, condition: 'LIKE_NEW', city: 'Tangerang', district: 'Karawaci', address: 'Pickup at Supermal Karawaci', images: [img('1595435934249-5df7ed86e1c0')], daysAgo: 9, status: 'PAUSED' },
  { key: 'football', owner: 'fajar', category: 'sports', subcategory: 'Team sports', title: 'Futsal Ball & Training Cones Set', description: 'Two match-quality futsal balls, 20 training cones, bibs for two teams and a pump.', daily: 15_000, deposit: 100_000, condition: 'GOOD', city: 'Jakarta Pusat', district: 'Tanah Abang', address: 'Pickup at Thamrin City area', images: [img('1574629810360-7efbbe195018')], daysAgo: 2 },
  { key: 'guitar', owner: 'budi', category: 'other', subcategory: 'Musical instruments', title: 'Acoustic Guitar with Soft Case', description: 'Full-size acoustic guitar with warm tone, recently restrung. Comes with soft case, capo and picks. Great for camping trips and gatherings.', daily: 35_000, weekly: 200_000, deposit: 400_000, condition: 'GOOD', city: 'Jakarta Selatan', district: 'Tebet', address: 'Pickup at Tebet Eco Park entrance', images: [img('1510915361894-db8b60106cb1')], daysAgo: 27 },
  { key: 'printer', owner: 'fajar', category: 'other', subcategory: 'Office equipment', title: 'Color Laser Printer', description: 'Color laser printer with Wi-Fi printing. Ideal for thesis season, event materials or a temporary office. Toner usage charged fairly by page count.', daily: 40_000, weekly: 220_000, deposit: 600_000, condition: 'GOOD', city: 'Jakarta Pusat', district: 'Tanah Abang', address: 'Pickup at Thamrin City area', delivery: 30_000, images: [img('1612815154858-60aa4c59eaa6')], daysAgo: 11 },
];

interface SeedBooking {
  listing: string;
  renter: string;
  startOffset: number; // days from today
  days: number;
  status: BookingStatus;
  payment?: PaymentStatus;
  delivery?: boolean;
  note?: string;
  review?: { rating: number; comment: string };
}

const bookings: SeedBooking[] = [
  { listing: 'canon', renter: 'budi', startOffset: -30, days: 3, status: 'COMPLETED', payment: 'SIMULATED_PAID', review: { rating: 5, comment: 'Siti was super helpful and even showed me the best settings for night shots. Camera was spotless.' } },
  { listing: 'tent', renter: 'budi', startOffset: -20, days: 2, status: 'COMPLETED', payment: 'SIMULATED_PAID', review: { rating: 4, comment: 'Tent was easy to set up and kept us dry during a rainy night in Puncak. Slightly dusty but fine.' } },
  { listing: 'macbook', renter: 'putri', startOffset: -15, days: 4, status: 'COMPLETED', payment: 'SIMULATED_PAID', delivery: true, review: { rating: 5, comment: 'Delivered on time and the laptop was in great condition. Andi is very responsive.' } },
  { listing: 'speaker', renter: 'andi', startOffset: -12, days: 1, status: 'COMPLETED', payment: 'SIMULATED_PAID', review: { rating: 5, comment: 'Loud and clear, battery lasted the whole party. Will rent again!' } },
  { listing: 'drill', renter: 'fajar', startOffset: -9, days: 2, status: 'COMPLETED', payment: 'SIMULATED_PAID', review: { rating: 4, comment: 'Worked perfectly for mounting shelves. Pickup was quick.' } },
  { listing: 'canon', renter: 'maya', startOffset: -7, days: 2, status: 'COMPLETED', payment: 'SIMULATED_PAID', review: { rating: 5, comment: 'Great camera for my sister\'s graduation. Everything was included as described.' } },
  { listing: 'projector', renter: 'budi', startOffset: -1, days: 3, status: 'ACTIVE', payment: 'SIMULATED_PAID', note: 'For a movie night with my office team.' },
  { listing: 'sony', renter: 'budi', startOffset: 5, days: 3, status: 'ACCEPTED', payment: 'UNPAID', delivery: true, note: 'Shooting a friend\'s pre-wedding session.' },
  { listing: 'mic', renter: 'siti', startOffset: 3, days: 2, status: 'PENDING', note: 'Need it to record a podcast episode with a guest.' },
  { listing: 'espresso', renter: 'andi', startOffset: 7, days: 1, status: 'PENDING', delivery: true, note: 'For our office coffee morning.' },
  { listing: 'bike', renter: 'budi', startOffset: 9, days: 2, status: 'PENDING', note: 'Planning to join Car Free Day on Sudirman.' },
  { listing: 'guitar', renter: 'rizky', startOffset: -5, days: 2, status: 'REJECTED' },
  { listing: 'suitcase', renter: 'budi', startOffset: 14, days: 7, status: 'CANCELLED', note: 'Trip got postponed.' },
  { listing: 'drone', renter: 'andi', startOffset: 10, days: 2, status: 'ACCEPTED', payment: 'SIMULATED_PAID' },
];

async function wipe() {
  // Order matters because of foreign keys.
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.report.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listingBlockedDate.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('Seeding Rentora demo data...');
  await wipe();
  const today = todayInMarket();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const catIds: Record<string, string> = {};
  for (const [i, c] of categories.entries()) {
    const created = await prisma.category.create({ data: { ...c, sortOrder: i } });
    catIds[c.slug] = created.id;
  }

  const userIds: Record<string, string> = {};
  for (const [i, u] of users.entries()) {
    const { key, ...data } = u;
    const created = await prisma.user.create({
      data: { ...data, province: provinceForCity(u.city), passwordHash, createdAt: addDays(new Date(), -120 + i * 3) },
    });
    userIds[key] = created.id;
  }

  const listingIds: Record<string, string> = {};
  const listingMap: Record<string, SeedListing> = {};
  for (const l of listings) {
    const created = await prisma.listing.create({
      data: {
        ownerId: userIds[l.owner],
        categoryId: catIds[l.category],
        title: l.title,
        subcategory: l.subcategory,
        description: l.description,
        dailyPrice: l.daily,
        weeklyPrice: l.weekly ?? null,
        monthlyPrice: l.monthly ?? null,
        securityDeposit: l.deposit,
        condition: l.condition,
        province: provinceForCity(l.city)!,
        city: l.city,
        district: l.district,
        address: l.address,
        pickupAvailable: l.pickup ?? true,
        deliveryAvailable: l.delivery != null,
        deliveryFee: l.delivery ?? 0,
        minRentalDays: l.minDays ?? 1,
        maxRentalDays: l.maxDays ?? null,
        status: l.status ?? 'ACTIVE',
        createdAt: addDays(new Date(), -l.daysAgo),
        images: { create: l.images.map((imageUrl, i) => ({ imageUrl, displayOrder: i })) },
      },
    });
    listingIds[l.key] = created.id;
    listingMap[l.key] = l;
  }

  // Owner-blocked dates example: the stage lighting kit is reserved for the owner's own event.
  await prisma.listingBlockedDate.create({
    data: { listingId: listingIds.lighting, startDate: addDays(today, 12), endDate: addDays(today, 14), note: 'Used for my own event' },
  });

  for (const b of bookings) {
    const l = listingMap[b.listing];
    const start = addDays(today, b.startOffset);
    const end = addDays(start, b.days - 1);
    const delivery = Boolean(b.delivery && l.delivery != null);
    const price = calculatePrice({
      dailyPrice: l.daily,
      weeklyPrice: l.weekly,
      monthlyPrice: l.monthly,
      securityDeposit: l.deposit,
      deliveryFee: l.delivery ?? 0,
      rentalDays: b.days,
      delivery,
    });
    const created = await prisma.booking.create({
      data: {
        listingId: listingIds[b.listing],
        renterId: userIds[b.renter],
        ownerId: userIds[l.owner],
        startDate: start,
        endDate: end,
        rentalDays: b.days,
        fulfillmentMethod: delivery ? 'DELIVERY' : 'PICKUP',
        dailyPriceSnapshot: l.daily,
        rentalPriceSnapshot: price.rentalSubtotal,
        depositSnapshot: price.securityDeposit,
        deliveryFeeSnapshot: price.deliveryFee,
        totalPrice: price.totalDue,
        listingTitleSnapshot: l.title,
        renterNote: b.note,
        status: b.status,
        paymentStatus: b.payment ?? 'UNPAID',
        createdAt: new Date(Math.min(addDays(start, -3).getTime(), Date.now() - (b.startOffset > 0 ? b.startOffset * 3_600_000 : 86_400_000))),
      },
    });
    if (b.review) {
      await prisma.review.create({
        data: {
          bookingId: created.id,
          listingId: listingIds[b.listing],
          reviewerId: userIds[b.renter],
          reviewedUserId: userIds[l.owner],
          rating: b.review.rating,
          comment: b.review.comment,
          createdAt: addDays(end, 1),
        },
      });
    }
  }

  // Recompute denormalized ratings.
  for (const id of Object.values(userIds)) {
    const agg = await prisma.review.aggregate({ where: { reviewedUserId: id }, _avg: { rating: true }, _count: true });
    await prisma.user.update({ where: { id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
  }
  for (const id of Object.values(listingIds)) {
    const agg = await prisma.review.aggregate({ where: { listingId: id }, _avg: { rating: true }, _count: true });
    await prisma.listing.update({ where: { id }, data: { ratingAvg: agg._avg.rating ?? 0, reviewCount: agg._count } });
  }

  // Conversations
  const conversations: { a: string; b: string; listing?: string; messages: [string, string, number][] }[] = [
    {
      a: 'budi', b: 'siti', listing: 'sony',
      messages: [
        ['budi', 'Hi Siti! Is the Sony kit suitable for a pre-wedding shoot outdoors?', -50],
        ['siti', 'Hi Budi, yes definitely. The 50mm lens is great for portraits. I can deliver it to Tebet.', -45],
        ['budi', 'Perfect, I just sent the booking request. Thank you!', -40],
        ['siti', 'Accepted! I will charge all batteries before delivery.', -30],
      ],
    },
    {
      a: 'budi', b: 'fajar', listing: 'projector',
      messages: [
        ['budi', 'Hi Fajar, does the projector come with a screen?', -2000],
        ['fajar', 'Yes, a 100" portable screen is included.', -1990],
        ['fajar', 'Enjoy your movie night! Let me know if the HDMI cable gives you any trouble.', -20],
      ],
    },
    {
      a: 'andi', b: 'budi', listing: 'espresso',
      messages: [['andi', 'Hi Budi, can you deliver the espresso machine to Kebon Jeruk next week?', -10]],
    },
  ];
  for (const c of conversations) {
    const conv = await prisma.conversation.create({
      data: {
        listingId: c.listing ? listingIds[c.listing] : null,
        participants: { create: [{ userId: userIds[c.a] }, { userId: userIds[c.b] }] },
      },
    });
    let last = new Date();
    for (const [i, [sender, content, minutesAgo]] of c.messages.entries()) {
      const createdAt = new Date(Date.now() + minutesAgo * 60_000);
      const isLast = i === c.messages.length - 1;
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: userIds[sender],
          content,
          createdAt,
          // The most recent message to Budi stays unread to demo unread indicators.
          readAt: isLast && sender !== 'budi' ? null : createdAt,
        },
      });
      last = createdAt;
    }
    await prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: last } });
  }

  // Favorites
  for (const key of ['macbook', 'drone', 'lighting', 'backpack']) {
    await prisma.favorite.create({ data: { userId: userIds.budi, listingId: listingIds[key] } });
  }
  await prisma.favorite.create({ data: { userId: userIds.siti, listingId: listingIds.tent } });

  // Notifications for the demo user
  await prisma.notification.createMany({
    data: [
      { userId: userIds.budi, type: 'BOOKING_REQUEST', title: 'New booking request', message: 'Siti Rahayu wants to rent "Podcast Microphone Kit (XLR + Boom Arm)".', link: '/dashboard/requests' },
      { userId: userIds.budi, type: 'BOOKING_REQUEST', title: 'New booking request', message: 'Andi Wijaya wants to rent "Espresso Machine + Coffee Grinder".', link: '/dashboard/requests' },
      { userId: userIds.budi, type: 'BOOKING_ACCEPTED', title: 'Booking accepted', message: 'Your request for "Sony Alpha Mirrorless Camera Kit" was accepted.', link: '/dashboard/rentals', isRead: true },
      { userId: userIds.budi, type: 'BOOKING_COMPLETED', title: 'Rental completed', message: 'Your rental of "4-Person Waterproof Camping Tent" is complete.', link: '/dashboard/rentals', isRead: true },
    ],
  });

  // An open report for the admin queue
  await prisma.report.create({
    data: { reporterId: userIds.maya, listingId: listingIds.decor, reason: 'MISLEADING', description: 'Photos look like stock images, not the actual item.' },
  });

  console.log(`Seeded ${users.length} users, ${categories.length} categories, ${listings.length} listings, ${bookings.length} bookings.`);
  console.log(`Demo login: budi@rentora.test / ${DEMO_PASSWORD}  (admin: admin@rentora.test / ${DEMO_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
