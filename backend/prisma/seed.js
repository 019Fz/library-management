// Idempotent seed: safe to run many times without creating duplicates.
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env");
  }

  // upsert = create if missing, otherwise leave the existing admin as is
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: "Admin",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "admin",
    },
  });

  // Only add sample books if the admin has none yet
  const bookCount = await prisma.book.count({ where: { userId: admin.id } });
  if (bookCount === 0) {
    await prisma.book.createMany({
      data: [
        { title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", price: "12.99", status: "completed", userId: admin.id },
        { title: "The Hobbit", author: "J.R.R. Tolkien", genre: "Fantasy", price: "9.50", status: "reading", userId: admin.id },
        { title: "Clean Code", author: "Robert C. Martin", genre: "Programming", price: "34.00", status: "to_read", userId: admin.id },
        { title: "Sapiens", author: "Yuval Noah Harari", genre: "History", price: "18.75", status: "to_read", userId: admin.id },
      ],
    });
  }

  console.log(`Seed done. Admin: ${email}, books: ${await prisma.book.count({ where: { userId: admin.id } })}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
