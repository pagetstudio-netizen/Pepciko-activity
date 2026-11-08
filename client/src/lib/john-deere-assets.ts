import { JOHN_DEERE_PRODUCT_IMAGE_PATHS } from "@shared/product-catalog";
import {
  PRODUCT_IMAGE_URL,
  WELLNESS_PRODUCT_IMAGE_URL,
} from "@shared/product-catalog";
import type { ProductType } from "@shared/schema";

export const PEPSICO_LOGO = "/pepsico-logo.jpg";

export const JOHN_DEERE_PHOTOS = {
  homeHero: "/john-deere/home-hero.jpeg",
  expo: "/john-deere/expo-logo.jpg",
  dealership: "/john-deere/dealership.jpg",
  tractorService: "/john-deere/tractor-service.jpg",
  showroom: "/john-deere/showroom.jpg",
  tractorExpo: "/john-deere/tractor-expo.jpg",
  dealerTeam: "/john-deere/dealer-team.jpg",
  teamMachinery: "/john-deere/team-machinery.jpg",
  fieldTeam: "/john-deere/field-team.jpg",
  emblem: "/john-deere/deere-emblem.jpg",
} as const;

export const JOHN_DEERE_PRODUCT_IMAGES = JOHN_DEERE_PRODUCT_IMAGE_PATHS;

const ROBOT_PRODUCT_ALIAS_COUNT = 10;

export function getRobotProductDisplayName(
  productId: number,
  productName?: string | null,
) {
  const robotNumber = productName?.match(/robot[\s_-]*(\d+)/i)?.[1];
  if (robotNumber) return `Robot-${Number(robotNumber)}`;

  const idIndex = Number.isFinite(productId) && productId > 1
    ? Math.trunc(productId) - 2
    : 0;
  const safeIndex = ((idIndex % ROBOT_PRODUCT_ALIAS_COUNT) + ROBOT_PRODUCT_ALIAS_COUNT)
    % ROBOT_PRODUCT_ALIAS_COUNT;

  return `Robot-${safeIndex + 1}`;
}

export function getRobotProductImage(
  imageUrl: string | null | undefined,
  _productId: number,
  _productName?: string | null,
  productType?: ProductType,
) {
  const storedImage = imageUrl?.trim();
  if (storedImage && !storedImage.startsWith("/john-deere/products/")) return storedImage;
  return productType === "wellness" ? WELLNESS_PRODUCT_IMAGE_URL : PRODUCT_IMAGE_URL;
}

export const getJohnDeereProductImage = getRobotProductImage;