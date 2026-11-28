import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const users = await prisma.user.count();
const households = await prisma.household.count();
const sessions = await prisma.session.count();
console.log(JSON.stringify({ users, households, sessions }));
await prisma.$disconnect();
