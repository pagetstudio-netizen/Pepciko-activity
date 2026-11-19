export const PRODUCT_IMAGE_URL = "/pepsico-home/pepsico-poppi-products.jpg";
export const WELLNESS_PRODUCT_IMAGE_URL = "/pepsico-home/pepsico-mirinda-products.jpg";

export const JOHN_DEERE_PRODUCT_CATALOG = [
  {
    name: "Buy to become VIP1",
    price: 3000,
    dailyEarnings: 500,
    cycleDays: 90,
    totalReturn: 45000,
    sortOrder: 1,
    imageUrl: PRODUCT_IMAGE_URL,
  },
  {
    name: "Buy to become VIP2",
    price: 7000,
    dailyEarnings: 1050,
    cycleDays: 90,
    totalReturn: 94500,
    sortOrder: 2,
    imageUrl: PRODUCT_IMAGE_URL,
  },
  {
    name: "Buy to become VIP3",
    price: 17000,
    dailyEarnings: 2700,
    cycleDays: 90,
    totalReturn: 243000,
    sortOrder: 3,
    imageUrl: PRODUCT_IMAGE_URL,
  },
  {
    name: "Buy to become VIP4",
    price: 45000,
    dailyEarnings: 7650,
    cycleDays: 90,
    totalReturn: 688500,
    sortOrder: 4,
    imageUrl: PRODUCT_IMAGE_URL,
  },
  {
    name: "Buy to become VIP5",
    price: 110000,
    dailyEarnings: 20000,
    cycleDays: 90,
    totalReturn: 1800000,
    sortOrder: 5,
    imageUrl: PRODUCT_IMAGE_URL,
  },
  {
    name: "Buy to become VIP6",
    price: 225000,
    dailyEarnings: 43900,
    cycleDays: 90,
    totalReturn: 3951000,
    sortOrder: 6,
    imageUrl: PRODUCT_IMAGE_URL,
  },
  {
    name: "Buy to become VIP7",
    price: 430000,
    dailyEarnings: 90500,
    cycleDays: 90,
    totalReturn: 8145000,
    sortOrder: 7,
    imageUrl: PRODUCT_IMAGE_URL,
  },
  {
    name: "Buy to become VIP8",
    price: 900000,
    dailyEarnings: 205000,
    cycleDays: 90,
    totalReturn: 18450000,
    sortOrder: 8,
    imageUrl: PRODUCT_IMAGE_URL,
  },
] as const;

export const JOHN_DEERE_PRODUCT_IMAGE_PATHS = JOHN_DEERE_PRODUCT_CATALOG.map(
  (product) => product.imageUrl,
);