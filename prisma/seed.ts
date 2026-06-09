import { prisma } from "../src/lib/prisma"

async function main() {
  await prisma.$queryRaw`SELECT 1`
  console.log("Database connection validated. No seed data was inserted.")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
