// Optional demo data: 3 demo users and 46 books. Safe to run many times.
// Mia has 26 books, enough for 3 pages of 12 in the books list.
// Run with: npm run seed:demo   (needs DEMO_USER_PASSWORD in backend/.env)
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";
import { toDbStatus } from "../src/lib/bookStatus.js";

// Demo emails must end like this so they can never be mistaken for real accounts
const DEMO_EMAIL_SUFFIX = "@example.test";

// Each book is [title, author, genre, price, status]. All prices are under 100.
const DEMO_USERS = [
  {
    name: "Mia Carter",
    email: "mia.demo@example.test",
    books: [
      // Sci-Fi
      ["Dune", "Frank Herbert", "Sci-Fi", 12.99, "completed"],
      ["Neuromancer", "William Gibson", "Sci-Fi", 9.99, "reading"],
      ["The Left Hand of Darkness", "Ursula K. Le Guin", "Sci-Fi", 11.5, "to-read"],
      ["Foundation", "Isaac Asimov", "Sci-Fi", 10.25, "completed"],
      ["Hyperion", "Dan Simmons", "Sci-Fi", 11.75, "reading"],
      ["Snow Crash", "Neal Stephenson", "Sci-Fi", 12.5, "to-read"],
      ["The Three-Body Problem", "Liu Cixin", "Sci-Fi", 14.25, "completed"],
      ["Ringworld", "Larry Niven", "Sci-Fi", 9.25, "to-read"],
      ["Solaris", "Stanislaw Lem", "Sci-Fi", 8.99, "completed"],
      ["Children of Time", "Adrian Tchaikovsky", "Sci-Fi", 13.5, "reading"],
      // Fantasy
      ["The Hobbit", "J.R.R. Tolkien", "Fantasy", 9.5, "completed"],
      ["A Wizard of Earthsea", "Ursula K. Le Guin", "Fantasy", 8.75, "reading"],
      ["The Name of the Wind", "Patrick Rothfuss", "Fantasy", 14.99, "to-read"],
      ["The Way of Kings", "Brandon Sanderson", "Fantasy", 16.99, "reading"],
      ["A Game of Thrones", "George R. R. Martin", "Fantasy", 14.5, "completed"],
      ["The Lies of Locke Lamora", "Scott Lynch", "Fantasy", 13.25, "to-read"],
      ["American Gods", "Neil Gaiman", "Fantasy", 12.75, "completed"],
      ["Piranesi", "Susanna Clarke", "Fantasy", 11.99, "to-read"],
      // Mystery
      ["And Then There Were None", "Agatha Christie", "Mystery", 7.99, "completed"],
      ["The Girl with the Dragon Tattoo", "Stieg Larsson", "Mystery", 13.4, "to-read"],
      ["Gone Girl", "Gillian Flynn", "Mystery", 12, "reading"],
      ["The Hound of the Baskervilles", "Arthur Conan Doyle", "Mystery", 6.5, "completed"],
      ["In the Woods", "Tana French", "Mystery", 12.4, "to-read"],
      ["The Maltese Falcon", "Dashiell Hammett", "Mystery", 8.25, "reading"],
      ["Rebecca", "Daphne du Maurier", "Mystery", 9.75, "completed"],
      ["The Da Vinci Code", "Dan Brown", "Mystery", 10.99, "to-read"],
    ],
  },
  {
    name: "Noah Bennett",
    email: "noah.demo@example.test",
    books: [
      ["Clean Code", "Robert C. Martin", "Programming", 34, "reading"],
      ["The Pragmatic Programmer", "Andrew Hunt and David Thomas", "Programming", 39.95, "completed"],
      ["Eloquent JavaScript", "Marijn Haverbeke", "Programming", 29.9, "to-read"],
      ["Designing Data-Intensive Applications", "Martin Kleppmann", "Programming", 45, "to-read"],
      ["Sapiens", "Yuval Noah Harari", "History", 18.75, "completed"],
      ["Guns, Germs, and Steel", "Jared Diamond", "History", 16.8, "to-read"],
      ["The Silk Roads", "Peter Frankopan", "History", 21, "reading"],
      ["Steve Jobs", "Walter Isaacson", "Biography", 19.99, "completed"],
      ["Educated", "Tara Westover", "Biography", 15.49, "reading"],
      ["Long Walk to Freedom", "Nelson Mandela", "Biography", 17.25, "to-read"],
    ],
  },
  {
    name: "Ava Rossi",
    email: "ava.demo@example.test",
    books: [
      ["Pride and Prejudice", "Jane Austen", "Romance", 6.99, "completed"],
      ["Outlander", "Diana Gabaldon", "Romance", 11.99, "to-read"],
      ["Me Before You", "Jojo Moyes", "Romance", 10.49, "reading"],
      ["The Notebook", "Nicholas Sparks", "Romance", 8.99, "completed"],
      ["Murder on the Orient Express", "Agatha Christie", "Mystery", 8.5, "completed"],
      ["The Big Sleep", "Raymond Chandler", "Mystery", 9.25, "to-read"],
      // Lowercase on purpose: shows how the genre list merges spellings that differ only by case
      ["The Martian", "Andy Weir", "sci-fi", 13.99, "completed"],
      ["Ender's Game", "Orson Scott Card", "Sci-Fi", 10.99, "reading"],
      ["Mistborn", "Brandon Sanderson", "Fantasy", 15.99, "to-read"],
      ["The Fellowship of the Ring", "J.R.R. Tolkien", "Fantasy", 11.25, "reading"],
    ],
  },
];

async function main() {
  // The password is never stored in the code; it must come from the environment
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 8 || password.length > 72) {
    throw new Error("Set DEMO_USER_PASSWORD in backend/.env (8 to 72 characters). See .env.example.");
  }
  for (const demo of DEMO_USERS) {
    if (!demo.email.endsWith(DEMO_EMAIL_SUFFIX)) {
      throw new Error(`Demo emails must end with ${DEMO_EMAIL_SUFFIX}: ${demo.email}`);
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let created = 0;
  let total = 0;

  for (const demo of DEMO_USERS) {
    // upsert with an empty update: an existing demo user (and its password) is left as it is
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {},
      create: { name: demo.name, email: demo.email, passwordHash, role: "user" },
    });

    for (const [title, author, genre, price, status] of demo.books) {
      total += 1;
      // Skip books this user already has, so running the script again adds nothing
      const exists = await prisma.book.findFirst({ where: { userId: user.id, title } });
      if (exists) continue;
      await prisma.book.create({
        data: { title, author, genre, price, status: toDbStatus(status), userId: user.id },
      });
      created += 1;
    }
  }

  console.log(`Demo seed done. Users: ${DEMO_USERS.length}. Books: ${total} (${created} created this run).`);
}

main()
  .catch((e) => {
    // Only the message is printed, never the password
    console.error(`Demo seed failed: ${e.message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
