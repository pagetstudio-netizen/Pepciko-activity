import { db } from "./db";
import {
  users,
  products,
  tasks,
  userTasks,
  transactions,
  paymentChannels,
  platformSettings,
  countries,
} from "@shared/schema";
import {
  JOHN_DEERE_PRODUCT_CATALOG,
  JOHN_DEERE_PRODUCT_IMAGE_PATHS,
  PRODUCT_IMAGE_URL,
  WELLNESS_PRODUCT_IMAGE_URL,
} from "@shared/product-catalog";
import { formatActivityProductName } from "@shared/activity-product-names";
import { formatStableProductName } from "@shared/stable-product-names";
import { formatWellnessProductName } from "@shared/wellness-product-names";
import {
  calculateInvitationRewardTopUp,
  INVITATION_TASK_DEFAULTS,
  INVITATION_TASK_KEY_PREFIX,
} from "./invitation-tasks";
import bcrypt from "bcrypt";
import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

export async function seed() {
  console.log("Seeding database...");

  // One-time migration: existing single-wallet balances become non-withdrawable deposit balance.
  const walletSplitMigrationKey = "userWalletSplitV1";
  const walletSplitMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, walletSplitMigrationKey))
    .limit(1);
  if (walletSplitMigration.length === 0) {
    await db.transaction(async (tx) => {
      await tx.update(users).set({
        depositBalance: users.balance,
        withdrawalBalance: "0",
      });
      await tx.insert(platformSettings).values({ key: walletSplitMigrationKey, value: "1" });
    });
    console.log("Existing balances moved to the non-withdrawable deposit wallet");
  }

  // Create session table for connect-pg-simple (if not exists)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    ) WITH (OIDS=FALSE)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
  `);
  await db.execute(sql`
    ALTER TABLE "payment_numbers" ALTER COLUMN "phone" DROP NOT NULL
  `).catch(() => undefined);
  await db.execute(sql`
    ALTER TABLE "payment_numbers" ADD COLUMN IF NOT EXISTS "payment_link" text
  `).catch(() => undefined);
  await db.execute(sql`
    ALTER TABLE "deposits"
      ADD COLUMN IF NOT EXISTS "drimpay_reference" text,
      ADD COLUMN IF NOT EXISTS "drimpay_order_id" text
  `);
  await db.execute(sql`
    ALTER TABLE "withdrawals"
      ADD COLUMN IF NOT EXISTS "drimpay_reference" text,
      ADD COLUMN IF NOT EXISTS "drimpay_external_ref" text
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "deposits_drimpay_reference_idx" ON "deposits" ("drimpay_reference")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "deposits_drimpay_order_id_idx" ON "deposits" ("drimpay_order_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "withdrawals_drimpay_reference_idx" ON "withdrawals" ("drimpay_reference")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "withdrawals_drimpay_external_ref_idx" ON "withdrawals" ("drimpay_external_ref")
  `);
  await db.execute(sql`
    DROP TABLE IF EXISTS "withdrawal_fee_payments"
  `).catch(() => undefined);
  await db.execute(sql`
    ALTER TABLE "deposits" DROP COLUMN IF EXISTS "withdrawal_fee_payment_id"
  `).catch(() => undefined);

  // Ensure countries table exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "countries" (
      "id" serial PRIMARY KEY,
      "code" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "currency" text NOT NULL,
      "phone_prefix" text NOT NULL,
      "operators" text NOT NULL DEFAULT '[]',
      "is_active" boolean NOT NULL DEFAULT true
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "withdrawal_wallet_audit" (
      "id" serial PRIMARY KEY,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "wallet_id" integer,
      "actor_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "actor_role" text NOT NULL,
      "action" text NOT NULL,
      "old_account_name" text,
      "old_account_number" text,
      "old_payment_method" text,
      "old_country" text,
      "new_account_name" text,
      "new_account_number" text,
      "new_payment_method" text,
      "new_country" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "withdrawal_wallet_audit_user_created_idx"
    ON "withdrawal_wallet_audit" ("user_id", "created_at")
  `);

  // Do not embed administrator identifiers or credentials in source code.
  // Provisioning and updates are opt-in through deployment Secrets.
  const adminPhone = process.env.ADMIN_PHONE?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPin = process.env.ADMIN_PIN;

  if (!adminPhone) {
    console.warn("Administrator provisioning skipped; configure ADMIN_PHONE in deployment Secrets to manage the bootstrap account.");
  } else {
    const existingAdmin = await db.select().from(users).where(eq(users.phone, adminPhone));
    if (existingAdmin.length === 0) {
      if (!adminPassword) {
        console.warn("No administrator exists yet; configure ADMIN_PHONE and ADMIN_PASSWORD in deployment Secrets.");
      } else {
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        await db.insert(users).values({
          fullName: "Super Admin",
          phone: adminPhone,
          country: "TG",
          password: hashedPassword,
          referralCode: "ADMIN1",
          balance: "0",
          isAdmin: true,
          isSuperAdmin: true,
          adminPin: adminPin ? await bcrypt.hash(adminPin, 12) : null,
        });
        console.log("Super admin created");
        if (adminPin) console.log("Super admin PIN configured");
      }
    } else {
      // Keep the existing administrator and update credentials only when
      // deployment Secrets explicitly provide them.
      const updateData: any = { country: "TG", isAdmin: true, isSuperAdmin: true };
      if (adminPassword) {
        updateData.password = await bcrypt.hash(adminPassword, 12);
        console.log("Super admin password updated");
      }
      if (adminPin) {
        updateData.adminPin = await bcrypt.hash(adminPin, 12);
        console.log("Super admin PIN updated");
      }
      await db.update(users)
        .set(updateData)
        .where(eq(users.phone, adminPhone));
      console.log("Super admin access verified");
    }
  }

  // Migrate any legacy plaintext Admin PINs without changing the PIN users enter.
  const usersWithPins = await db.select({ id: users.id, adminPin: users.adminPin })
    .from(users)
    .where(isNotNull(users.adminPin));
  for (const user of usersWithPins) {
    if (!user.adminPin || /^\$2[aby]\$/.test(user.adminPin)) continue;
    await db.update(users)
      .set({ adminPin: await bcrypt.hash(user.adminPin, 12) })
      .where(eq(users.id, user.id));
  }

  // Seed countries only on first install — never overwrite admin changes
  const existingCountries = await db.select().from(countries);
  if (existingCountries.length === 0) {
    const defaultCountries = [
      {
        code: "TG",
        name: "Togo",
        currency: "XOF",
        phonePrefix: "228",
        operators: JSON.stringify(["Togocel", "Moov Africa Togo"]),
        isActive: true,
      },
      {
        code: "CM",
        name: "Cameroun",
        currency: "XAF",
        phonePrefix: "237",
        operators: JSON.stringify(["Orange Cameroun", "MTN Cameroun"]),
        isActive: true,
      },
      {
        code: "BF",
        name: "Burkina Faso",
        currency: "XOF",
        phonePrefix: "226",
        operators: JSON.stringify(["Orange Burkina", "Moov Africa Burkina"]),
        isActive: true,
      },
      {
        code: "NE",
        name: "Niger",
        currency: "XOF",
        phonePrefix: "227",
        operators: JSON.stringify(["NITA TRANSFERT", "AMANA TRANSFERT"]),
        isActive: true,
      },
      {
        code: "BJ",
        name: "Benin",
        currency: "XOF",
        phonePrefix: "229",
        operators: JSON.stringify(["MTN Benin", "Moov Africa Benin"]),
        isActive: true,
      },
    ];
    for (const countryData of defaultCountries) {
      await db.insert(countries).values(countryData);
      console.log(`Country added: ${countryData.name}`);
    }
  } else {
    console.log(`Countries skipped — ${existingCountries.length} existing countries preserved`);
  }

  // Seed products only if table is empty (first install only — never overwrite admin changes)
  const existingProducts = await db.select().from(products);
  if (existingProducts.length === 0) {
    await db.insert(products).values(JOHN_DEERE_PRODUCT_CATALOG.map((product) => ({ ...product })));
    console.log("Products seeded (first install)");
  } else {
    console.log(`Products skipped — ${existingProducts.length} existing products preserved`);
  }

  // Apply the supplied John Deere price list once, updating matching sort orders and adding missing rows.
  const productCatalogMigrationKey = "johnDeereProductCatalogV1";
  const productCatalogMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, productCatalogMigrationKey))
    .limit(1);
  if (productCatalogMigration.length === 0) {
    const currentCatalogProducts = await db.select().from(products);
    const productsBySortOrder = new Map(
      currentCatalogProducts.map((product) => [product.sortOrder, product]),
    );
    for (const productData of JOHN_DEERE_PRODUCT_CATALOG) {
      const existing = productsBySortOrder.get(productData.sortOrder);
      const values = {
        ...productData,
        isFree: false,
        isActive: true,
      };
      if (existing) {
        await db.update(products).set(values).where(eq(products.id, existing.id));
      } else {
        await db.insert(products).values(values);
      }
    }
    await db.insert(platformSettings).values({ key: productCatalogMigrationKey, value: "1" });
    console.log("John Deere product values synchronized with the supplied price list");
  }

  // Apply canonical category names once while preserving every other product field.
  const canonicalProductNamesMigrationKey = "canonicalProductNamesV2";
  const canonicalProductNamesMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, canonicalProductNamesMigrationKey))
    .limit(1);
  if (canonicalProductNamesMigration.length === 0) {
    const orderedProducts = (await db.select().from(products))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const stableProducts = orderedProducts.filter((product) => product.productType === "stable");
    const activityProducts = orderedProducts.filter((product) => product.productType === "activity");

    for (let index = 0; index < stableProducts.length; index += 1) {
      const product = stableProducts[index];
      if (product) {
        await db.update(products)
          .set({ name: formatStableProductName(index + 1) })
          .where(eq(products.id, product.id));
      }
    }
    for (let index = 0; index < activityProducts.length; index += 1) {
      const product = activityProducts[index];
      if (product) {
        await db.update(products)
          .set({ name: formatActivityProductName(index + 1) })
          .where(eq(products.id, product.id));
      }
    }

    await db.insert(platformSettings).values({
      key: canonicalProductNamesMigrationKey,
      value: "1",
    });
    console.log(
      `Canonical product names applied to ${stableProducts.length} stable and ${activityProducts.length} activity products`,
    );
  }

  const wellnessNamesMigrationKey = "canonicalWellnessProductNamesV1";
  const wellnessNamesMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, wellnessNamesMigrationKey))
    .limit(1);
  if (wellnessNamesMigration.length === 0) {
    const wellnessProducts = (await db.select().from(products))
      .filter((product) => product.productType === "wellness")
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    for (let index = 0; index < wellnessProducts.length; index += 1) {
      const product = wellnessProducts[index];
      if (product) {
        await db.update(products)
          .set({ name: formatWellnessProductName(index + 1) })
          .where(eq(products.id, product.id));
      }
    }
    await db.insert(platformSettings).values({
      key: wellnessNamesMigrationKey,
      value: "1",
    });
    console.log(`Canonical names applied to ${wellnessProducts.length} Bien-être products`);
  }

  // Apply the catalog artwork path once before the universal image migration.
  const imageMigrationKey = "johnDeereProductImagesV3";
  const imageMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, imageMigrationKey))
    .limit(1);
  if (imageMigration.length === 0) {
    const productsToUpdate = await db.select().from(products);
    const orderedProducts = productsToUpdate.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
    );
    for (let index = 0; index < orderedProducts.length; index += 1) {
      const product = orderedProducts[index];
      if (!product || product.productType === "wellness") continue;
      const imageIndex = Math.max(0, product.sortOrder - 1) % JOHN_DEERE_PRODUCT_IMAGE_PATHS.length;
      const imageUrl = JOHN_DEERE_PRODUCT_IMAGE_PATHS[imageIndex];
      if (!imageUrl) continue;
      await db.update(products).set({ imageUrl }).where(eq(products.id, product.id));
    }
    await db.insert(platformSettings).values({ key: imageMigrationKey, value: "1" });
    console.log(`Catalog product image URLs applied to ${orderedProducts.length} products`);
  }

  const universalProductImageMigrationKey = "universalProductImageV1";
  const universalProductImageMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, universalProductImageMigrationKey))
    .limit(1);
  if (universalProductImageMigration.length === 0) {
    await db.transaction(async (tx) => {
      await tx.update(products)
        .set({ imageUrl: PRODUCT_IMAGE_URL })
        .where(ne(products.productType, "wellness"));
      await tx.insert(platformSettings).values({
        key: universalProductImageMigrationKey,
        value: "1",
      });
    });
    console.log("The supplied PepsiCo/Poppi image was applied to stable and activity products");
  }

  const wellnessArtworkMigrationKey = "wellnessMirindaArtworkV1";
  const wellnessArtworkMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, wellnessArtworkMigrationKey))
    .limit(1);
  if (wellnessArtworkMigration.length === 0) {
    await db.transaction(async (tx) => {
      await tx.update(products)
        .set({ imageUrl: WELLNESS_PRODUCT_IMAGE_URL })
        .where(and(
          eq(products.productType, "wellness"),
          or(eq(products.imageUrl, PRODUCT_IMAGE_URL), isNull(products.imageUrl)),
        ));
      await tx.insert(platformSettings).values({
        key: wellnessArtworkMigrationKey,
        value: "1",
      });
    });
    console.log("The supplied PepsiCo/Mirinda image was applied to default Bien-être artwork");
  }

  // One-time migration: replace old invitation tiers while preserving claimed-task history.
  const invitationTaskMigrationKey = "invitationTaskTiersV2";
  const invitationTaskMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, invitationTaskMigrationKey))
    .limit(1);
  if (invitationTaskMigration.length === 0) {
    const existingTasks = await db.select().from(tasks);
    const retainedTaskIds = new Set<number>();

    for (const { taskKey, ...tier } of INVITATION_TASK_DEFAULTS) {
      const existing = existingTasks.find(task => task.name === taskKey);
      if (existing) {
        await db.update(tasks).set(tier).where(eq(tasks.id, existing.id));
        retainedTaskIds.add(existing.id);
      } else {
        const [inserted] = await db.insert(tasks)
          .values(tier)
          .returning({ id: tasks.id });
        if (inserted) retainedTaskIds.add(inserted.id);
      }
    }

    const legacyTaskNames = new Set([
      "Parrain Bronze",
      "Parrain Argent",
      "Parrain Or",
      "Parrain Platine",
      "Parrain Diamant",
      "Parrain Elite",
    ]);
    const obsoleteTaskIds = existingTasks
      .filter(task => (
        task.name.startsWith(INVITATION_TASK_KEY_PREFIX) || legacyTaskNames.has(task.name)
      ) && !retainedTaskIds.has(task.id))
      .map(task => task.id);
    if (obsoleteTaskIds.length > 0) {
      await db.update(tasks).set({ isActive: false }).where(inArray(tasks.id, obsoleteTaskIds));
    }

    await db.insert(platformSettings).values({ key: invitationTaskMigrationKey, value: "1" });
    console.log("Invitation task tiers migrated to the five requested milestones");
  }

  // One-time reward increase: update active invitation rewards and top up completed claims.
  const invitationRewardIncreaseMigrationKey = "invitationTaskRewardIncreaseV3";
  const invitationRewardIncreaseMigration = await db.select({ key: platformSettings.key })
    .from(platformSettings)
    .where(eq(platformSettings.key, invitationRewardIncreaseMigrationKey))
    .limit(1);
  if (invitationRewardIncreaseMigration.length === 0) {
    let creditedClaims = 0;
    await db.transaction(async (tx) => {
      const upgradedTiers = INVITATION_TASK_DEFAULTS.filter(({ requiredInvites }) =>
        requiredInvites === 10 || requiredInvites === 30 || requiredInvites === 100
      );

      for (const tier of upgradedTiers) {
        const [task] = await tx.select({ id: tasks.id, reward: tasks.reward })
          .from(tasks)
          .where(eq(tasks.name, tier.taskKey))
          .limit(1);
        if (!task) continue;

        const claims = await tx.select({ userId: userTasks.userId })
          .from(userTasks)
          .where(and(
            eq(userTasks.taskId, task.id),
            eq(userTasks.rewardClaimed, true),
          ));
        const claimedUserIds = new Set(claims.map(({ userId }) => userId));
        const originalDescription = `Récompense d'invitation — ${tier.requiredInvites} membres de niveau 1`;

        for (const userId of Array.from(claimedUserIds)) {
          const [originalCredit] = await tx.select({ amount: transactions.amount })
            .from(transactions)
            .where(and(
              eq(transactions.userId, userId),
              eq(transactions.type, "task_reward"),
              eq(transactions.description, originalDescription),
            ))
            .orderBy(asc(transactions.createdAt))
            .limit(1);
          const transactionAmount = originalCredit ? Number(originalCredit.amount) : Number.NaN;
          const previouslyCredited = Number.isFinite(transactionAmount) && transactionAmount >= 0
            ? transactionAmount
            : task.reward;
          const topUp = calculateInvitationRewardTopUp(previouslyCredited, tier.reward);
          if (topUp <= 0) continue;

          await tx.update(users)
            .set({
              withdrawalBalance: sql`${users.withdrawalBalance} + ${topUp}`,
              balance: sql`${users.balance} + ${topUp}`,
            })
            .where(eq(users.id, userId));
          await tx.insert(transactions).values({
            userId,
            type: "task_reward",
            amount: topUp.toString(),
            description: `Complément de récompense d'invitation — ${tier.requiredInvites} membres de niveau 1`,
          });
          creditedClaims += 1;
        }

        await tx.update(tasks).set({ reward: tier.reward }).where(eq(tasks.id, task.id));
      }

      await tx.insert(platformSettings).values({
        key: invitationRewardIncreaseMigrationKey,
        value: "1",
      });
    });
    console.log(`Invitation task rewards updated; ${creditedClaims} previous claims topped up`);
  }

  // Check if payment channels exist
  const existingChannels = await db.select().from(paymentChannels);
  if (existingChannels.length === 0) {
    await db.insert(paymentChannels).values([
      { name: "LeekPay", redirectUrl: "https://leekpay.com/pay", isApi: false },
      { name: "FedaPay", redirectUrl: "https://fedapay.com/payment", isApi: false },
    ]);
    console.log("Payment channels seeded");
  }

  // Check if settings exist - apply new values for new keys or update existing
  const existingSettings = await db.select().from(platformSettings);
  const requiredSettings = [
    { key: "supportLink", value: "https://t.me/sybotx" },
    { key: "supportType", value: "telegram" },
    { key: "supportLabel", value: "Service client" },
    { key: "support2Link", value: "https://t.me/sybotx" },
    { key: "support2Type", value: "telegram" },
    { key: "support2Label", value: "Service client 2" },
    { key: "channelLink", value: "https://t.me/sybotx" },
    { key: "channelType", value: "telegram" },
    { key: "channelLabel", value: "Chaîne officielle" },
    { key: "groupLink", value: "https://t.me/sybotx" },
    { key: "groupType", value: "telegram" },
    { key: "groupLabel", value: "Groupe de discussion" },
    { key: "popupButtonLabel", value: "Cliquez ici pour rejoindre le groupe Telegram" },
    { key: "noticeText", value: "Bienvenue sur PepsiCo. Consultez les nouveautés et les informations de votre plateforme." },
    { key: "supportEnabled", value: "true" },
    { key: "support2Enabled", value: "true" },
    { key: "channelEnabled", value: "true" },
    { key: "groupEnabled", value: "true" },
    { key: "minDeposit", value: "3000" },
    { key: "minWithdrawal", value: "1500" },
    { key: "withdrawalFees", value: "18" },
    { key: "withdrawalStartHour", value: "9" },
    { key: "withdrawalEndHour", value: "17" },
    { key: "maxWithdrawalsPerDay", value: "1" },
    { key: "level1Commission", value: "25" },
    { key: "level2Commission", value: "3" },
    { key: "level3Commission", value: "2" },
    { key: "signupBonus", value: "0" },
    { key: "soleaspayEnabled", value: "false" },
    { key: "soleaspayCountries", value: "" },
    { key: "soleaspayChannelName", value: "Westpay" },
    { key: "omnipayEnabled", value: "false" },
    { key: "omnipayChannelName", value: "OmniPay" },
    { key: "omnipayCallbackKey", value: "" },
    { key: "sendavapayEnabled", value: "false" },
    { key: "sendavapayChannelName", value: "SendavaPay" },
    { key: "sendavapayWebhookSecret", value: "" },
    { key: "westpayEnabled", value: "false" },
    { key: "westpayChannelName", value: "WestPay" },
    { key: "westpayCountries", value: "" },
    { key: "westpayWebhookSecret", value: "" },
    { key: "ashtechEnabled", value: "true" },
    { key: "ashtechChannelName", value: "AshtechPay" },
    { key: "ashtechCountries", value: "BF,TG,CM,BJ" },
    { key: "ashtechWebhookSecret", value: "" },
    { key: "inpayEnabled", value: "false" },
    { key: "inpayChannelName", value: "InPay" },
    { key: "inpayCountries", value: "" },
  ];

  for (const settingData of requiredSettings) {
    const existing = existingSettings.find(s => s.key === settingData.key);
    const isSensitive = /secret|key|token|password/i.test(settingData.key);
    if (!existing) {
      await db.insert(platformSettings).values(settingData);
      console.log(`Setting added: ${settingData.key}${isSensitive ? "" : ` = ${settingData.value}`}`);
    } else if (
      settingData.key === "noticeText" &&
      (
        existing.value.startsWith("PepsiCo est une marque") ||
        /sybotx|zijin mining|disney|walt|pixar|marvel|star wars|roboticsfund/i.test(existing.value)
      )
    ) {
      await db.update(platformSettings)
        .set({ value: settingData.value })
        .where(eq(platformSettings.key, settingData.key));
      console.log(`Setting updated: ${settingData.key} = ${settingData.value}`);
    } else {
      console.log(`Setting preserved: ${existing.key}${isSensitive ? "" : ` = ${existing.value}`}`);
    }
  }
  console.log("Settings check complete");

  console.log("Database seeding complete!");
}
