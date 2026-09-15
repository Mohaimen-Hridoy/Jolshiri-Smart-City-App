const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient instance across the app instead of creating
// a new connection pool per request.
const prisma = new PrismaClient();

module.exports = prisma;
