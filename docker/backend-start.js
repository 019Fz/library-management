// Container start script: apply the migrations, optionally seed, then start the API.
// docker/Dockerfile copies this file to /app/docker-start.js (next to package.json) and runs: tsx docker-start.js
//   - Migrations: "prisma migrate deploy" only (never "migrate dev"). It applies what is in prisma/migrations
//     and does nothing when the database is already up to date, so it is safe on every start.
//   - Seeds are OFF unless you switch them on in the root .env (and there is no default password):
//       SEED=true       creates the seed admin (needs SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD)
//       SEED_DEMO=true  adds the demo users and books (needs DEMO_USER_PASSWORD)
//     Each one is skipped when its data already exists, so a restart never brings back a book you deleted.
//   - You can also seed by hand later: docker compose exec backend npm run seed   (or seed:demo)
// Nothing secret is printed here.
import { spawnSync } from "node:child_process";

// Runs a command and shows its output; a failure stops the container with a clear exit code
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`"${command} ${args.join(" ")}" failed`);
    process.exit(result.status ?? 1);
  }
}

console.log("Applying database migrations...");
run("npx", ["prisma", "migrate", "deploy"]);

if (process.env.SEED === "true" || process.env.SEED_DEMO === "true") {
  // Loaded only now: the tables exist after the migrations
  const { default: prisma } = await import("./src/lib/prisma.js");

  if (process.env.SEED === "true") {
    const email = process.env.SEED_ADMIN_EMAIL;
    const exists = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;
    if (exists) console.log("Seed skipped: the seed admin already exists.");
    else run("npm", ["run", "seed"]); // fails with a clear message if the email or password is missing
  }

  if (process.env.SEED_DEMO === "true") {
    // Demo users always have an email ending like this (see prisma/seed-demo.js)
    const demoUsers = await prisma.user.count({ where: { email: { endsWith: ".demo@example.test" } } });
    if (demoUsers > 0) console.log("Demo seed skipped: demo users already exist.");
    else run("npm", ["run", "seed:demo"]);
  }

  await prisma.$disconnect();
}

console.log("Starting the API...");
await import("./src/server.js");
