import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMIN_PASSWORD = "Admin@123";
const PROVIDER_PASSWORD = "Provider@123";
const CUSTOMER_PASSWORD = "Customer@123";

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

let lockCounter = 0;
function img(keywords: string) {
  lockCounter += 1;
  return `https://loremflickr.com/640/420/${keywords}?lock=${lockCounter}`;
}

async function upsertUser(opts: { name: string; email: string; password: string; role: "CUSTOMER" | "PROVIDER" | "ADMIN" }) {
  return prisma.user.upsert({
    where: { email: opts.email },
    update: {},
    create: {
      name: opts.name,
      email: opts.email,
      password: await bcrypt.hash(opts.password, 10),
      role: opts.role,
    },
  });
}

async function upsertProvider(opts: {
  name: string;
  email: string;
  businessName: string;
  businessType: string;
  location: string;
  phone: string;
}) {
  const user = await upsertUser({ name: opts.name, email: opts.email, password: PROVIDER_PASSWORD, role: "PROVIDER" });
  const provider = await prisma.provider.upsert({
    where: { userId: user.id },
    update: { phone: opts.phone },
    create: {
      userId: user.id,
      businessName: opts.businessName,
      businessType: opts.businessType,
      location: opts.location,
      phone: opts.phone,
    },
  });
  return provider;
}

