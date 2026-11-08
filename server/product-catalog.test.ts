import assert from "node:assert/strict";
import test from "node:test";
import {
  JOHN_DEERE_PRODUCT_CATALOG,
  JOHN_DEERE_PRODUCT_IMAGE_PATHS,
  PRODUCT_IMAGE_URL,
  WELLNESS_PRODUCT_IMAGE_URL,
} from "../shared/product-catalog";

test("all stable catalog products use the supplied universal image", () => {
  assert.ok(JOHN_DEERE_PRODUCT_CATALOG.length > 0);
  assert.ok(JOHN_DEERE_PRODUCT_CATALOG.every((product) => product.imageUrl === PRODUCT_IMAGE_URL));
  assert.ok(JOHN_DEERE_PRODUCT_IMAGE_PATHS.every((imageUrl) => imageUrl === PRODUCT_IMAGE_URL));
});

test("wellness products use their dedicated Mirinda artwork by default", () => {
  assert.equal(WELLNESS_PRODUCT_IMAGE_URL, "/pepsico-home/pepsico-mirinda-products.jpg");
  assert.notEqual(WELLNESS_PRODUCT_IMAGE_URL, PRODUCT_IMAGE_URL);
});