async function main() {
  console.log("Seeding RiceShare sample data...");

  const admin = await upsertUser({
    name: "RiceShare Admin",
    email: "admin@riceshare.dev",
    password: ADMIN_PASSWORD,
    role: "ADMIN",
  });

  const abcRestaurant = await upsertProvider({
    name: "Nimal Perera",
    email: "nimal@abcrestaurant.lk",
    businessName: "ABC Restaurant",
    businessType: "Restaurant",
    location: "Malabe",
    phone: "+94 77 123 4501",
  });

  const xyzEvents = await upsertProvider({
    name: "Kamala Silva",
    email: "kamala@xyzevents.lk",
    businessName: "XYZ Events",
    businessType: "Event Organizer",
    location: "Kaduwela",
    phone: "+94 77 123 4502",
  });

  const cityBakery = await upsertProvider({
    name: "Ruwan Fernando",
    email: "ruwan@citybakery.lk",
    businessName: "City Bakery",
    businessType: "Bakery",
    location: "Colombo",
    phone: "+94 77 123 4503",
  });

  const greenLeafHotel = await upsertProvider({
    name: "Ishara Jayasuriya",
    email: "ishara@greenleafhotel.lk",
    businessName: "Green Leaf Hotel",
    businessType: "Hotel",
    location: "Battaramulla",
    phone: "+94 77 123 4504",
  });

  const spiceCafe = await upsertProvider({
    name: "Dilani Rathnayake",
    email: "dilani@spicecafe.lk",
    businessName: "Spice Cafe",
    businessType: "Cafe",
    location: "Nugegoda",
    phone: "+94 77 123 4505",
  });

  const freshMart = await upsertProvider({
    name: "Sampath Wickramasinghe",
    email: "sampath@freshmart.lk",
    businessName: "FreshMart Supermarket",
    businessType: "Supermarket",
    location: "Kottawa",
    phone: "+94 77 123 4506",
  });

  await upsertUser({ name: "Amara Gunasekara", email: "amara@example.com", password: CUSTOMER_PASSWORD, role: "CUSTOMER" });
  await upsertUser({ name: "Tharindu Jayawardena", email: "tharindu@example.com", password: CUSTOMER_PASSWORD, role: "CUSTOMER" });

  await prisma.listing.deleteMany({
    where: {
      provider: {
        id: { in: [abcRestaurant.id, xyzEvents.id, cityBakery.id, greenLeafHotel.id, spiceCafe.id, freshMart.id] },
      },
    },
  });

  const listings = [
    {
      providerId: abcRestaurant.id,
      foodName: "Chicken Rice",
      category: "Rice & Curry",
      quantity: 20,
      quantityRemaining: 12,
      originalPrice: 450,
      sellingPrice: 200,
      listingType: "SALE" as const,
      location: "Malabe",
      pickupStart: hoursFromNow(1),
      pickupEnd: hoursFromNow(5),
      description: "Freshly cooked chicken rice with curry and sambol, surplus from today's lunch service.",
      imageUrl: img("chicken,rice"),
    },
    {
      providerId: abcRestaurant.id,
      foodName: "Vegetable Fried Rice",
      category: "Rice & Curry",
      quantity: 15,
      quantityRemaining: 15,
      originalPrice: 350,
      sellingPrice: 150,
      listingType: "SALE" as const,
      location: "Malabe",
      pickupStart: hoursFromNow(2),
      pickupEnd: hoursFromNow(6),
      description: "Vegetable fried rice made with seasonal vegetables, great for a quick affordable dinner.",
      imageUrl: img("friedrice,vegetables"),
    },
    {
      providerId: xyzEvents.id,
      foodName: "Vegetable Rice",
      category: "Rice & Curry",
      quantity: 30,
      quantityRemaining: 30,
      originalPrice: 0,
      sellingPrice: 0,
      listingType: "DONATION" as const,
      location: "Kaduwela",
      pickupStart: hoursFromNow(1),
      pickupEnd: hoursFromNow(4),
      description: "Surplus vegetable rice and curry from a corporate event today. Perfect for a community kitchen.",
      imageUrl: img("rice,curry"),
    },
    {
      providerId: xyzEvents.id,
      foodName: "Mixed Sweets Platter",
      category: "Desserts",
      quantity: 10,
      quantityRemaining: 10,
      originalPrice: 0,
      sellingPrice: 0,
      listingType: "DONATION" as const,
      location: "Kaduwela",
      pickupStart: hoursFromNow(1),
      pickupEnd: hoursFromNow(3),
      description: "Assorted Sri Lankan sweets left over from a wedding reception, still fresh and boxed.",
      imageUrl: img("dessert,sweets"),
    },
    {
      providerId: cityBakery.id,
      foodName: "Vegetable Sandwiches",
      category: "Bakery",
      quantity: 25,
      quantityRemaining: 18,
      originalPrice: 300,
      sellingPrice: 120,
      listingType: "SALE" as const,
      location: "Colombo",
      pickupStart: hoursFromNow(1),
      pickupEnd: hoursFromNow(3),
      description: "Freshly made vegetable sandwiches from this morning, discounted before closing.",
      imageUrl: img("sandwich,vegetables"),
    },
    {
      providerId: cityBakery.id,
      foodName: "Assorted Pastries",
      category: "Bakery",
      quantity: 18,
      quantityRemaining: 6,
      originalPrice: 400,
      sellingPrice: 160,
      listingType: "SALE" as const,
      location: "Colombo",
      pickupStart: hoursFromNow(0.5),
      pickupEnd: hoursFromNow(1),
      description: "Croissants, cinnamon rolls and cheese buns baked today, discounted for end-of-day pickup.",
      imageUrl: img("pastries,bakery"),
    },
    {
      providerId: greenLeafHotel.id,
      foodName: "Buffet Surplus - Rice & Curry Set",
      category: "Rice & Curry",
      quantity: 40,
      quantityRemaining: 25,
      originalPrice: 1200,
      sellingPrice: 450,
      listingType: "SALE" as const,
      location: "Battaramulla",
      pickupStart: hoursFromNow(1),
      pickupEnd: hoursFromNow(2),
      description: "Full rice and curry buffet sets from tonight's banquet, includes 4 curries and dessert.",
      imageUrl: img("curry,rice"),
    },
    {
      providerId: greenLeafHotel.id,
      foodName: "Banquet Leftovers - Fried Noodles",
      category: "Prepared Meals",
      quantity: 20,
      quantityRemaining: 20,
      originalPrice: 0,
      sellingPrice: 0,
      listingType: "DONATION" as const,
      location: "Battaramulla",
      pickupStart: hoursFromNow(1),
      pickupEnd: hoursFromNow(2.5),
      description: "Freshly prepared fried noodles from a conference lunch, more than we can use tonight.",
      imageUrl: img("noodles,fried"),
    },
    {
      providerId: spiceCafe.id,
      foodName: "Chicken Kottu",
      category: "Prepared Meals",
      quantity: 12,
      quantityRemaining: 4,
      originalPrice: 500,
      sellingPrice: 250,
      listingType: "SALE" as const,
      location: "Nugegoda",
      pickupStart: hoursFromNow(0.5),
      pickupEnd: hoursFromNow(1.5),
      description: "Spicy chicken kottu made fresh this evening, discounted portions before we close.",
      imageUrl: img("kottu,srilankan"),
    },
    {
      providerId: spiceCafe.id,
      foodName: "Fresh Fruit Juice Pack",
      category: "Beverages",
      quantity: 24,
      quantityRemaining: 24,
      originalPrice: 150,
      sellingPrice: 60,
      listingType: "SALE" as const,
      location: "Nugegoda",
      pickupStart: hoursFromNow(2),
      pickupEnd: hoursFromNow(8),
      description: "Chilled fresh fruit juice bottles, surplus stock nearing best-before window.",
      imageUrl: img("juice,fruit"),
    },
    {
      providerId: freshMart.id,
      foodName: "Bakery Snack Boxes",
      category: "Snacks",
      quantity: 30,
      quantityRemaining: 30,
      originalPrice: 250,
      sellingPrice: 90,
      listingType: "SALE" as const,
      location: "Kottawa",
      pickupStart: hoursFromNow(3),
      pickupEnd: hoursFromNow(10),
      description: "Short-dated savory snack boxes from our bakery counter, still well within safe consumption.",
      imageUrl: img("snacks,bakery"),
    },
    {
      providerId: freshMart.id,
      foodName: "Bread & Bun Surplus",
      category: "Bakery",
      quantity: 40,
      quantityRemaining: 40,
      originalPrice: 0,
      sellingPrice: 0,
      listingType: "DONATION" as const,
      location: "Kottawa",
      pickupStart: hoursFromNow(2),
      pickupEnd: hoursFromNow(6),
      description: "End-of-day bread and buns, perfectly good but past today's sell window. Ideal for shelters.",
      imageUrl: img("bread,bakery"),
    },
    {
      providerId: abcRestaurant.id,
      foodName: "Watalappan Dessert Cups",
      category: "Desserts",
      quantity: 16,
      quantityRemaining: 0,
      originalPrice: 200,
      sellingPrice: 80,
      listingType: "SALE" as const,
      location: "Malabe",
      pickupStart: hoursFromNow(-6),
      pickupEnd: hoursFromNow(-1),
      description: "Traditional watalappan dessert cups made in-house, sold out fast today!",
      imageUrl: img("pudding,custard"),
    },
  ];

  for (const listing of listings) {
    await prisma.listing.create({ data: listing });
  }

  console.log(`Seeded admin, 6 providers, 2 customers, and ${listings.length} listings.`);
  console.log("");
  console.log("=== Demo login credentials ===");
  console.log(`Admin:     admin@riceshare.dev / ${ADMIN_PASSWORD}`);
  console.log(`Providers: nimal@abcrestaurant.lk, kamala@xyzevents.lk, ruwan@citybakery.lk,`);
  console.log(`           ishara@greenleafhotel.lk, dilani@spicecafe.lk, sampath@freshmart.lk`);
  console.log(`           (all use password: ${PROVIDER_PASSWORD})`);
  console.log(`Customers: amara@example.com, tharindu@example.com / ${CUSTOMER_PASSWORD}`);
  console.log("Done.");
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
